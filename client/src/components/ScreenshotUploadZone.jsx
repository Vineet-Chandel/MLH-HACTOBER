import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  UploadCloud,
  Image as ImageIcon,
  X,
  RefreshCw,
  AlertTriangle,
  Info,
  Loader2,
  Send,
  Shield,
  FileCheck,
  ArrowRight,
  Languages,
} from 'lucide-react';
import NeoButton from './NeoButton.jsx';
import NeoSelect from './NeoSelect.jsx';
import NeoDropdownModal from './NeoDropdownModal.jsx';

const SYNTHETIC_IMAGE_SAMPLES = [
  {
    id: 'sample-bank',
    label: 'Sample (synthetic): Suspicious bank SMS screenshot',
    url: '/samples/sample-bank-sms.png',
    filename: 'sample-bank-sms.png',
    message_type: 'sms',
    context_note: 'SMS received unexpectedly on personal mobile device',
  },
  {
    id: 'sample-delivery',
    label: 'Sample (synthetic): Benign grocery delivery notification',
    url: '/samples/sample-delivery.png',
    filename: 'sample-delivery.png',
    message_type: 'email',
    context_note: 'Order confirmation notification',
  },
  {
    id: 'sample-ambiguous',
    label: 'Sample (synthetic): Ambiguous document share message',
    url: '/samples/sample-ambiguous.png',
    filename: 'sample-ambiguous.png',
    message_type: 'other',
    context_note: 'Direct message from colleague without prior meeting mention',
  },
];

/**
 * Client-side downscaling helper using HTML5 Canvas.
 * Downscales images exceeding maxDimension on their longest edge.
 */
