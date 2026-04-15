import { useState, useCallback } from 'react';
import { authenticatedFetch, AuthExpiredError } from '@/lib/authenticated-fetch';
import { compressImageBlob } from '@/lib/image-compression';
import { uploadToAzure } from '@/lib/microservices-api';
import { fetchUserAssets, updateAssetMetadata } from '@/lib/assets-api';
import { pollWorkflow } from '@/lib/poll-workflow';

const CLASSIFICATION_URL = '/api/run/image_classification';
const STATUS_URL = '/api/status';
const RESULT_URL = '/api/result';
const WORN_CATEGORIES = ['mannequin', 'model', 'body_part'];
const VALIDATION_UNAVAILABLE_REASONS = new Set([
  'classification_unavailable',
  'classification_failed',
  'no_result',
  'no_captioning_data',
]);

// Response from the classification service
export interface ClassificationResult {
  category: 'mannequin' | 'model' | 'body_part' | 'flatlay' | '3d_render' | 'product_surface' | 'floating' | 'packshot' | 'unknown';
  is_worn: boolean;
  confidence: number;
  reason: string;
  flagged: boolean;
  /** URL of the uploaded image - reuse to avoid double uploads */
  uploaded_url?: string;
  /** SAS URL for browser display (short-lived signed URL) */
  sas_url?: string;
  /** Asset ID from Azure registration - pass as input_jewelry_asset_id */
  asset_id?: string | null;
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
  /** URL of the uploaded image - reuse for photoshoot generation */
  uploaded_url?: string;
  /** SAS URL for browser display (short-lived signed URL) */
  sas_url?: string;
  /** Asset ID from Azure registration - pass as input_jewelry_asset_id */
  asset_id?: string | null;
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
  if (VALIDATION_UNAVAILABLE_REASONS.has(result.reason)) return [];
  const flags: string[] = [];
  if (!result.is_worn) flags.push('not_worn');
  if (result.flagged) flags.push('flagged');
  if (result.category === '3d_render') flags.push('3d_render');
  if (result.category === 'floating') flags.push('floating');
  return flags;
}

/**
 * Hook for validating uploaded jewelry images.
 *
 * Flow:
 * 1. Upload image via azure-upload edge function -> get URL
 * 2. POST /api/run/image_classification with { payload: { jewelry_image_url } }
 * 3. Poll GET /api/status/{workflow_id} until completed
 * 4. GET /api/result/{workflow_id} -> { image_captioning: [{ label, confidence, reason, flagged }] }
 */
