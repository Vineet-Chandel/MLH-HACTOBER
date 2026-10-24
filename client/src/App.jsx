import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Send,
  Info,
  Layers,
  FileText,
  Camera,
  Image as ImageIcon,
  Eye,
  ArrowRight,
  Sparkles,
  Rows3,
  Columns2,
  Lock,
  Languages,
  FlaskConical,
} from 'lucide-react';

import RiskBanner from './components/RiskBanner.jsx';
import HeuristicMeter from './components/HeuristicMeter.jsx';
import HighlightedMessage from './components/HighlightedMessage.jsx';
import EvidenceCard from './components/EvidenceCard.jsx';
import SignalsPanel from './components/SignalsPanel.jsx';
import ActionsPanel from './components/ActionsPanel.jsx';
import LimitationsPanel from './components/LimitationsPanel.jsx';
import CopyReportButton from './components/CopyReportButton.jsx';
import ScreenshotUploadZone from './components/ScreenshotUploadZone.jsx';
import ModelReadingView from './components/ModelReadingView.jsx';
import UrlChecksPanel from './components/UrlChecksPanel.jsx';
import WhereToReportPanel from './components/WhereToReportPanel.jsx';
import PatternChip from './components/PatternChip.jsx';
import PatternTipBlock from './components/PatternTipBlock.jsx';
import NeoButton from './components/NeoButton.jsx';
import AnimatedLogo from './components/AnimatedLogo.jsx';
import GenerationScreenLockModal from './components/GenerationScreenLockModal.jsx';
import NeoSelect from './components/NeoSelect.jsx';
import NeoDropdownModal from './components/NeoDropdownModal.jsx';

import indiaSamplesData from './data/india-samples.json' with { type: 'json' };

// Base synthetic sample inputs for text mode
const BASE_TEXT_SAMPLES = [
  {
    id: 'suspicious-bank',
    label: 'Sample: Suspicious bank credential harvest',
    message:
      'URGENT: Your First National Bank account has been suspended due to suspicious activity. Verify your identity immediately at https://first-national-security-portal.xyz/login to avoid permanent closure.',
    message_type: 'sms',
    url: 'https://first-national-security-portal.xyz/login',
  },
  {
    id: 'benign-grocery',
    label: 'Sample: Benign routine delivery notification',
    message:
      'Hi Alex, your weekly order summary from FreshMart is ready. Your delivery of groceries is scheduled for tomorrow between 2 PM and 4 PM. View your items in the FreshMart app if you need to make changes before 8 PM tonight.',
    message_type: 'email',
    url: '',
  },
  {
    id: 'ambiguous-doc',
    label: 'Sample: Ambiguous shared drive lure',
    message:
      'Hey, check out this document from the meeting earlier today. Let me know what you think when you get a chance.',
    message_type: 'other',
    url: 'https://docs.shared-drive-portal.net/doc/98231',
  },
];

const ALL_SYNTHETIC_SAMPLES = [
  ...BASE_TEXT_SAMPLES,
  ...(Array.isArray(indiaSamplesData) ? indiaSamplesData : []).map((s) => ({
    id: s.id,
    label: s.label,
    message: s.message,
    message_type: s.message_type || 'sms',
    url: s.url || '',
    language: s.language || 'en',
  })),
];

