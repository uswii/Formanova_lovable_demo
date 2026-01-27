import { useState, useCallback } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Validation goes through the workflow-proxy which routes to Temporal backend
const WORKFLOW_PROXY_URL = `${SUPABASE_URL}/functions/v1/workflow-proxy`;

// Build validation URL with endpoint query param
const getValidationUrl = (path: string) => 
  `${WORKFLOW_PROXY_URL}?endpoint=${encodeURIComponent(path)}`;

export interface ImageValidationResult {
  index: number;
  detected_type: 'worn' | 'flatlay' | 'packshot' | 'unknown';
  is_acceptable: boolean;
  flags: string[];
  confidence: number;
  message: string;
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
 * Hook for validating uploaded jewelry images.
 * Checks if images are worn jewelry vs flatlay/packshot.
 */
export function useImageValidation() {
  const [state, setState] = useState<ValidationState>({
    isValidating: false,
    results: null,
    flaggedCount: 0,
    error: null,
  });

  /**
   * Convert File to base64 string
   */
  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      // Convert all files to base64
      const imagesBase64 = await Promise.all(files.map(fileToBase64));

      const response = await fetch(getValidationUrl('/api/validate/images'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          images: imagesBase64,
          category,
        }),
      });

      if (!response.ok) {
        // If validation service is down, don't block - return success
        console.warn('Image validation service unavailable, allowing upload');
        const fallbackResults: ImageValidationResult[] = files.map((_, idx) => ({
          index: idx,
          detected_type: 'unknown' as const,
          is_acceptable: true,
          flags: [],
          confidence: 0,
          message: 'Validation skipped',
        }));
        
        setState({
          isValidating: false,
          results: fallbackResults,
          flaggedCount: 0,
          error: null,
        });
        
        return {
          results: fallbackResults,
          all_acceptable: true,
          flagged_count: 0,
          message: 'Validation service unavailable',
        };
      }

      const data: ValidationResponse = await response.json();

      setState({
        isValidating: false,
        results: data.results,
        flaggedCount: data.flagged_count,
        error: null,
      });

      return data;
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
  }, [fileToBase64]);

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
