import { useState, useCallback } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Use workflow-proxy to route to Temporal backend's image classification tool
const WORKFLOW_PROXY_URL = `${SUPABASE_URL}/functions/v1/workflow-proxy`;

// Build validation URL with endpoint query param for the Temporal tool adapter
const getClassificationUrl = () => 
  `${WORKFLOW_PROXY_URL}?endpoint=${encodeURIComponent('/tools/image_classification/run')}`;

// Response from the classification service
export interface ClassificationResult {
  category: 'mannequin' | 'model' | 'body_part' | 'flatlay' | '3d_render' | 'product_surface' | 'floating' | 'packshot';
  is_worn: boolean;
  confidence: number;
  reason: string;
  flagged: boolean;
}

// Mapped result for UI consumption
export interface ImageValidationResult {
  index: number;
  detected_type: 'worn' | 'flatlay' | 'packshot' | 'unknown';
  is_acceptable: boolean;
  flags: string[];
  confidence: number;
  message: string;
  category: string;
}

export interface ValidationResponse {
  results: ImageValidationResult[];
  all_acceptable: boolean;
  flagged_count: number;
  message: string;
}

export interface ValidationState {
  isValidating: boolean;
  results: ImageValidationResult[] | null;
  flaggedCount: number;
  error: string | null;
}

/**
 * Map backend category to simplified type for UI
 */
function mapCategoryToType(category: string, is_worn: boolean): 'worn' | 'flatlay' | 'packshot' | 'unknown' {
  if (is_worn) return 'worn';
  if (category === 'flatlay' || category === 'product_surface') return 'flatlay';
  if (category === 'packshot' || category === '3d_render' || category === 'floating') return 'packshot';
  return 'unknown';
}

/**
 * Build flags array from classification result
 */
function buildFlags(result: ClassificationResult): string[] {
  const flags: string[] = [];
  if (!result.is_worn) flags.push('not_worn');
  if (result.flagged) flags.push('flagged');
  if (result.category === '3d_render') flags.push('3d_render');
  if (result.category === 'floating') flags.push('floating');
  return flags;
}

/**
 * Hook for validating uploaded jewelry images.
 * Checks if images are worn jewelry vs flatlay/packshot using the classification service.
 */
export function useImageValidation() {
  const [state, setState] = useState<ValidationState>({
    isValidating: false,
    results: null,
    flaggedCount: 0,
    error: null,
  });

  /**
   * Convert File to data URI string
   */
  const fileToDataUri = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Return full data URI (data:image/xxx;base64,...)
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Classify a single image
   */
  const classifyImage = useCallback(async (
    dataUri: string,
    authHeader?: Record<string, string>
  ): Promise<ClassificationResult | null> => {
    try {
      const response = await fetch(getClassificationUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          data: {
            image: {
              uri: dataUri
            }
          },
          meta: {}
        }),
      });

      if (!response.ok) {
        console.warn('Classification service returned error:', response.status);
        return null;
      }

      const data = await response.json();
      return data as ClassificationResult;
    } catch (error) {
      console.error('Classification request failed:', error);
      return null;
    }
  }, []);

  /**
   * Validate multiple images at once
   */
  const validateImages = useCallback(async (
    files: File[],
    category: string,
    authHeader?: Record<string, string>
  ): Promise<ValidationResponse | null> => {
    if (files.length === 0) return null;

    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      // Convert all files to data URIs
      const dataUris = await Promise.all(files.map(fileToDataUri));

      // Classify all images in parallel
      const classificationResults = await Promise.all(
        dataUris.map(uri => classifyImage(uri, authHeader))
      );

      // Map results to validation format
      const results: ImageValidationResult[] = classificationResults.map((result, idx) => {
        if (!result) {
          // Service unavailable - allow upload
          return {
            index: idx,
            detected_type: 'unknown' as const,
            is_acceptable: true,
            flags: [],
            confidence: 0,
            message: 'Validation skipped',
            category: 'unknown',
          };
        }

        const detectedType = mapCategoryToType(result.category, result.is_worn);
        const flags = buildFlags(result);

        return {
          index: idx,
          detected_type: detectedType,
          is_acceptable: result.is_worn || !result.flagged, // Acceptable if worn OR not flagged
          flags,
          confidence: result.confidence,
          message: result.reason,
          category: result.category,
        };
      });

      const flaggedCount = results.filter(r => r.flags.length > 0).length;
      const allAcceptable = results.every(r => r.is_acceptable);

      setState({
        isValidating: false,
        results,
        flaggedCount,
        error: null,
      });

      return {
        results,
        all_acceptable: allAcceptable,
        flagged_count: flaggedCount,
        message: flaggedCount > 0 
          ? `${flaggedCount} image(s) flagged - review recommended before submission`
          : 'All images passed validation',
      };
    } catch (error) {
      console.error('Image validation error:', error);
      
      // Don't block uploads on validation errors
      const fallbackResults: ImageValidationResult[] = files.map((_, idx) => ({
        index: idx,
        detected_type: 'unknown' as const,
        is_acceptable: true,
        flags: [],
        confidence: 0,
        message: 'Validation error',
        category: 'unknown',
      }));

      setState({
        isValidating: false,
        results: fallbackResults,
        flaggedCount: 0,
        error: error instanceof Error ? error.message : 'Validation failed',
      });

      return {
        results: fallbackResults,
        all_acceptable: true,
        flagged_count: 0,
        message: 'Validation error - proceeding anyway',
      };
    }
  }, [fileToDataUri, classifyImage]);

  /**
   * Clear validation state
   */
  const clearValidation = useCallback(() => {
    setState({
      isValidating: false,
      results: null,
      flaggedCount: 0,
      error: null,
    });
  }, []);

  /**
   * Check if a specific image at index is flagged
   */
  const isImageFlagged = useCallback((index: number): boolean => {
    if (!state.results) return false;
    const result = state.results.find(r => r.index === index);
    return result ? result.flags.length > 0 : false;
  }, [state.results]);

  /**
   * Get flags for a specific image
   */
  const getImageFlags = useCallback((index: number): string[] => {
    if (!state.results) return [];
    const result = state.results.find(r => r.index === index);
    return result?.flags || [];
  }, [state.results]);

  return {
    ...state,
    validateImages,
    clearValidation,
    isImageFlagged,
    getImageFlags,
  };
}
