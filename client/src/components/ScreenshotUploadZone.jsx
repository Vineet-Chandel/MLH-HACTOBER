import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';

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
    // If not an image, resolve with original
    if (!file.type.startsWith('image/')) {
      return resolve({ processedFile: file, originalSize: file.size, finalSize: file.size, downscaled: false });
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;

      // If dimensions are within bounds, keep original
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

      // Calculate scaled dimensions keeping aspect ratio
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
            // If downscaling somehow yielded a larger file, keep original
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
}) {
  const [dragActive, setDragActive] = useState(false);
  const [fileMeta, setFileMeta] = useState(null); // { originalSize, finalSize, downscaled }
  const [previewUrl, setPreviewUrl] = useState(null);
  const [clientError, setClientError] = useState(null);

  const fileInputRef = useRef(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle incoming file selection
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

    // Process & downscale if larger than 1600px
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
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setFileMeta(null);
    setClientError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Load synthetic sample screenshot
  const handleSelectSampleScreenshot = async (e) => {
    const sampleId = e.target.value;
    if (!sampleId) return;

    const sample = SYNTHETIC_IMAGE_SAMPLES.find((s) => s.id === sampleId);
    if (sample) {
      try {
        const res = await fetch(sample.url);
        const blob = await res.blob();
        const file = new File([blob], sample.filename, { type: 'image/png' });
        setMessageType(sample.message_type);
        setContextNote(sample.context_note);
        await handleFile(file);
      } catch {
        setClientError('Unable to load synthetic sample screenshot.');
      }
    }
    e.target.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile || isLoading) return;
    onAnalyze();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Sample Selector & Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Screenshot Upload
        </span>

        <div className="relative w-full sm:w-auto max-w-full sm:max-w-xs">
          <label htmlFor="sample-screenshot-selector" className="sr-only">
            Load sample screenshot
          </label>
          <select
            id="sample-screenshot-selector"
            onChange={handleSelectSampleScreenshot}
            defaultValue=""
            className="w-full text-xs bg-slate-900 border border-white/15 rounded-[6px] px-2.5 py-1.5 text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer truncate"
          >
            <option value="" disabled>
              Load sample screenshot (synthetic)...
            </option>
            {SYNTHETIC_IMAGE_SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload Zone / Dropzone or File Preview Card */}
      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`border-2 border-dashed rounded-[10px] p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2.5 ${
            dragActive
              ? 'border-teal-400 bg-teal-950/20'
              : 'border-white/15 hover:border-teal-500/50 bg-slate-900/60'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400`}
          aria-label="Upload screenshot dropzone. Click or drag and drop an image."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="sr-only"
            aria-hidden="true"
          />

          <div className="p-3 rounded-full bg-slate-800 text-teal-400">
            <UploadCloud className="w-6 h-6" aria-hidden="true" />
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-200">
              Drag &amp; drop screenshot here, or <span className="text-teal-400 underline">browse</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Supports PNG, JPEG, and WebP (Max 5 MB)
            </div>
          </div>
        </div>
      ) : (
        /* Image Preview & Details Card */
        <div className="rounded-[10px] border border-white/10 bg-slate-900/80 p-3.5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {previewUrl && (
              <div className="w-16 h-16 rounded-[6px] overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Screenshot preview thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 min-w-0 text-xs">
              <div className="font-semibold text-slate-200 truncate" title={fileMeta?.name}>
                {fileMeta?.name}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Size: {formatBytes(fileMeta?.finalSize || selectedFile.size)}
                {fileMeta?.downscaled && (
                  <span className="ml-1.5 text-teal-300 font-mono">
                    (downscaled from {formatBytes(fileMeta.originalSize)})
                  </span>
                )}
              </div>
              {fileMeta?.width && fileMeta?.height && (
                <div className="text-[10px] font-mono text-slate-400">
                  {fileMeta.width} &times; {fileMeta.height} px
                </div>
              )}
            </div>

            {/* Remove / Replace Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Replace image"
                className="p-1.5 rounded-[6px] text-slate-400 hover:text-white hover:bg-slate-800 border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sr-only">Replace screenshot</span>
              </button>

              <button
                type="button"
                onClick={handleRemove}
                disabled={isLoading}
                title="Remove image"
                className="p-1.5 rounded-[6px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sr-only">Remove screenshot</span>
              </button>
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
        <div className="p-2.5 rounded-[8px] bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" aria-hidden="true" />
          <span>{clientError}</span>
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div className="p-3 rounded-[8px] bg-slate-900 border border-teal-500/20 text-[11px] text-slate-300 flex items-start gap-2.5 leading-relaxed">
        <Shield className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong className="text-slate-200">Privacy Notice:</strong> Your screenshot is sent to the analysis model in memory and is <em>never saved to disk</em> by LinkSleuth. Please crop or redact real names, account numbers, and personal info before uploading.
        </p>
      </div>

      {/* Context Note Field (Optional, max 500 chars) */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="context-note-input" className="text-xs font-medium text-slate-300">
            Anything we should know? <span className="text-slate-400 font-normal">(Optional context)</span>
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            {contextNote.length} / 500
          </span>
        </div>
        <textarea
          id="context-note-input"
          rows={2}
          maxLength={500}
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          placeholder="e.g. Received via text from an unknown number; claiming to be my credit union..."
          className="w-full bg-slate-900/90 border border-white/15 rounded-[8px] p-2.5 text-xs text-[#fdfbf7] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 resize-y"
        />
        <p className="mt-1 text-[11px] text-slate-400 italic">
          Context notes are treated as unverified user context, never as ground truth.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isLoading || !selectedFile}
          className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 px-4 rounded-[8px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Analyzing Screenshot with Gemma 4... ({elapsedSeconds}s)</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Analyze Screenshot</span>
            </>
          )}
        </button>

        {isLoading && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2.5 rounded-[8px] border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/40 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
