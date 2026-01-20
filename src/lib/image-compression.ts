/**
 * Image compression utilities to ensure images stay under backend limits.
 * The workflow backend has a 1024KB limit per form-data part.
 */

const MAX_SIZE_KB = 900; // Target under 1024KB with safety margin

interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

/**
 * Compress an image blob to stay under the max size limit.
 * Uses canvas to resize and JPEG compression.
 */
export async function compressImageBlob(
  blob: Blob,
  maxSizeKB: number = MAX_SIZE_KB
): Promise<CompressionResult> {
  const originalSize = blob.size;
  const maxBytes = maxSizeKB * 1024;

  // If already under limit, return as-is
  if (blob.size <= maxBytes) {
    return {
      blob,
      originalSize,
      compressedSize: blob.size,
      wasCompressed: false,
    };
  }

  console.log(`[Compression] Image size ${(blob.size / 1024).toFixed(1)}KB exceeds limit, compressing...`);

  // Load image to get dimensions
  const img = await loadImage(blob);
  
  // Calculate scale factor needed
  // Start with quality compression, then resize if needed
  let quality = 0.85;
  let scale = 1.0;
  let compressedBlob = blob;
  
  // Try quality reduction first (faster)
  for (let attempt = 0; attempt < 5 && compressedBlob.size > maxBytes; attempt++) {
    compressedBlob = await compressWithQuality(img, scale, quality);
    console.log(`[Compression] Attempt ${attempt + 1}: quality=${quality.toFixed(2)}, scale=${scale.toFixed(2)}, size=${(compressedBlob.size / 1024).toFixed(1)}KB`);
    
    if (compressedBlob.size > maxBytes) {
      if (quality > 0.5) {
        quality -= 0.1;
      } else {
        // Quality reduction not enough, start scaling down
        scale *= 0.8;
        quality = 0.85; // Reset quality for new size
      }
    }
  }

  // Final check - if still too large, keep reducing scale
  while (compressedBlob.size > maxBytes && scale > 0.2) {
    scale *= 0.7;
    quality = Math.max(0.6, quality);
    compressedBlob = await compressWithQuality(img, scale, quality);
    console.log(`[Compression] Resize: scale=${scale.toFixed(2)}, size=${(compressedBlob.size / 1024).toFixed(1)}KB`);
  }

  console.log(`[Compression] Complete: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedBlob.size / 1024).toFixed(1)}KB`);

  return {
    blob: compressedBlob,
    originalSize,
    compressedSize: compressedBlob.size,
    wasCompressed: true,
  };
}

/**
 * Compress a data URL image and return as blob.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxSizeKB: number = MAX_SIZE_KB
): Promise<CompressionResult> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return compressImageBlob(blob, maxSizeKB);
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

function compressWithQuality(
  img: HTMLImageElement,
  scale: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Cannot create canvas context'));
      return;
    }

    const newWidth = Math.round(img.width * scale);
    const newHeight = Math.round(img.height * scale);

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Use better quality interpolation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Convert an image source (data URL, blob URL, or asset path) to a Blob
 */
export async function imageSourceToBlob(source: string): Promise<Blob> {
  // If it's already a blob URL or data URL, fetch it
  if (source.startsWith('blob:') || source.startsWith('data:')) {
    const response = await fetch(source);
    return response.blob();
  }
  
  // For asset paths (imported images), we need to fetch them
  const response = await fetch(source);
  return response.blob();
}
