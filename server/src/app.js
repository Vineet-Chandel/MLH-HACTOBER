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

import { AnalyzeRequestSchema } from './validators/analysisSchema.js';
import { analyzeMessage, AnalysisError } from './services/analyze.js';

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

// 5. Health check endpoint (never exposes keys or secrets)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 6. Security Analysis endpoint
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
    res.json(analysisResult);
  } catch (error) {
    next(error);
  }
});

// 7. Global error handler: returns safe error messages, never stack traces
app.use((err, req, res, next) => {
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
  app.listen(PORT, () => {
    console.log(`[LinkSleuth Server] Running on http://localhost:${PORT}`);
    console.log(`[LinkSleuth Server] Restrictive CORS allowed origin: ${CLIENT_ORIGIN}`);
  });
}

export default app;
