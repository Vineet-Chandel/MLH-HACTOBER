import React, { useEffect, useState, useRef, useMemo } from 'react';
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

// Synthetic sample inputs for text mode
const SYNTHETIC_TEXT_SAMPLES = [
  {
    id: 'suspicious-bank',
    label: 'Sample (synthetic): Suspicious bank credential request',
    message:
      'URGENT: Your First National Bank account has been suspended due to suspicious activity. Verify your identity immediately at https://first-national-security-portal.xyz/login to avoid permanent closure.',
    message_type: 'sms',
    url: 'https://first-national-security-portal.xyz/login',
  },
  {
    id: 'benign-grocery',
    label: 'Sample (synthetic): Benign routine grocery notification',
    message:
      'Hi Alex, your weekly order summary from FreshMart is ready. Your delivery of groceries is scheduled for tomorrow between 2 PM and 4 PM. View your items in the FreshMart app if you need to make changes before 8 PM tonight.',
    message_type: 'email',
    url: '',
  },
  {
    id: 'ambiguous-doc',
    label: 'Sample (synthetic): Ambiguous document lure',
    message:
      'Hey, check out this document from the meeting earlier today. Let me know what you think when you get a chance.',
    message_type: 'other',
    url: 'https://docs.shared-drive-portal.net/doc/98231',
  },
];