export function useImageValidation() {
  const [state, setState] = useState<ValidationState>({
    isValidating: false,
    results: null,
    flaggedCount: 0,
    error: null,
  });

  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const { blob: compressed } = await compressImageBlob(blob, 900);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
  }, []);

  const classifyImage = useCallback(async (
    base64DataUri: string,
    metadata?: Record<string, string>,
  ): Promise<ClassificationResult | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      console.log('[ImageValidation] Uploading image to Azure...');

      // 1. Upload to Azure to get a URL
      const azureResult = await uploadToAzure(base64DataUri, 'image/jpeg', 'jewelry_photo', metadata);
      const uploadedUrl = azureResult.sas_url || azureResult.https_url; // proxy URL, same as model uploads
      const uploadedSasUrl = azureResult.sas_url; // signed URL for browser display
      const uploadedAssetId = azureResult.asset_id ?? null;
      console.log('[ImageValidation] Uploaded azure URI:', uploadedUrl);

      // 2. Check if already classified - skip workflow if metadata.display_type is set
      if (uploadedAssetId) {
        try {
          const assetsPage = await fetchUserAssets('jewelry_photo', 0, 200);
          const cached = assetsPage.items.find(a => a.id === uploadedAssetId);
          console.log('[ImageValidation] Cache check - asset found:', !!cached, '| metadata:', JSON.stringify(cached?.metadata));
          if (cached?.metadata?.display_type) {
            clearTimeout(timeoutId);
            const userOverride = cached.metadata.user_override === 'true';
            const is_worn = userOverride || cached.metadata.is_worn === 'true';
            console.log('[ImageValidation] Using cached classification for asset:', uploadedAssetId, '| user_override:', userOverride);
            return {
              category: cached.metadata.display_type as ClassificationResult['category'],
              is_worn,
              confidence: 1,
              reason: userOverride ? 'user_override' : 'cached',
              flagged: !is_worn,
              uploaded_url: uploadedUrl,
              sas_url: uploadedSasUrl,
              asset_id: uploadedAssetId,
            };
          }
        } catch (e) {
          console.warn('[ImageValidation] Cache check failed:', e);
        }
      }

      // 3. POST /api/run/image_classification
      const classificationPayload = {
        payload: {
          jewelry_image_url: { uri: uploadedUrl },
        },
      };
      console.log('[ImageValidation] Sending classification request:', JSON.stringify(classificationPayload));

      const runRes = await authenticatedFetch(CLASSIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classificationPayload),
        signal: controller.signal,
      });

      if (!runRes.ok) {
        console.warn('[ImageValidation] Classification request failed:', runRes.status);
        clearTimeout(timeoutId);
        return {
          category: 'unknown',
          is_worn: false,
          confidence: 0,
          reason: 'classification_unavailable',
          flagged: true,
          uploaded_url: uploadedUrl,
          asset_id: uploadedAssetId,
        };
      }

      const runData = await runRes.json();
      const workflowId = runData.workflow_id;
      console.log('[ImageValidation] Workflow started:', workflowId);

      // 3. Poll status then fetch result via pollWorkflow
      let classificationFailed = false;

      let pollResult: Awaited<ReturnType<typeof pollWorkflow>>;
      try {
        pollResult = await pollWorkflow({
          mode: 'status-then-result',
          fetchStatus: () => authenticatedFetch(`${STATUS_URL}/${workflowId}`, { signal: controller.signal }),
          fetchResult: () => authenticatedFetch(`${RESULT_URL}/${workflowId}`, { signal: controller.signal }),
          resolveState: (statusData: unknown) => {
            const d = statusData as { runtime?: { state?: string }; progress?: { state?: string }; state?: string };
            const s = d.runtime?.state || d.progress?.state || d.state || 'running';
            console.log('[ImageValidation] Poll status:', s);
            if (s === 'succeeded') return 'completed';
            if (s === 'failed' || s === 'error') { classificationFailed = true; return 'failed'; }
            return s;
          },
          parseResult: (d) => d,
          intervalMs: 1000,
          timeoutMs: 120_000,           // outer wall-clock safety net
          maxStatusPolls: 60,           // original loop: 60 iterations at 1s
          onStatusExhausted: 'fetch-result', // original: always attempts result fetch
          statusNonOkBehavior: 'continue',   // original: non-ok silently continues
          max404s: 999,                 // original: no 404 budget, just continue
          maxResultRetries: 5,
          resultRetryDelayMs: 1000,
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof AuthExpiredError) throw err;
        clearTimeout(timeoutId);
        if (classificationFailed) {
          console.warn('[ImageValidation] Workflow failed');
          return { category: 'unknown', is_worn: false, confidence: 0, reason: 'classification_failed', flagged: true, uploaded_url: uploadedUrl, sas_url: uploadedSasUrl, asset_id: uploadedAssetId };
        }
        console.warn('[ImageValidation] Polling failed or timed out');
        return null;
      }

      if (pollResult.status === 'cancelled') {
        console.warn('[ImageValidation] Polling cancelled');
        clearTimeout(timeoutId);
        return null;
      }

      const resultData = pollResult.result;
      if (!resultData) {
        console.warn('[ImageValidation] Could not fetch result');
        clearTimeout(timeoutId);
        return { category: 'unknown', is_worn: false, confidence: 0, reason: 'no_result', flagged: true, uploaded_url: uploadedUrl, sas_url: uploadedSasUrl, asset_id: uploadedAssetId };
      }

      console.log('[ImageValidation] Classification result:', JSON.stringify(resultData));
      const captioning = (resultData as { image_captioning?: Array<{ label?: string; reason?: string; confidence?: number; flagged?: boolean }> })?.image_captioning;

      if (captioning && captioning.length > 0) {
        const raw = captioning[0];
        const label = raw.label || 'unknown';
        const reason = raw.reason || '';
        const is_worn = reason === 'worn' || WORN_CATEGORIES.includes(label);

        // Persist result so re-uploads skip classification
        if (uploadedAssetId) {
          updateAssetMetadata(uploadedAssetId, {
            display_type: label,
            is_worn: String(is_worn),
            flagged: String(!is_worn),
          }).then(() => {
            console.log('[ImageValidation] Metadata saved for asset:', uploadedAssetId);
          }).catch((e) => {
            console.warn('[ImageValidation] Failed to save metadata:', e);
          });
        }

        clearTimeout(timeoutId);
        return {
          category: label,
          is_worn,
          confidence: raw.confidence || 0,
          reason,
          flagged: !is_worn,
          uploaded_url: uploadedUrl,
          sas_url: uploadedSasUrl,
          asset_id: uploadedAssetId,
        };
      }

      console.warn('[ImageValidation] No image_captioning in result');
      clearTimeout(timeoutId);
      return { category: 'unknown', is_worn: false, confidence: 0, reason: 'no_captioning_data', flagged: true, uploaded_url: uploadedUrl, sas_url: uploadedSasUrl, asset_id: uploadedAssetId };
    } catch (error) {
      clearTimeout(timeoutId);
      // Auth expiry must propagate - authenticatedFetch already redirected to login.
      // Do not convert it to a validation fallback.
      if (error instanceof AuthExpiredError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[ImageValidation] Request timed out');
      } else {
        console.error('[ImageValidation] Request failed:', error);
      }
      return null;
    }
  }, []);

  /**
   * Validate multiple images at once
   */
  const validateImages = useCallback(async (
    files: File[],
    category: string,
    metadata?: Record<string, string>,
  ): Promise<ValidationResponse | null> => {
    if (files.length === 0) return null;

    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      const base64Uris = await Promise.all(files.map(fileToBase64));
      const classificationResults = await Promise.all(
        base64Uris.map(uri => classifyImage(uri, metadata))
      );

      const results: ImageValidationResult[] = classificationResults.map((result, idx) => {
        if (!result) {
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
        const isValidationUnavailable = VALIDATION_UNAVAILABLE_REASONS.has(result.reason);

        return {
          index: idx,
          detected_type: detectedType,
          is_acceptable: isValidationUnavailable ? true : result.is_worn,
          flags,
          confidence: result.confidence,
          message: result.reason,
          category: result.category,
          uploaded_url: result.uploaded_url,
          sas_url: result.sas_url,
          asset_id: result.asset_id,
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
      // Auth expiry must propagate - do not swallow into validation fallback.
      if (error instanceof AuthExpiredError) throw error;

      console.error('Image validation error:', error);

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
  }, [fileToBase64, classifyImage]);

  const clearValidation = useCallback(() => {
    setState({ isValidating: false, results: null, flaggedCount: 0, error: null });
  }, []);

  const isImageFlagged = useCallback((index: number): boolean => {
    if (!state.results) return false;
    const result = state.results.find(r => r.index === index);
    return result ? result.flags.length > 0 : false;
  }, [state.results]);

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
