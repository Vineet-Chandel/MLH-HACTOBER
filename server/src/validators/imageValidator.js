/**
 * Image Validation Service
 * Inspects real file magic bytes (signatures) and header dimensions.
 * Never trusts client-declared MIME type or file extension.
 */

export class ImageValidationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ImageValidationError';
    this.code = code;
    this.status = status;
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

/**
 * Detects real MIME type from buffer magic bytes.
 * @param {Buffer} buffer
 * @returns {'image/png' | 'image/jpeg' | 'image/webp' | null}
 */
export function detectMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // 1. Check PNG (8 bytes)
  let isPng = true;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (buffer[i] !== PNG_SIGNATURE[i]) {
      isPng = false;
      break;
    }
  }
  if (isPng) return 'image/png';

  // 2. Check JPEG (3 bytes)
  let isJpeg = true;
  for (let i = 0; i < JPEG_SIGNATURE.length; i++) {
    if (buffer[i] !== JPEG_SIGNATURE[i]) {
      isJpeg = false;
      break;
    }
  }
  if (isJpeg) return 'image/jpeg';

  // 3. Check WebP (RIFF....WEBP)
  let isRiff = true;
  for (let i = 0; i < 4; i++) {
    if (buffer[i] !== RIFF_SIGNATURE[i]) {
      isRiff = false;
      break;
    }
  }
  if (isRiff) {
    let isWebp = true;
    for (let i = 0; i < 4; i++) {
      if (buffer[8 + i] !== WEBP_SIGNATURE[i]) {
        isWebp = false;
        break;
      }
    }
    if (isWebp) return 'image/webp';
  }

  return null;
}

/**
 * Parses image dimensions (width, height) from image headers without external dependencies.
 * @param {Buffer} buffer
 * @param {'image/png' | 'image/jpeg' | 'image/webp'} mimeType
 * @returns {{ width: number, height: number } | null}
 */
export function parseImageDimensions(buffer, mimeType) {
  try {
    if (mimeType === 'image/png' && buffer.length >= 24) {
      // PNG IHDR chunk starts at byte 12. Width at 16, height at 20 (UInt32BE)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    if (mimeType === 'image/jpeg') {
      let offset = 2; // skip SOI (0xFFD8)
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];

        // SOF markers: 0xC0 to 0xCF except 0xC4, 0xC8, 0xCC
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);

        if (isSOF) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }

        // Advance by chunk length
        const chunkLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + chunkLen;
      }
    }

    if (mimeType === 'image/webp' && buffer.length >= 30) {
      const chunkHeader = buffer.toString('ascii', 12, 16);
      if (chunkHeader === 'VP8 ') {
        // VP8 lossy: width at byte 26, height at byte 28 (14-bit uint LE)
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      } else if (chunkHeader === 'VP8L') {
        // VP8L lossless
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width, height };
      } else if (chunkHeader === 'VP8X' && buffer.length >= 30) {
        // VP8X extended: 24-bit width at byte 24, 24-bit height at byte 27
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
        return { width, height };
      }
    }
  } catch {
    // If dimension parsing fails on non-standard chunking, ignore
  }

  return null;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION_PX = 8000;

/**
 * Validates uploaded image buffer: size, magic bytes, and dimensions.
 *
 * @param {Object} file Multer file object
 * @returns {{ mimeType: 'image/png' | 'image/jpeg' | 'image/webp', width?: number, height?: number }}
 */
export function validateImageFile(file) {
  if (!file || !file.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new ImageValidationError('INVALID_INPUT', 'An image file is required.', 400);
  }

  if (file.buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ImageValidationError(
      'FILE_TOO_LARGE',
      'Image exceeds the maximum allowed size of 5 MB.',
      413
    );
  }

  // Detect real MIME type from magic bytes
  const realMime = detectMagicBytes(file.buffer);
  if (!realMime) {
    throw new ImageValidationError(
      'INVALID_FILE_TYPE',
      'Invalid file format. Only PNG, JPEG, and WebP images are supported.',
      415
    );
  }

  // Check dimensions if available
  const dims = parseImageDimensions(file.buffer, realMime);
  if (dims) {
    if (dims.width > MAX_DIMENSION_PX || dims.height > MAX_DIMENSION_PX) {
      throw new ImageValidationError(
        'INVALID_INPUT',
        `Image dimensions exceed maximum supported size of ${MAX_DIMENSION_PX}x${MAX_DIMENSION_PX} pixels.`,
        400
      );
    }
    if (dims.width <= 0 || dims.height <= 0) {
      throw new ImageValidationError(
        'INVALID_INPUT',
        'Image has invalid dimensions.',
        400
      );
    }
    return { mimeType: realMime, width: dims.width, height: dims.height };
  }

  return { mimeType: realMime };
}