export default function App() {
  // Backend connectivity state
  const [backendHealth, setBackendHealth] = useState('checking'); // 'checking' | 'connected' | 'offline'

  // Investigation Mode Switch: 'text' | 'screenshot'
  const [investigationMode, setInvestigationMode] = useState('text');

  // Text Form input state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('email');
  const [url, setUrl] = useState('');

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
  const [errorState, setErrorState] = useState(null); // { code, message }

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
  const handleSelectTextSample = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const sample = SYNTHETIC_TEXT_SAMPLES.find((s) => s.id === selectedId);
    if (sample) {
      setMessage(sample.message);
      setMessageType(sample.message_type);
      setUrl(sample.url);
      setErrorState(null);
    }
    e.target.value = '';
  };

  // Submit Text analysis request
  const executeTextAnalysis = async (msgText, msgType, urlText) => {
    if (!msgText.trim() || isLoading) return;

    setErrorState(null);
    setAnalysisResult(null);
    setMeta(null);
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
        }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        let friendlyMessage = data.error || 'Analysis request failed.';
        if (data.code === 'RATE_LIMITED') {
          friendlyMessage =
            'Model request quota or rate limit exceeded. Please wait a few moments before trying again.';
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

      if (window.innerWidth < 1024 && resultsTopRef.current) {
        resultsTopRef.current.scrollIntoView({ behavior: 'smooth' });
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
            'Image analysis request rate limit reached. Please wait a few minutes before submitting another image.';
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
      setImageResultTab('model_read');

      if (window.innerWidth < 1024 && resultsTopRef.current) {
        resultsTopRef.current.scrollIntoView({ behavior: 'smooth' });
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

  // Cancel in-flight request
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Reset workspace
  const handleReset = () => {
    setMessage('');
    setUrl('');
    setMessageType('email');
    setSelectedImageFile(null);
    setContextNote('');
    setSubmittedSnapshot({ message: '', url: '', messageType: 'email', imageUrl: null });
    setAnalysisResult(null);
    setMeta(null);
    setErrorState(null);
    setActiveIndicatorIndex(null);
  };

  // Cross-linking: Highlight clicked -> scroll & focus card
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

  // Cross-linking: Card button clicked -> scroll & focus highlight
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

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-[#fdfbf7] flex flex-col justify-between p-4 sm:p-8 selection:bg-teal-500/20">
      {/* 1. Header */}
      <header className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-slate-900 border border-white/10 shadow-sm flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fdfbf7]">
                LinkSleuth
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-[6px] bg-teal-950/60 text-teal-300 border border-teal-500/30">
                Phase 5: Multimodal Screenshot
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Defensive Phishing &amp; Social Engineering Investigation Workspace
            </p>
          </div>
        </div>

        {/* Backend Connectivity Status Chip */}
        <div className="flex items-center">
          {backendHealth === 'checking' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700"
              role="status"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-hidden="true" />
              <span>Checking backend...</span>
            </div>
          )}

          {backendHealth === 'connected' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-500/30"
              role="status"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Connected</span>
            </div>
          )}

          {backendHealth === 'offline' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-rose-950/70 text-rose-300 border border-rose-500/30"
              role="status"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              <span>Backend Offline</span>
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

      {/* 2. Main Content Grid (Two-column on lg+, stacked on mobile) */}
      <main className="max-w-6xl mx-auto w-full my-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input Workspace / Inspection Viewer (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Investigation Mode Selector Tabs */}
          <div
            role="tablist"
            aria-label="Investigation Input Mode"
            className="grid grid-cols-2 p-1 rounded-[8px] bg-slate-900 border border-white/10 text-xs font-medium"
          >
            <button
              type="button"
              role="tab"
              id="tab-text"
              aria-selected={investigationMode === 'text'}
              aria-controls="panel-text"
              onClick={() => setInvestigationMode('text')}
              className={`flex items-center justify-center gap-2 py-2 rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer ${
                investigationMode === 'text'
                  ? 'bg-teal-950/80 text-teal-200 border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Text Message</span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-screenshot"
              aria-selected={investigationMode === 'screenshot'}
              aria-controls="panel-screenshot"
              onClick={() => setInvestigationMode('screenshot')}
              className={`flex items-center justify-center gap-2 py-2 rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer ${
                investigationMode === 'screenshot'
                  ? 'bg-teal-950/80 text-teal-200 border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Screenshot / Image</span>
            </button>
          </div>

          {/* Submission Input Section */}
          <section
            className="bg-[#111827] border border-white/10 rounded-[10px] p-5 backdrop-blur-sm flex flex-col gap-4 shadow-sm"
            aria-labelledby="input-heading"
          >
            {investigationMode === 'text' ? (
              /* Text Input Mode */
              <>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <h2 id="input-heading" className="text-sm font-semibold text-[#fdfbf7]">
                    Message Submission
                  </h2>

                  <div className="relative w-full sm:w-auto max-w-full sm:max-w-xs">
                    <label htmlFor="sample-selector" className="sr-only">
                      Load synthetic sample input
                    </label>
                    <select
                      id="sample-selector"
                      onChange={handleSelectTextSample}
                      defaultValue=""
                      className="w-full text-xs bg-slate-900 border border-white/15 rounded-[6px] px-2.5 py-1.5 text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer truncate"
                    >
                      <option value="" disabled>
                        Load sample input (synthetic)...
                      </option>
                      {SYNTHETIC_TEXT_SAMPLES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <form onSubmit={handleTextSubmit} className="flex flex-col gap-4">
                  {/* Message Type Selector */}
                  <fieldset>
                    <legend className="text-xs font-medium text-slate-300 mb-1.5">
                      Message Medium:
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'type-email', val: 'email', label: 'Email' },
                        { id: 'type-sms', val: 'sms', label: 'SMS / Text' },
                        { id: 'type-other', val: 'other', label: 'Other' },
                      ].map((item) => (
                        <label
                          key={item.val}
                          htmlFor={item.id}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-[8px] border text-xs font-medium cursor-pointer transition-colors ${
                            messageType === item.val
                              ? 'bg-teal-950/70 border-teal-500/50 text-teal-200'
                              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
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
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="message-input" className="text-xs font-medium text-slate-300">
                        Message Content: <span className="text-rose-400" aria-hidden="true">*</span>
                      </label>
                      <span
                        id="char-count"
                        className={`text-[11px] font-mono ${
                          message.length > 14000 ? 'text-amber-400 font-bold' : 'text-slate-400'
                        }`}
                        aria-live="polite"
                      >
                        {message.length.toLocaleString()} / 15,000
                      </span>
                    </div>
                    <textarea
                      id="message-input"
                      name="message"
                      rows={6}
                      maxLength={15000}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Paste the suspicious email, text message, or notification body here..."
                      className="w-full bg-slate-900/90 border border-white/15 rounded-[8px] p-3 text-sm text-[#fdfbf7] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 resize-y"
                      aria-describedby="message-hint char-count"
                    />
                    <span id="message-hint" className="sr-only">
                      Enter up to 15000 characters of untrusted message text to analyze.
                    </span>
                  </div>

                  {/* Optional URL Input */}
                  <div>
                    <label htmlFor="url-input" className="block text-xs font-medium text-slate-300 mb-1">
                      Embedded URL (Optional):
                    </label>
                    <input
                      type="text"
                      id="url-input"
                      name="url"
                      maxLength={2048}
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example-link.com/login"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className="w-full bg-slate-900/90 border border-white/15 rounded-[8px] px-3 py-2 text-sm text-[#fdfbf7] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                      aria-describedby="url-hint"
                    />
                    <p id="url-hint" className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                      <Info className="w-3 h-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
                      <span>URLs are stored only as reference text and are never fetched or visited.</span>
                    </p>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="submit"
                      disabled={isLoading || !message.trim()}
                      className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 px-4 rounded-[8px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          <span>Analyzing with Gemma 4... ({elapsedSeconds}s)</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" aria-hidden="true" />
                          <span>Analyze Content</span>
                        </>
                      )}
                    </button>

                    {isLoading ? (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-3.5 py-2.5 rounded-[8px] border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/40 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer"
                      >
                        Cancel
                      </button>
                    ) : (
                      (message || analysisResult || errorState) && (
                        <button
                          type="button"
                          onClick={handleReset}
                          title="Reset workspace"
                          className="p-2.5 rounded-[8px] border border-white/10 bg-slate-900 text-slate-400 hover:text-white hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                          <span className="sr-only">Reset workspace</span>
                        </button>
                      )
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
              />
            )}
          </section>

          {/* Inspection View (renders below form when analysis results exist) */}
          {!isLoading && analysisResult && (
            <section
              className="bg-[#111827] border border-white/10 rounded-[10px] p-5 shadow-sm"
              aria-labelledby="inspection-heading"
            >
              {isImageAnalysis ? (
                /* Image Analysis Result Viewer: Preview Tab | Model Read Tab */
                <div className="flex flex-col gap-3">
                  <div
                    role="tablist"
                    aria-label="Screenshot inspection view options"
                    className="flex items-center gap-2 border-b border-white/10 pb-2.5"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={imageResultTab === 'model_read'}
                      onClick={() => setImageResultTab('model_read')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                        imageResultTab === 'model_read'
                          ? 'bg-teal-950/80 text-teal-200 border border-teal-500/40'
                          : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-white/5'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>What the model read</span>
                    </button>

                    {submittedSnapshot.imageUrl && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={imageResultTab === 'preview'}
                        onClick={() => setImageResultTab('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                          imageResultTab === 'preview'
                            ? 'bg-teal-950/80 text-teal-200 border border-teal-500/40'
                            : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-white/5'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Screenshot Preview</span>
                      </button>
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
                    <div className="flex flex-col items-center justify-center p-2 rounded-[8px] bg-slate-900 border border-white/10">
                      <img
                        src={submittedSnapshot.imageUrl}
                        alt="Submitted screenshot"
                        className="max-h-[380px] w-auto object-contain rounded"
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
            </section>
          )}
        </div>

        {/* Right Column: Investigation Findings & Evidence (7 cols on lg) */}
        <div ref={resultsTopRef} className="lg:col-span-7 flex flex-col gap-5">
          {/* Section Heading & Copy Report Button */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Investigation Findings
              </h2>
            </div>

            {analysisResult && (
              <CopyReportButton
                analysis={analysisResult}
                meta={meta}
                submittedMessage={submittedSnapshot.message}
                submittedUrl={submittedSnapshot.url}
              />
            )}
          </div>

          {/* State 1: Loading Skeleton */}
          {isLoading && (
            <section
              className="rounded-[10px] border border-white/10 bg-[#111827] p-6 flex flex-col items-center justify-center text-center gap-4 py-16"
              aria-live="polite"
              aria-label="Analysis in progress"
            >
              <Loader2 className="w-10 h-10 animate-spin text-teal-400" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-[#fdfbf7]">
                  Performing Defensive Security Analysis
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {investigationMode === 'screenshot'
                    ? 'Gemma 4 is transcribing visual content, extracting visible links, and evaluating deceptive lures...'
                    : 'Gemma 4 is inspecting structural anomalies, social engineering lures, and grounded evidence...'}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-[6px] bg-slate-900 border border-white/10 text-xs font-mono text-teal-300">
                  <span>Elapsed: {elapsedSeconds}s</span>
                </div>
              </div>

              {/* Skeleton Bars */}
              <div className="w-full max-w-md space-y-2.5 mt-4 opacity-50" aria-hidden="true">
                <div className="h-4 bg-slate-800 rounded animate-pulse" />
                <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse" />
                <div className="h-4 bg-slate-800 rounded w-4/6 animate-pulse" />
              </div>
            </section>
          )}

          {/* State 2: Error Alert Card */}
          {!isLoading && errorState && (
            <section
              className="rounded-[10px] border border-rose-500/40 bg-rose-950/40 p-5 text-rose-200 flex flex-col gap-3"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-rose-300">
                    Analysis Error: {errorState.code}
                  </h3>
                  <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                    {errorState.message}
                  </p>
                </div>
              </div>

              {errorState.code !== 'CANCELLED' && (
                <div className="pt-2 border-t border-rose-500/20 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (investigationMode === 'screenshot') {
                        executeScreenshotAnalysis();
                      } else {
                        executeTextAnalysis(message, messageType, url);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Retry Analysis</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* State 3: Empty State */}
          {!isLoading && !errorState && !analysisResult && (
            <section className="rounded-[10px] border border-white/10 bg-[#111827] p-8 flex flex-col items-center justify-center text-center text-slate-400 min-h-[360px]">
              <div className="p-3.5 rounded-[10px] bg-slate-900 border border-white/10 mb-3.5">
                <ShieldAlert className="w-8 h-8 text-slate-400" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                Awaiting Submission
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                {investigationMode === 'screenshot'
                  ? 'Upload a screenshot or load a synthetic sample on the left to evaluate for fake login portals, smishing bubbles, and deceptive design patterns.'
                  : 'Paste an untrusted message or load a synthetic sample on the left to evaluate for social engineering, urgency lures, and phishing markers.'}
              </p>
            </section>
          )}

          {/* State 4: Active Results Display */}
          {!isLoading && !errorState && analysisResult && (
            <div className="flex flex-col gap-5">
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

              {/* 3. Evidence Cards List */}
              <section
                className="flex flex-col gap-3"
                aria-labelledby="indicators-heading"
              >
                <div className="flex items-center justify-between">
                  <h3
                    id="indicators-heading"
                    className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
                  >
                    Identified Indicators ({sortedIndicators.length})
                  </h3>
                  {meta?.unverified_evidence_count > 0 && (
                    <span className="text-[11px] text-amber-300 font-medium bg-amber-950/70 px-2 py-0.5 rounded-[6px] border border-amber-500/40">
                      ⚠️ {meta.unverified_evidence_count} unverified quote(s)
                    </span>
                  )}
                </div>

                {sortedIndicators.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-[#111827] p-4 rounded-[10px] border border-white/10">
                    No deceptive or malicious indicators detected in the submission.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
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
      </main>

      {/* 3. Footer */}
      <footer className="max-w-6xl mx-auto w-full border-t border-white/10 pt-4 mt-6 text-center text-xs text-slate-400">
        LinkSleuth &bull; Defensive Security Investigation Workspace &bull; MIT License
      </footer>
    </div>
  );
}