export default function App() {
  // Backend connectivity state
  const [backendHealth, setBackendHealth] = useState('checking'); // 'checking' | 'connected' | 'offline'

  // Workspace layout mode: 'stacked' (Form above Findings) | 'side-by-side'
  const [layoutMode, setLayoutMode] = useState('stacked');

  // Investigation Mode Switch: 'text' | 'screenshot'
  const [investigationMode, setInvestigationMode] = useState('text');

  // Text Form input state
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('email');
  const [url, setUrl] = useState('');
  const [claimedOrg, setClaimedOrg] = useState('');
  const [outputLanguage, setOutputLanguage] = useState('match'); // 'match' | 'en' | 'hi'
  const [userState, setUserState] = useState('none'); // 'none' | 'clicked_link' | 'shared_info' | 'paid_money'

  // Screenshot Form input state
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [contextNote, setContextNote] = useState('');
  const [imageMessageType, setImageMessageType] = useState('other');
  const [imageResultTab, setImageResultTab] = useState('model_read'); // 'preview' | 'model_read'

  // Submitted snapshot (retained for inspection highlighting during active view)
  const [submittedSnapshot, setSubmittedSnapshot] = useState({
    message: '',
    url: '',
    messageType: 'email',
    imageUrl: null,
  });

  // Analysis workflow state
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [urlChecks, setUrlChecks] = useState(null);
  const [staticGuidance, setStaticGuidance] = useState(null);
  const [errorState, setErrorState] = useState(null);

  // Interactive indicator selection / cross-linking state
  const [activeIndicatorIndex, setActiveIndicatorIndex] = useState(null);

  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);
  const resultsTopRef = useRef(null);

  // Poll backend health status
  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setBackendHealth('connected');
          return;
        }
      }
      setBackendHealth('offline');
    } catch {
      setBackendHealth('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Timer effect while loading
  useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  // Clean up snapshot image URL on unmount
  useEffect(() => {
    return () => {
      if (submittedSnapshot.imageUrl && submittedSnapshot.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(submittedSnapshot.imageUrl);
      }
    };
  }, [submittedSnapshot.imageUrl]);

  // Sort indicators by severity: high (3) > medium (2) > low (1)
  const sortedIndicators = useMemo(() => {
    if (!analysisResult?.indicators) return [];
    const severityWeight = { high: 3, medium: 2, low: 1 };
    return [...analysisResult.indicators]
      .map((ind, originalIdx) => ({ ...ind, _originalIdx: originalIdx }))
      .sort((a, b) => {
        const weightDiff =
          (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        if (weightDiff !== 0) return weightDiff;
        return a._originalIdx - b._originalIdx;
      })
      .map((ind, sortedIdx) => ({
        ...ind,
        displayNumber: sortedIdx + 1,
      }));
  }, [analysisResult]);

  // Handle loading a synthetic text sample
  const handleSelectTextSample = (sampleOrEvent, autoAnalyze = true) => {
    const sample = sampleOrEvent?.id
      ? sampleOrEvent
      : ALL_SYNTHETIC_SAMPLES.find((s) => s.id === sampleOrEvent?.target?.value);
    if (!sample) return;

    setSelectedScenario(sample);
    setMessage(sample.message);
    setMessageType(sample.message_type);
    setUrl(sample.url || '');
    setErrorState(null);

    // Automatically trigger analysis so scenario findings immediately render over the page!
    if (autoAnalyze) {
      executeTextAnalysis(sample.message, sample.message_type, sample.url || '');
    }
  };

  const handleClearScenario = () => {
    setSelectedScenario(null);
    setMessage('');
    setUrl('');
    setMessageType('email');
    setErrorState(null);
    setAnalysisResult(null);
  };

  // Submit Text analysis request
  const executeTextAnalysis = async (msgText, msgType, urlText) => {
    if (!msgText.trim() || isLoading) return;

    setErrorState(null);
    setAnalysisResult(null);
    setMeta(null);
    setUrlChecks(null);
    setStaticGuidance(null);
    setActiveIndicatorIndex(null);
    setIsLoading(true);

    setSubmittedSnapshot({
      message: msgText.trim(),
      messageType: msgType,
      url: urlText.trim(),
      imageUrl: null,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgText.trim(),
          message_type: msgType,
          url: urlText.trim() || undefined,
          claimed_org: claimedOrg.trim() || undefined,
          output_language: outputLanguage,
          user_state: userState !== 'none' ? userState : undefined,
        }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        let friendlyMessage = data.error || 'Analysis request failed.';
        if (data.code === 'RATE_LIMITED') {
          friendlyMessage =
            'Model request quota or rate limit reached. Please wait a moment before trying again.';
        } else if (data.code === 'TIMEOUT') {
          friendlyMessage =
            'The security analysis service timed out after 30 seconds. Please try again.';
        } else if (data.code === 'MODEL_UNAVAILABLE') {
          friendlyMessage =
            'The requested Gemma 4 model is currently unavailable on the backend.';
        } else if (data.code === 'MODEL_OUTPUT_INVALID') {
          friendlyMessage =
            'The model produced output that could not be validated against the defensive security schema.';
        } else if (data.code === 'AUTH_FAILED') {
          friendlyMessage =
            'Authentication with the AI service failed. Verify your GEMINI_API_KEY configuration.';
        }

        setErrorState({
          code: data.code || 'REQUEST_FAILED',
          message: friendlyMessage,
        });
        setIsLoading(false);
        return;
      }

      setAnalysisResult(data.analysis);
      setMeta(data.meta);
      setUrlChecks(data.url_checks || null);
      setStaticGuidance(data.static_guidance || null);

      if (resultsTopRef.current) {
        resultsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setErrorState({
          code: 'CANCELLED',
          message: 'Analysis was cancelled by the user.',
        });
      } else {
        setErrorState({
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to the backend server. Verify your connection.',
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Submit Screenshot analysis request
  const executeScreenshotAnalysis = async () => {
    if (!selectedImageFile || isLoading) return;

    setErrorState(null);
    setAnalysisResult(null);
    setMeta(null);
    setUrlChecks(null);
    setStaticGuidance(null);
    setActiveIndicatorIndex(null);
    setIsLoading(true);

    const previewUrl = URL.createObjectURL(selectedImageFile);
    setSubmittedSnapshot({
      message: '',
      url: '',
      messageType: imageMessageType,
      imageUrl: previewUrl,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('image', selectedImageFile);
      formData.append('message_type', imageMessageType);
      if (contextNote.trim()) {
        formData.append('context_note', contextNote.trim());
      }
      if (claimedOrg.trim()) {
        formData.append('claimed_org', claimedOrg.trim());
      }
      formData.append('output_language', outputLanguage);
      if (userState && userState !== 'none') {
        formData.append('user_state', userState);
      }

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        let friendlyMessage = data.error || 'Screenshot analysis request failed.';
        if (data.code === 'FILE_TOO_LARGE') {
          friendlyMessage = 'Image exceeds the maximum allowed size of 5 MB.';
        } else if (data.code === 'INVALID_FILE_TYPE') {
          friendlyMessage = 'Invalid image format. Only PNG, JPEG, and WebP images are supported.';
        } else if (data.code === 'RATE_LIMITED') {
          friendlyMessage =
            'Image analysis request rate limit reached. Please wait a few moments.';
        } else if (data.code === 'TIMEOUT') {
          friendlyMessage =
            'The multimodal analysis service timed out after 60 seconds. Please try again.';
        } else if (data.code === 'MODEL_UNAVAILABLE') {
          friendlyMessage =
            'The requested Gemma 4 multimodal model is currently unavailable on the backend.';
        } else if (data.code === 'MODEL_OUTPUT_INVALID') {
          friendlyMessage =
            'The model produced output that could not be validated against the security schema.';
        }

        setErrorState({
          code: data.code || 'REQUEST_FAILED',
          message: friendlyMessage,
        });
        setIsLoading(false);
        return;
      }

      setAnalysisResult(data.analysis);
      setMeta(data.meta);
      setUrlChecks(data.url_checks || null);
      setStaticGuidance(data.static_guidance || null);
      setImageResultTab('model_read');

      if (resultsTopRef.current) {
        resultsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setErrorState({
          code: 'CANCELLED',
          message: 'Analysis was cancelled by the user.',
        });
      } else {
        setErrorState({
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to the backend server. Verify your connection.',
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    executeTextAnalysis(message, messageType, url);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    setSelectedScenario(null);
    setMessage('');
    setUrl('');
    setMessageType('email');
    setClaimedOrg('');
    setOutputLanguage('match');
    setUserState('none');
    setSelectedImageFile(null);
    setContextNote('');
    setSubmittedSnapshot({ message: '', url: '', messageType: 'email', imageUrl: null });
    setAnalysisResult(null);
    setMeta(null);
    setUrlChecks(null);
    setStaticGuidance(null);
    setErrorState(null);
    setActiveIndicatorIndex(null);
  };

  const handleSelectIndicatorFromHighlight = (targetIndex) => {
    setActiveIndicatorIndex(targetIndex);
    setTimeout(() => {
      const cardEl = document.getElementById(`evidence-card-${targetIndex}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        cardEl.focus();
      }
    }, 50);
  };

  const handleJumpToHighlightFromCard = (targetIndex) => {
    setActiveIndicatorIndex(targetIndex);
    setTimeout(() => {
      const highlightEl = document.getElementById(`highlight-${targetIndex}`);
      if (highlightEl) {
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightEl.focus();
      }
    }, 50);
  };

  const isImageAnalysis = meta?.input_type === 'image';

  // -------------------------------------------------------------
  // Content Sections
  // -------------------------------------------------------------

  // 1. Investigation Findings Section (Rendered BELOW the form in stacked mode)
  const renderFindingsSection = () => (
    <div ref={resultsTopRef} className="flex flex-col gap-6">
      {/* Section Heading & Copy Report Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000000]">
            <Layers className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
              Investigation Findings
            </h2>
            <span className="text-[10px] font-mono font-bold text-neutral-500">
              Defensive AI &amp; Grounded Evidence Analysis
            </span>
          </div>
        </div>

        {analysisResult && (
          <CopyReportButton
            analysis={analysisResult}
            meta={meta}
            submittedMessage={submittedSnapshot.message}
            submittedUrl={submittedSnapshot.url}
            urlChecks={urlChecks}
            staticGuidance={staticGuidance}
          />
        )}
      </div>

      {/* State 1: Error Alert Card */}
      {!isLoading && errorState && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-black bg-[#fee2e2] p-6 text-[#991b1b] flex flex-col gap-4 shadow-[6px_6px_0px_#000000]"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3.5">
            <AlertCircle className="w-6 h-6 text-[#ef4444] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="text-sm font-black text-[#991b1b] uppercase tracking-wide">
                Analysis Error: {errorState.code}
              </h3>
              <p className="text-xs text-neutral-900 mt-1.5 leading-relaxed font-semibold">
                {errorState.message}
              </p>
            </div>
          </div>

          {errorState.code !== 'CANCELLED' && (
            <div className="pt-2 border-t-2 border-red-200 flex justify-end">
              <NeoButton
                size="sm"
                variant="danger"
                onClick={() => {
                  if (investigationMode === 'screenshot') {
                    executeScreenshotAnalysis();
                  } else {
                    executeTextAnalysis(message, messageType, url);
                  }
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                <span>Retry Analysis</span>
              </NeoButton>
            </div>
          )}
        </motion.section>
      )}

      {/* State 2: Empty State (Awaiting Content Submission) */}
      {!isLoading && !errorState && !analysisResult && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border-2 border-black bg-white p-8 sm:p-14 flex flex-col items-center justify-center text-center text-neutral-600 min-h-[340px] shadow-[6px_6px_0px_#000000]"
        >
          <div className="p-4 rounded-2xl bg-[#faf8f3] border-2 border-black mb-4 shadow-[4px_4px_0px_#000000]">
            <ShieldAlert className="w-10 h-10 text-neutral-800" aria-hidden="true" />
          </div>
          <h3 className="text-base font-black text-neutral-900">
            Awaiting Content Submission
          </h3>
          <p className="text-xs text-neutral-600 mt-1.5 max-w-md leading-relaxed font-semibold">
            {investigationMode === 'screenshot'
              ? `Upload an image or select a sample ${layoutMode === 'stacked' ? 'in the form above' : 'on the left'} to evaluate for fake login prompts, urgent alerts, and deceptive cues.`
              : `Paste an untrusted text message or load a sample ${layoutMode === 'stacked' ? 'in the form above' : 'on the left'} to extract indicators, verify grounded evidence, and inspect links.`}
          </p>
        </motion.section>
      )}

      {/* State 3: Active Results Display */}
      {!isLoading && !errorState && analysisResult && (
        <div className="flex flex-col gap-6">
          {/* 1. Risk Level Banner with Summary, Model, Latency */}
          <RiskBanner
            riskLevel={analysisResult.risk_level}
            summary={analysisResult.summary}
            model={meta?.model}
            latencyMs={meta?.latency_ms}
          />

          {/* 2. Heuristic Indicator Meter */}
          <HeuristicMeter
            score={analysisResult.heuristic_score}
            riskLevel={analysisResult.risk_level}
          />

          {/* 2b. AI-suggested Scam Pattern Chip */}
          <PatternChip
            scamPattern={analysisResult.scam_pattern}
            patternRationale={analysisResult.pattern_rationale}
            detectedLanguage={analysisResult.detected_language}
            displayLanguage={
              outputLanguage === 'hi' ||
              (outputLanguage === 'match' && analysisResult.detected_language === 'hi')
                ? 'hi'
                : 'en'
            }
          />

          {/* 2c. Static Pattern Guidance Tip ("Good to know") */}
          {staticGuidance?.pattern_tip && (
            <PatternTipBlock
              patternTip={staticGuidance.pattern_tip}
              displayLanguage={
                outputLanguage === 'hi' ||
                (outputLanguage === 'match' && analysisResult.detected_language === 'hi')
                  ? 'hi'
                  : 'en'
              }
            />
          )}

          {/* 2d. Static "Where to report" Panel */}
          <WhereToReportPanel
            staticGuidance={staticGuidance}
            userState={userState}
            isHindi={
              outputLanguage === 'hi' ||
              (outputLanguage === 'match' && analysisResult.detected_language === 'hi')
            }
          />

          {/* 2e. Deterministic Rule-Based URL Inspection Panel */}
          <UrlChecksPanel urlChecks={urlChecks} />

          {/* 3. Evidence Cards List */}
          <section
            className="flex flex-col gap-3.5"
            aria-labelledby="indicators-heading"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3
                  id="indicators-heading"
                  className="text-xs font-black text-neutral-900 uppercase tracking-wider"
                >
                  Identified Indicators ({sortedIndicators.length})
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#faf8f3] text-black border border-black shadow-[1px_1px_0px_#000]">
                  AI-generated
                </span>
              </div>
              {meta?.unverified_evidence_count > 0 && (
                <span className="text-[11px] text-amber-900 font-bold bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-400">
                  ⚠️ {meta.unverified_evidence_count} unverified quote(s)
                </span>
              )}
            </div>

            {sortedIndicators.length === 0 ? (
              <p className="text-xs text-neutral-600 italic bg-white p-4 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]">
                No deceptive or malicious indicators detected in the submission.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {sortedIndicators.map((ind) => (
                  <EvidenceCard
                    key={ind._originalIdx}
                    indicator={ind}
                    index={ind._originalIdx}
                    displayNumber={ind.displayNumber}
                    isActive={activeIndicatorIndex === ind._originalIdx}
                    onFocusCard={setActiveIndicatorIndex}
                    onJumpToHighlight={handleJumpToHighlightFromCard}
                    inputType={isImageAnalysis ? 'image' : 'text'}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 4. Signals Panel */}
          <SignalsPanel signals={analysisResult.positive_or_neutral_signals} />

          {/* 5. Actions Panel */}
          <ActionsPanel recommendedActions={analysisResult.recommended_actions} />

          {/* 6. Limitations Panel (Permanently Visible) */}
          <LimitationsPanel limitations={analysisResult.limitations} />
        </div>
      )}
    </div>
  );

  // 2. Submission Workspace Section (Form + Mode Switcher + Inspection Viewer)
  const renderSubmissionSection = () => (
    <div className="flex flex-col gap-6">
      {/* Tactile Mode Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Investigation Input Mode"
        className="grid grid-cols-2 p-1.5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000000] text-xs font-black"
      >
        <motion.button
          type="button"
          role="tab"
          id="tab-text"
          aria-selected={investigationMode === 'text'}
          aria-controls="panel-text"
          onClick={() => setInvestigationMode('text')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all cursor-pointer font-bold select-none ${
            investigationMode === 'text'
              ? 'bg-[#8bfb34] text-black border-2 border-black shadow-[2px_2px_0px_#000000] font-black'
              : 'text-neutral-600 hover:text-black border-2 border-transparent'
          }`}
          whileTap={{ scale: 0.97 }}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>Text Message</span>
        </motion.button>

        <motion.button
          type="button"
          role="tab"
          id="tab-screenshot"
          aria-selected={investigationMode === 'screenshot'}
          aria-controls="panel-screenshot"
          onClick={() => setInvestigationMode('screenshot')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all cursor-pointer font-bold select-none ${
            investigationMode === 'screenshot'
              ? 'bg-[#8bfb34] text-black border-2 border-black shadow-[2px_2px_0px_#000000] font-black'
              : 'text-neutral-600 hover:text-black border-2 border-transparent'
          }`}
          whileTap={{ scale: 0.97 }}
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          <span>Screenshot / Image</span>
        </motion.button>
      </div>

      {/* Submission Input Section: Pure white card with solid black border & offset shadow */}
      <section
        className="bg-white border-2 border-black rounded-2xl p-6 sm:p-7 shadow-[6px_6px_0px_#000000] flex flex-col gap-5"
        aria-labelledby="input-heading"
      >
        {investigationMode === 'text' ? (
          /* Text Input Mode */
          <>
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b-2 border-neutral-100 pb-3">
              <div>
                <h2 id="input-heading" className="text-sm font-black uppercase tracking-wider text-neutral-900">
                  Content Submission
                </h2>
                <span className="text-[10px] font-mono text-neutral-500 font-semibold">
                  Paste untrusted message text for defensive AI inspection
                </span>
              </div>

              <div className="relative w-full sm:w-auto max-w-full sm:max-w-xs">
                <NeoDropdownModal
                  id="sample-selector"
                  title="Synthetic Security Scenarios"
                  subtitle="Curated phishing, smishing, and deceptive message lures"
                  triggerLabel="Load synthetic sample..."
                  selectedScenario={selectedScenario}
                  badgeText={`${ALL_SYNTHETIC_SAMPLES.length} Scenarios`}
                  icon={FlaskConical}
                  samples={ALL_SYNTHETIC_SAMPLES}
                  type="text"
                  onSelect={handleSelectTextSample}
                  onClear={handleClearScenario}
                />
              </div>
            </div>

            {/* Active Scenario Banner */}
            {selectedScenario && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[#8bfb34]/20 border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-bold"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <div className="p-1 rounded bg-[#8bfb34] border border-black text-black flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="text-neutral-600 flex-shrink-0">Loaded Scenario:</span>
                  <span className="text-black font-black truncate">{selectedScenario.label}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleClearScenario}
                    className="px-2.5 py-1 rounded-md border border-black bg-white hover:bg-neutral-100 text-[11px] font-bold cursor-pointer transition-colors shadow-[1px_1px_0px_#000]"
                  >
                    Clear (Custom)
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => executeTextAnalysis(selectedScenario.message, selectedScenario.message_type, selectedScenario.url || '')}
                    className="px-2.5 py-1 rounded-md border border-black bg-[#8bfb34] hover:bg-[#7ce62c] text-black text-[11px] font-black cursor-pointer shadow-[1px_1px_0px_#000] disabled:opacity-50"
                  >
                    Re-Analyze →
                  </button>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleTextSubmit} className="flex flex-col gap-4">
              {/* Message Type Selector */}
              <fieldset>
                <legend className="text-xs font-black uppercase tracking-wider text-neutral-700 mb-2">
                  Message Medium:
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'type-email', val: 'email', label: 'Email' },
                    { id: 'type-sms', val: 'sms', label: 'SMS / Text' },
                    { id: 'type-call', val: 'call', label: 'Call Notes' },
                    { id: 'type-other', val: 'other', label: 'Other' },
                  ].map((item) => (
                    <label
                      key={item.val}
                      htmlFor={item.id}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border-2 border-black text-xs font-bold cursor-pointer transition-all text-center select-none ${
                        messageType === item.val
                          ? 'bg-[#8bfb34] text-black shadow-[2px_2px_0px_#000000]'
                          : 'bg-white text-neutral-700 hover:bg-[#faf8f3]'
                      }`}
                    >
                      <input
                        type="radio"
                        id={item.id}
                        name="message_type"
                        value={item.val}
                        checked={messageType === item.val}
                        onChange={(e) => setMessageType(e.target.value)}
                        className="sr-only"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Message Textarea with Live Counter */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="message-input" className="text-xs font-black uppercase tracking-wider text-neutral-700">
                    Message Content <span className="text-red-500">*</span>
                  </label>
                  <span
                    id="char-count"
                    className={`text-xs font-mono font-bold ${
                      message.length > 14000 ? 'text-red-600 font-extrabold' : 'text-neutral-500'
                    }`}
                    aria-live="polite"
                  >
                    {message.length.toLocaleString()} / 15,000
                  </span>
                </div>
                <textarea
                  id="message-input"
                  name="message"
                  rows={5}
                  maxLength={15000}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Paste suspicious SMS, email, WhatsApp message, or notification body here..."
                  className="w-full bg-white border-2 border-black rounded-xl p-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black resize-y shadow-[3px_3px_0px_#000000]"
                  aria-describedby="message-hint char-count"
                />
                <span id="message-hint" className="sr-only">
                  Enter untrusted message text to analyze defensively.
                </span>
              </div>

              {/* Who does this message claim to be from? */}
              <div>
                <label htmlFor="text-claimed-org-input" className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                  Who does this message claim to be from? <span className="text-neutral-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  id="text-claimed-org-input"
                  name="claimed_org"
                  maxLength={100}
                  value={claimedOrg}
                  onChange={(e) => setClaimedOrg(e.target.value)}
                  placeholder="e.g. State Bank of India, Amazon, DHL, Netflix"
                  className="w-full bg-white border-2 border-black rounded-xl px-3.5 py-2 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black shadow-[2px_2px_0px_#000000]"
                />
              </div>

              {/* Optional URL Input */}
              <div>
                <label htmlFor="url-input" className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                  Embedded URL <span className="text-neutral-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  id="url-input"
                  name="url"
                  maxLength={2048}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example-verification-portal.xyz/login"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="w-full bg-white border-2 border-black rounded-xl px-3.5 py-2 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black shadow-[2px_2px_0px_#000000]"
                  aria-describedby="url-hint"
                />
                <p id="url-hint" className="mt-1 text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" aria-hidden="true" />
                  <span>Optional. Links in your message or screenshot are detected automatically. All links are checked by fixed rules and never opened.</span>
                </p>
              </div>

              {/* Explain in Language Selector */}
              <NeoSelect
                id="text-output-lang-select"
                label="Explain in:"
                value={outputLanguage}
                onChange={setOutputLanguage}
                icon={Languages}
                options={[
                  {
                    value: 'match',
                    label: 'Match input message language',
                    badge: 'Auto',
                    description: 'Analyzes language of submitted text tokens automatically',
                  },
                  {
                    value: 'en',
                    label: 'English',
                    badge: 'EN',
                    description: 'Generate report and explanation in English',
                  },
                  {
                    value: 'hi',
                    label: 'हिन्दी (Hindi)',
                    badge: 'HI',
                    description: 'Generate report and explanation in Hindi (हिन्दी)',
                  },
                ]}
              />

              {/* Optional "Have you already acted on this?" radio group */}
              <fieldset className="p-3.5 rounded-xl bg-[#faf8f3] border-2 border-black shadow-[2px_2px_0px_#000]">
                <legend className="text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                  Have you already acted on this? <span className="text-neutral-400 font-normal lowercase">(optional)</span>
                </legend>
                <p className="text-[11px] text-neutral-500 font-medium mb-2">
                  Not sent to the AI. Only selects static emergency guidance if needed.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { val: 'none', label: 'No' },
                    { val: 'clicked_link', label: 'I clicked a link' },
                    { val: 'shared_info', label: 'I shared details (OTP, password, card)' },
                    { val: 'paid_money', label: 'I sent money' },
                  ].map((item) => (
                    <label
                      key={item.val}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 border-black cursor-pointer transition-all select-none font-bold ${
                        userState === item.val
                          ? 'bg-[#8bfb34] text-black shadow-[2px_2px_0px_#000]'
                          : 'bg-white text-neutral-700 hover:bg-[#faf8f3]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="text_user_state"
                        value={item.val}
                        checked={userState === item.val}
                        onChange={(e) => setUserState(item.val)}
                        className="sr-only"
                      />
                      <span className="text-xs">{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Form Action Buttons: Inspired by Image 1 & Image 3 */}
              <div className="flex items-center gap-3 pt-2">
                <NeoButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isLoading || !message.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Evaluating Content... ({elapsedSeconds}s)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                      <Send className="w-4 h-4" aria-hidden="true" />
                      <span>Analyze Content</span>
                      <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
                    </span>
                  )}
                </NeoButton>

                {(message || analysisResult || errorState) && (
                  <NeoButton
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleReset}
                    title="Reset workspace"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Reset workspace</span>
                  </NeoButton>
                )}
              </div>
            </form>
          </>
        ) : (
          /* Screenshot Upload Mode */
          <ScreenshotUploadZone
            onAnalyze={executeScreenshotAnalysis}
            isLoading={isLoading}
            elapsedSeconds={elapsedSeconds}
            onCancel={handleCancel}
            selectedFile={selectedImageFile}
            setSelectedFile={setSelectedImageFile}
            contextNote={contextNote}
            setContextNote={setContextNote}
            messageType={imageMessageType}
            setMessageType={setImageMessageType}
            claimedOrg={claimedOrg}
            setClaimedOrg={setClaimedOrg}
            outputLanguage={outputLanguage}
            setOutputLanguage={setOutputLanguage}
            userState={userState}
            setUserState={setUserState}
          />
        )}
      </section>

      {/* Inspection View (renders below form when analysis results exist) */}
      {!isLoading && analysisResult && (
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="bg-white border-2 border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000000]"
          aria-labelledby="inspection-heading"
        >
          {isImageAnalysis ? (
            /* Image Analysis Result Viewer: Preview Tab | Model Read Tab */
            <div className="flex flex-col gap-4">
              <div
                role="tablist"
                aria-label="Screenshot inspection view options"
                className="flex items-center gap-2 border-b-2 border-neutral-100 pb-3"
              >
                <NeoButton
                  size="sm"
                  variant={imageResultTab === 'model_read' ? 'primary' : 'secondary'}
                  onClick={() => setImageResultTab('model_read')}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  <span>What the model read</span>
                </NeoButton>

                {submittedSnapshot.imageUrl && (
                  <NeoButton
                    size="sm"
                    variant={imageResultTab === 'preview' ? 'primary' : 'secondary'}
                    onClick={() => setImageResultTab('preview')}
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    <span>Screenshot Preview</span>
                  </NeoButton>
                )}
              </div>

              {imageResultTab === 'model_read' ? (
                <ModelReadingView
                  imageObservations={analysisResult.image_observations}
                  indicators={sortedIndicators}
                  activeIndicatorIndex={activeIndicatorIndex}
                  onSelectIndicator={handleSelectIndicatorFromHighlight}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#faf8f3] border-2 border-black shadow-[3px_3px_0px_#000]">
                  <img
                    src={submittedSnapshot.imageUrl}
                    alt="Submitted screenshot"
                    className="max-h-[380px] w-auto object-contain rounded-lg border border-black/20"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Text Analysis Result Viewer: Highlighted Message */
            submittedSnapshot.message && (
              <HighlightedMessage
                message={submittedSnapshot.message}
                indicators={sortedIndicators}
                activeIndicatorIndex={activeIndicatorIndex}
                onSelectIndicator={handleSelectIndicatorFromHighlight}
              />
            )
          )}
        </motion.section>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f4ee] bg-[radial-gradient(#d3cec2_1.25px,transparent_1.25px)] [background-size:20px_20px] text-neutral-900 flex flex-col justify-between p-4 sm:p-8 selection:bg-[#8bfb34]/40 font-sans">
      {/* Screen Lock Modal: Active during context generation until submission finishes */}
      <GenerationScreenLockModal
        isOpen={isLoading}
        elapsedSeconds={elapsedSeconds}
        investigationMode={investigationMode}
        onCancel={handleCancel}
      />

      {/* 1. Top Navigation & Brand Header */}
      <header className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-6">
        <AnimatedLogo />

        <div className="flex items-center gap-3 flex-wrap">
          {/* Layout Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-bold">
            <button
              type="button"
              onClick={() => setLayoutMode('stacked')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer select-none ${
                layoutMode === 'stacked'
                  ? 'bg-[#8bfb34] text-black font-black shadow-[1px_1px_0px_#000]'
                  : 'text-neutral-600 hover:text-black'
              }`}
              title="Form displayed above investigation findings"
            >
              <Rows3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Form Above</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('side-by-side')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer select-none ${
                layoutMode === 'side-by-side'
                  ? 'bg-[#8bfb34] text-black font-black shadow-[1px_1px_0px_#000]'
                  : 'text-neutral-600 hover:text-black'
              }`}
              title="2-column side-by-side layout"
            >
              <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Side-by-Side</span>
            </button>
          </div>

          {/* Backend Connectivity Status Pill */}
          {backendHealth === 'checking' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white text-neutral-700 border-2 border-black shadow-[3px_3px_0px_#000]"
              role="status"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" aria-hidden="true" />
              <span>Verifying AI Service...</span>
            </div>
          )}

          {backendHealth === 'connected' && (
            <motion.div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-black bg-[#8bfb34] text-black border-2 border-black shadow-[3px_3px_0px_#000]"
              role="status"
              whileHover={{ scale: 1.03 }}
            >
              <motion.span
                className="w-2 h-2 rounded-full bg-black inline-block"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span>SYSTEM READY</span>
            </motion.div>
          )}

          {backendHealth === 'offline' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-black bg-[#ff4d4d] text-white border-2 border-black shadow-[3px_3px_0px_#000]"
              role="status"
            >
              <AlertCircle className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              <span>BACKEND OFFLINE</span>
            </div>
          )}
        </div>
      </header>

      {/* Screen Reader Live Region for Status Announcements */}
      <div className="sr-only" aria-live="polite" role="status">
        {isLoading && `Analysis in progress. Elapsed time: ${elapsedSeconds} seconds.`}
        {!isLoading && errorState && `Analysis failed: ${errorState.message}`}
        {!isLoading &&
          analysisResult &&
          `Analysis complete. Assessed risk: ${analysisResult.risk_level}. Found ${
            analysisResult.indicators?.length || 0
          } indicators.`}
      </div>

      {/* 2. Main Workspace Layout */}
      {layoutMode === 'stacked' ? (
        /* STACKED MODE: Submission Form is placed ABOVE the Investigation Findings/Results */
        <main className="max-w-5xl mx-auto w-full my-6 flex-1 flex flex-col gap-10 items-stretch">
          {/* Top: Submission Form & Content Inspection */}
          <section aria-label="Submission Workspace Section">
            {renderSubmissionSection()}
          </section>

          {/* Bottom: Investigation Findings & Results */}
          <section aria-label="Investigation Findings Section" className="border-t-2 border-black/80 pt-8">
            {renderFindingsSection()}
          </section>
        </main>
      ) : (
        /* SIDE-BY-SIDE MODE: 2 Columns on wide screens */
        <main className="max-w-6xl mx-auto w-full my-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            {renderSubmissionSection()}
          </div>
          <div className="lg:col-span-7">
            {renderFindingsSection()}
          </div>
        </main>
      )}

      {/* 3. Footer */}
      <footer className="max-w-6xl mx-auto w-full border-t-2 border-black pt-4 mt-8 flex flex-wrap items-center justify-between gap-3 text-xs font-mono font-bold text-neutral-600">
        <div>LinkSleuth &bull; Defensive Security Intelligence Workspace</div>
        <div>Open-weight Google Gemma &bull; MIT License</div>
      </footer>
    </div>
  );
}
