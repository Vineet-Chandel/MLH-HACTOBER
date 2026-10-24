import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 8787;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// 1. Security headers
app.use(helmet());

// 2. Restrictive CORS: allow only the configured client dev origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-to-server) or matched client origin
      if (!origin || origin === CLIENT_ORIGIN) {
        callback(null, true);
      } else {
        callback(new Error('CORS: Not allowed by CORS policy'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. JSON body parser with size limit
app.use(express.json({ limit: '1mb' }));

import { AnalyzeRequestSchema, AnalyzeImageRequestSchema } from './validators/analysisSchema.js';
import { analyzeMessage, analyzeImage, AnalysisError } from './services/analyze.js';
import { validateImageFile, ImageValidationError } from './validators/imageValidator.js';
import { extractUrls, runUrlChecks } from './services/urlInspect.js';
import { buildStaticGuidance } from './services/staticGuidance.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
    files: 1,
  },
});

// 4. Rate limiting: 100 requests per 15-minute window per IP for general endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
});
app.use('/api', apiLimiter);

// Stricter rate limit on AI analysis route: 30 requests per 15 minutes
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Analysis request rate limit reached. Please wait a few minutes before submitting another analysis.',
    code: 'RATE_LIMITED',
  },
});

// Dedicated rate limit on multimodal image analysis: 15 requests per 15 minutes
const imageAnalyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Image analysis request rate limit reached. Please wait a few minutes before submitting another image.',
    code: 'RATE_LIMITED',
  },
});

// 5. Health check endpoint (never exposes keys or secrets)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 6. Security Analysis endpoint (Text)
app.post('/api/analyze', analyzeLimiter, async (req, res, next) => {
  try {
    const parseResult = AnalyzeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'Invalid request payload',
        code: 'INVALID_INPUT',
        details: parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const analysisResult = await analyzeMessage(parseResult.data);

    // Deterministic rule-based URL inspection (no network calls, separate from AI)
    const candidateUrls = [];
    if (parseResult.data.url) {
      candidateUrls.push({ raw: parseResult.data.url, source: 'url_field' });
    }
    const extracted = extractUrls(parseResult.data.message);
    for (const item of extracted) {
      candidateUrls.push({ raw: item.raw, source: 'message_text' });
    }

    const url_checks = runUrlChecks(candidateUrls);

    const static_guidance = buildStaticGuidance({
      scam_pattern: analysisResult.analysis?.scam_pattern,
      output_language: parseResult.data.output_language,
      detected_language: analysisResult.analysis?.detected_language,
      user_state: parseResult.data.user_state,
      region: 'IN',
    });

    res.json({
      ...analysisResult,
      url_checks,
      static_guidance,
    });
  } catch (error) {
    next(error);
  }
});

// 6b. Multimodal Screenshot Security Analysis endpoint
app.post(
  '/api/analyze-image',
  imageAnalyzeLimiter,
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          code: 'INVALID_INPUT',
          error: 'An image file is required.',
        });
      }

      // Validate real file type from magic bytes & header dimensions
      const { mimeType } = validateImageFile(req.file);

      // Validate optional metadata fields
      const parseResult = AnalyzeImageRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          code: 'INVALID_INPUT',
          error: parseResult.error.errors[0]?.message || 'Invalid form payload',
        });
      }

      const analysisResult = await analyzeImage({
        imageBuffer: req.file.buffer,
        mimeType,
        message_type: parseResult.data.message_type,
        context_note: parseResult.data.context_note,
        output_language: parseResult.data.output_language,
      });

      // Deterministic rule-based URL inspection from image observations
      const candidateUrls = [];
      if (parseResult.data.url) {
        candidateUrls.push({ raw: parseResult.data.url, source: 'url_field' });
      }

      // 1. URLs extracted from transcribed text (source: "transcript")
      const transcriptText = analysisResult.analysis?.image_observations?.transcribed_text || '';
      const extractedTranscript = extractUrls(transcriptText);
      for (const item of extractedTranscript) {
        candidateUrls.push({ raw: item.raw, source: 'transcript' });
      }

      // 2. URLs read by the model (source: "model_visible_urls" if not already in transcript)
      if (Array.isArray(analysisResult.analysis?.image_observations?.visible_urls)) {
        for (const vUrl of analysisResult.analysis.image_observations.visible_urls) {
          candidateUrls.push({ raw: vUrl, source: 'model_visible_urls' });
        }
      }

      const url_checks = runUrlChecks(candidateUrls);

      const static_guidance = buildStaticGuidance({
        scam_pattern: analysisResult.analysis?.scam_pattern,
        output_language: parseResult.data.output_language,
        detected_language: analysisResult.analysis?.detected_language,
        user_state: parseResult.data.user_state,
        region: 'IN',
      });

      res.json({
        ...analysisResult,
        url_checks,
        static_guidance,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 7. Global error handler: returns safe error messages, never stack traces
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        code: 'FILE_TOO_LARGE',
        error: 'Image exceeds the maximum allowed size of 5 MB.',
      });
    }
    return res.status(400).json({
      code: 'INVALID_INPUT',
      error: `File upload error: ${err.message}`,
    });
  }

  if (err instanceof ImageValidationError) {
    return res.status(err.status).json({
      code: err.code,
      error: err.message,
    });
  }

  if (err instanceof AnalysisError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
    });
  }

  const status = err.status || err.statusCode || 500;
  const safeMessage =
    status === 500 ? 'Internal server error' : err.message || 'An error occurred';

  res.status(status).json({
    error: safeMessage,
    code: err.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
  });
});

import path from 'path';

// Start listening only if run directly as the entry file
const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const server = app.listen(PORT, () => {
    console.log(`[LinkSleuth Server] Running on http://localhost:${PORT}`);
    console.log(`[LinkSleuth Server] Restrictive CORS allowed origin: ${CLIENT_ORIGIN}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [LinkSleuth Server] Port ${PORT} is already in use.`);
      console.error(`   Another instance is already running (e.g., from your other terminal tab running "npm run dev").`);
      console.error(`   To free port ${PORT}, run: lsof -ti :${PORT} | xargs kill -9\n`);
      process.exit(1);
    }
    throw err;
  });

  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
}

export default app;