async function processImageFile(file, maxDimension = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      return resolve({ processedFile: file, originalSize: file.size, finalSize: file.size, downscaled: false });
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;

      if (width <= maxDimension && height <= maxDimension) {
        return resolve({
          processedFile: file,
          originalSize: file.size,
          finalSize: file.size,
          downscaled: false,
          width,
          height,
        });
      }

      let newWidth = width;
      let newHeight = height;
      if (width > height) {
        newWidth = maxDimension;
        newHeight = Math.round((height * maxDimension) / width);
      } else {
        newHeight = maxDimension;
        newWidth = Math.round((width * maxDimension) / height);
      }

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            return resolve({
              processedFile: file,
              originalSize: file.size,
              finalSize: file.size,
              downscaled: false,
              width,
              height,
            });
          }

          const scaledFile = new File([blob], file.name, { type: targetMime });
          resolve({
            processedFile: scaledFile,
            originalSize: file.size,
            finalSize: blob.size,
            downscaled: true,
            width: newWidth,
            height: newHeight,
          });
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ processedFile: file, originalSize: file.size, finalSize: file.size, downscaled: false });
    };

    img.src = objectUrl;
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ScreenshotUploadZone({
  onAnalyze,
  isLoading,
  elapsedSeconds,
  onCancel,
  selectedFile,
  setSelectedFile,
  contextNote,
  setContextNote,
  messageType,
  setMessageType,
  claimedOrg = '',
  setClaimedOrg,
  outputLanguage = 'match',
  setOutputLanguage,
  userState = 'none',
  setUserState,
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [clientError, setClientError] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFile = async (rawFile) => {
    setClientError(null);
    if (!rawFile) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(rawFile.type)) {
      setClientError('Invalid file format. Please upload a PNG, JPEG, or WebP screenshot.');
      return;
    }

    if (rawFile.size > 5 * 1024 * 1024) {
      setClientError('File exceeds 5 MB limit. Please select a smaller screenshot.');
      return;
    }

    const result = await processImageFile(rawFile, 1600, 0.85);

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const newPreviewUrl = URL.createObjectURL(result.processedFile);
    setPreviewUrl(newPreviewUrl);
    setSelectedFile(result.processedFile);
    setFileMeta({
      name: rawFile.name,
      originalSize: result.originalSize,
      finalSize: result.finalSize,
      downscaled: result.downscaled,
      width: result.width,
      height: result.height,
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    setSelectedScenario(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setFileMeta(null);
    setClientError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectSampleScreenshot = async (sampleOrEvent, autoAnalyze = true) => {
    const sample = sampleOrEvent?.id
      ? sampleOrEvent
      : SYNTHETIC_IMAGE_SAMPLES.find((s) => s.id === sampleOrEvent?.target?.value);
    if (!sample) return;

    setSelectedScenario(sample);
    try {
      const res = await fetch(sample.url);
      const blob = await res.blob();
      const file = new File([blob], sample.filename, { type: 'image/png' });
      await handleFile(file);
      if (sample.message_type && setMessageType) {
        setMessageType(sample.message_type);
      }
      if (sample.context_note && setContextNote) {
        setContextNote(sample.context_note);
      }
      if (autoAnalyze && onAnalyze) {
        setTimeout(() => {
          onAnalyze?.();
        }, 150);
      }
    } catch {
      setClientError('Failed to load sample image file.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile || isLoading) return;
    onAnalyze?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Sample Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b-2 border-neutral-100 pb-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
            Screenshot Submission
          </h2>
          <span className="text-[10px] font-mono text-neutral-500 font-semibold">
            Evaluate fake portals, smishing &amp; UI spoofing
          </span>
        </div>

        <div className="relative w-full sm:w-auto max-w-full sm:max-w-xs">
          <NeoDropdownModal
            id="image-sample-selector"
            title="Synthetic Screenshot Scenarios"
            subtitle="Evaluate visual spoofing, smishing, and fake login lures"
            triggerLabel="Load sample image..."
            selectedScenario={selectedScenario}
            badgeText={`${SYNTHETIC_IMAGE_SAMPLES.length} Samples`}
            icon={ImageIcon}
            samples={SYNTHETIC_IMAGE_SAMPLES}
            type="image"
            onSelect={handleSelectSampleScreenshot}
            onClear={handleRemove}
          />
        </div>
      </div>

      {/* Active Screenshot Scenario Banner */}
      {selectedScenario && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[#8bfb34]/20 border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-bold"
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            <div className="p-1 rounded bg-[#8bfb34] border border-black text-black flex-shrink-0">
              <ImageIcon className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span className="text-neutral-600 flex-shrink-0">Loaded Scenario:</span>
            <span className="text-black font-black truncate">{selectedScenario.label}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleRemove}
              className="px-2.5 py-1 rounded-md border border-black bg-white hover:bg-neutral-100 text-[11px] font-bold cursor-pointer transition-colors shadow-[1px_1px_0px_#000]"
            >
              Clear (Custom)
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onAnalyze?.()}
              className="px-2.5 py-1 rounded-md border border-black bg-[#8bfb34] hover:bg-[#7ce62c] text-black text-[11px] font-black cursor-pointer shadow-[1px_1px_0px_#000] disabled:opacity-50"
            >
              Re-Analyze →
            </button>
          </div>
        </motion.div>
      )}

      {/* Drag & Drop Zone */}
      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center select-none ${
            dragActive
              ? 'border-black bg-[#8bfb34]/20 shadow-[4px_4px_0px_#000000]'
              : 'border-black bg-[#faf8f3] hover:bg-[#8bfb34]/10 shadow-[3px_3px_0px_#000000]'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload screenshot file dropzone"
        >
          <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000000] mb-3">
            <UploadCloud className="w-8 h-8 text-black" aria-hidden="true" />
          </div>

          <div className="text-sm font-black text-neutral-900">
            Click to upload or drag &amp; drop
          </div>
          <p className="text-xs text-neutral-600 mt-1 font-semibold">
            PNG, JPEG, or WebP (max 5 MB)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="sr-only"
            aria-hidden="true"
          />
        </div>
      ) : (
        /* Preview Card */
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-black bg-white p-3.5 shadow-[4px_4px_0px_#000000]">
          <div className="flex items-center gap-3">
            {previewUrl && (
              <div className="w-16 h-16 rounded-xl border-2 border-black overflow-hidden flex-shrink-0 bg-neutral-100 shadow-[1px_1px_0px_#000]">
                <img
                  src={previewUrl}
                  alt="Screenshot preview thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 min-w-0 text-xs">
              <div className="font-black text-neutral-900 truncate" title={fileMeta?.name}>
                {fileMeta?.name}
              </div>
              <div className="text-xs text-neutral-600 font-medium mt-0.5">
                Size: {formatBytes(fileMeta?.finalSize || selectedFile.size)}
                {fileMeta?.downscaled && (
                  <span className="ml-1.5 text-black font-bold font-mono">
                    (downscaled)
                  </span>
                )}
              </div>
              {fileMeta?.width && fileMeta?.height && (
                <div className="text-[10px] font-mono font-bold text-neutral-500">
                  {fileMeta.width} &times; {fileMeta.height} px
                </div>
              )}
            </div>

            {/* Remove / Replace Actions */}
            <div className="flex items-center gap-2">
              <NeoButton
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Replace image"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              </NeoButton>

              <NeoButton
                size="sm"
                variant="danger"
                onClick={handleRemove}
                disabled={isLoading}
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </NeoButton>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="sr-only"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Client Validation Error */}
      {clientError && (
        <div className="p-3 rounded-xl bg-[#fee2e2] border-2 border-black text-[#991b1b] text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#000]">
          <AlertTriangle className="w-4 h-4 text-[#ef4444] flex-shrink-0" aria-hidden="true" />
          <span>{clientError}</span>
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-xl bg-[#faf8f3] border-2 border-black text-xs text-neutral-800 flex items-start gap-2.5 leading-relaxed shadow-[2px_2px_0px_#000]">
        <Shield className="w-4 h-4 text-black flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong className="text-black font-extrabold">Privacy Notice:</strong> Your screenshot is processed in memory and <em>never saved to disk</em>. Please crop or redact personal identification numbers before analyzing.
        </p>
      </div>

      {/* Claimed Org Field */}
      <div>
        <label htmlFor="image-claimed-org-input" className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
          Who does this message claim to be from? <span className="text-neutral-400 font-normal lowercase">(optional)</span>
        </label>
        <input
          type="text"
          id="image-claimed-org-input"
          maxLength={100}
          value={claimedOrg}
          onChange={(e) => setClaimedOrg?.(e.target.value)}
          placeholder="e.g. State Bank of India, Amazon, WhatsApp"
          className="w-full bg-white border-2 border-black rounded-xl px-3.5 py-2 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black shadow-[2px_2px_0px_#000]"
        />
      </div>

      {/* Context Note Field */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="context-note-input" className="text-xs font-black uppercase tracking-wider text-neutral-700">
            Context note: <span className="text-neutral-400 font-normal lowercase">(optional)</span>
          </label>
          <span className="text-xs font-mono font-bold text-neutral-500">
            {contextNote.length} / 500
          </span>
        </div>
        <textarea
          id="context-note-input"
          rows={2}
          maxLength={500}
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          placeholder="e.g. Received via text from unknown sender claiming urgent account freeze..."
          className="w-full bg-white border-2 border-black rounded-xl p-3 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black resize-y shadow-[2px_2px_0px_#000]"
        />
      </div>

      {/* Explain in Language Selector */}
      <NeoSelect
        id="image-output-lang-select"
        label="Explain in:"
        value={outputLanguage}
        onChange={(val) => setOutputLanguage?.(val)}
        icon={Languages}
        options={[
          {
            value: 'match',
            label: 'Match image content language',
            badge: 'Auto',
            description: 'Analyzes language of visual text tokens in the screenshot',
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
                name="image_user_state"
                value={item.val}
                checked={userState === item.val}
                onChange={(e) => setUserState?.(e.target.value)}
                className="sr-only"
              />
              <span className="text-xs">{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <NeoButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={isLoading || !selectedFile}
          className="flex-1"
        >
          {isLoading ? (
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Analyzing Screenshot... ({elapsedSeconds}s)</span>
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Analyze Screenshot</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          )}
        </NeoButton>

        {isLoading && (
          <NeoButton
            type="button"
            variant="danger"
            size="lg"
            onClick={onCancel}
          >
            Cancel
          </NeoButton>
        )}
      </div>
    </form>
  );
}
