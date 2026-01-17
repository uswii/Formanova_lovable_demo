/**
 * Frontend Mask Visualization Utility
 * 
 * Creates fidelity visualization by comparing input mask (user's marked jewelry)
 * vs output mask (detected jewelry in generated image).
 * 
 * Color coding:
 * - Green: Correct preservation (both masks agree)
 * - Blue: Extended area (output has jewelry where input didn't)
 * - Red: Shrunk area (input had jewelry that output lost)
 */

export interface FidelityMetrics {
  precision: number;
  recall: number;
  iou: number;
  growthRatio: number;
  areaInput: number;
  areaOutput: number;
}

/**
 * Load an image from a data URI or URL
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Get binary mask array from image (black pixels = jewelry = true)
 * Handles inverted masks where white = jewelry
 */
function getMaskArray(imageData: ImageData, invert: boolean = false): boolean[] {
  const data = imageData.data;
  const result: boolean[] = [];
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    
    // Black pixels (< 128) are jewelry
    const isJewelry = brightness < 128;
    result.push(invert ? !isJewelry : isJewelry);
  }
  
  return result;
}

/**
 * Calculate fidelity metrics comparing input vs output masks
 */
export function calculateMetrics(inputMask: boolean[], outputMask: boolean[]): FidelityMetrics {
  if (inputMask.length !== outputMask.length) {
    console.error('Mask sizes do not match:', inputMask.length, 'vs', outputMask.length);
    return { precision: 0, recall: 0, iou: 0, growthRatio: 1, areaInput: 0, areaOutput: 0 };
  }

  let areaInput = 0;
  let areaOutput = 0;
  let intersection = 0;
  let union = 0;

  for (let i = 0; i < inputMask.length; i++) {
    if (inputMask[i]) areaInput++;
    if (outputMask[i]) areaOutput++;
    if (inputMask[i] && outputMask[i]) intersection++;
    if (inputMask[i] || outputMask[i]) union++;
  }

  const precision = areaOutput > 0 ? intersection / areaOutput : 0;
  const recall = areaInput > 0 ? intersection / areaInput : 0;
  const iou = union > 0 ? intersection / union : 0;
  const growthRatio = areaInput > 0 ? areaOutput / areaInput : 1;

  return { precision, recall, iou, growthRatio, areaInput, areaOutput };
}

/**
 * Create fidelity visualization overlay
 * 
 * @param resultImage - The generated result image (base64 or URL)
 * @param inputMask - The user's input mask (base64 or URL)
 * @param outputMask - The detected output mask from generated image (base64 or URL)
 * @param invertInput - Whether to invert the input mask (default true for jewelry masks)
 * @param invertOutput - Whether to invert the output mask
 * @returns Object with visualization image and calculated metrics
 */
export async function createFidelityVisualization(
  resultImage: string,
  inputMask: string,
  outputMask: string,
  invertInput: boolean = true,
  invertOutput: boolean = false
): Promise<{ visualization: string; metrics: FidelityMetrics }> {
  // Load all images
  const [resultImg, inputImg, outputImg] = await Promise.all([
    loadImage(resultImage),
    loadImage(inputMask),
    loadImage(outputMask),
  ]);

  // Create canvas at result image size
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = resultImg.width;
  canvas.height = resultImg.height;

  // Draw result image as background
  ctx.drawImage(resultImg, 0, 0, canvas.width, canvas.height);

  // Get mask data - resize masks to match result if needed
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;

  // Get input mask array
  maskCtx.drawImage(inputImg, 0, 0, canvas.width, canvas.height);
  const inputData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
  const inputArray = getMaskArray(inputData, invertInput);

  // Get output mask array
  maskCtx.clearRect(0, 0, canvas.width, canvas.height);
  maskCtx.drawImage(outputImg, 0, 0, canvas.width, canvas.height);
  const outputData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
  const outputArray = getMaskArray(outputData, invertOutput);

  // Calculate metrics
  const metrics = calculateMetrics(inputArray, outputArray);

  // Create overlay on result image
  const resultData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = resultData.data;

  for (let i = 0; i < inputArray.length; i++) {
    const pixelIndex = i * 4;
    const inInput = inputArray[i];
    const inOutput = outputArray[i];

    if (inInput && inOutput) {
      // Correct preservation - GREEN overlay (30% opacity)
      pixels[pixelIndex] = Math.round(pixels[pixelIndex] * 0.7 + 0 * 0.3);
      pixels[pixelIndex + 1] = Math.round(pixels[pixelIndex + 1] * 0.7 + 255 * 0.3);
      pixels[pixelIndex + 2] = Math.round(pixels[pixelIndex + 2] * 0.7 + 0 * 0.3);
    } else if (!inInput && inOutput) {
      // Extended area - BLUE overlay (50% opacity)
      pixels[pixelIndex] = Math.round(pixels[pixelIndex] * 0.5 + 0 * 0.5);
      pixels[pixelIndex + 1] = Math.round(pixels[pixelIndex + 1] * 0.5 + 191 * 0.5);
      pixels[pixelIndex + 2] = Math.round(pixels[pixelIndex + 2] * 0.5 + 255 * 0.5);
    } else if (inInput && !inOutput) {
      // Shrunk area - RED overlay (50% opacity)
      pixels[pixelIndex] = Math.round(pixels[pixelIndex] * 0.5 + 255 * 0.5);
      pixels[pixelIndex + 1] = Math.round(pixels[pixelIndex + 1] * 0.5 + 0 * 0.5);
      pixels[pixelIndex + 2] = Math.round(pixels[pixelIndex + 2] * 0.5 + 0 * 0.5);
    }
    // else: neither mask - no overlay
  }

  ctx.putImageData(resultData, 0, 0);

  return {
    visualization: canvas.toDataURL('image/png'),
    metrics,
  };
}

/**
 * Determine quality status based on metrics
 */
export function getQualityStatus(metrics: FidelityMetrics): 'good' | 'bad' {
  // Good if precision > 90% AND recall > 80%
  return metrics.precision > 0.9 && metrics.recall > 0.8 ? 'good' : 'bad';
}
