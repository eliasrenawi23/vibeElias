import type { AllowedUploadMimeType } from '@renawi/shared';
import sharp from 'sharp';

/** Upload type detected from the file's magic bytes. */
export interface SniffedFileType {
  mime: AllowedUploadMimeType;
  ext: 'pdf' | 'jpg' | 'png' | 'webp';
  isImage: boolean;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(buf: Buffer, bytes: Buffer | string, offset = 0): boolean {
  const sig = typeof bytes === 'string' ? Buffer.from(bytes, 'latin1') : bytes;
  return buf.length >= offset + sig.length && buf.subarray(offset, offset + sig.length).equals(sig);
}

/**
 * Detects PDF / JPEG / PNG / WebP from the first bytes of the content (the declared
 * Content-Type and the file extension are ignored). Returns null for anything else.
 */
export function sniffFileType(buf: Buffer): SniffedFileType | null {
  if (startsWith(buf, '%PDF-')) return { mime: 'application/pdf', ext: 'pdf', isImage: false };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg', isImage: true };
  }
  if (startsWith(buf, PNG_SIGNATURE)) return { mime: 'image/png', ext: 'png', isImage: true };
  if (startsWith(buf, 'RIFF') && startsWith(buf, 'WEBP', 8)) {
    return { mime: 'image/webp', ext: 'webp', isImage: true };
  }
  return null;
}

/** Longest side of a thumbnail, in pixels. */
export const THUMB_MAX_PX = 320;

/**
 * WebP thumbnail (max 320 px on the longest side, EXIF orientation applied, never enlarged).
 * Rejects when the image cannot be decoded.
 */
export function makeThumbnail(image: Buffer): Promise<Buffer> {
  return sharp(image)
    .rotate()
    .resize({
      width: THUMB_MAX_PX,
      height: THUMB_MAX_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 78 })
    .toBuffer();
}
