/**
 * useBulkGeneration
 *
 * Fires N parallel generation jobs — one per selected vault asset.
 * Model-shot: N startPhotoshoot() calls, each tracked in GenerationsContext.
 * Product-shot: N startPdpShot() calls (same pattern; one per asset URL).
 *
 * No polling inside this hook — polling lives in GenerationsContext.
 * After all jobs are started, navigates to /generations so the user
 * can track progress across all running workflows.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { startPhotoshoot, startPdpShot } from '@/lib/photoshoot-api';
import { markGenerationStarted } from '@/lib/generation-lifecycle';
import { useGenerations } from '@/contexts/GenerationsContext';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import type { PresetModel } from '@/lib/models-api';
import type { useToast } from '@/hooks/use-toast';
import type { AssetModelAssignment } from '@/components/studio/StudioPairingStep';

export interface BulkAsset {
  thumbnailUrl: string;
  assetId: string;
}

export interface BulkGenerationPair {
  asset: BulkAsset;
  assignment: AssetModelAssignment;
}

interface UseBulkGenerationOptions {
  selectedAssets: BulkAsset[];
  assetModelPairs?: BulkGenerationPair[];
  selectedModel: PresetModel | null;
  customModelImage: string | null;
  modelAssetId: string | null;
  isProductShot: boolean;
  effectiveJewelryType: string;
  checkCredits: (tool: string) => Promise<boolean>;
  toast: ReturnType<typeof useToast>['toast'];
}

export function useBulkGeneration({
  selectedAssets,
  assetModelPairs = [],
  selectedModel,
  customModelImage,
  modelAssetId,
  isProductShot,
  effectiveJewelryType,
  checkCredits,
  toast,
}: UseBulkGenerationOptions) {
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<Array<{ assetId: string; error: string }>>([]);
  const { trackGeneration } = useGenerations();
  const navigate = useNavigate();

  const handleBulkGenerate = useCallback(async () => {
    if (isBulkGenerating || selectedAssets.length < 2) return;

    const completePairs = assetModelPairs.filter((pair) => pair.assignment?.url);
    const usesPairAssignments = completePairs.length > 0;
    if (!usesPairAssignments && assetModelPairs.length > 0) {
      toast({
        variant: 'destructive',
        title: 'No complete pairs selected',
        description: 'Assign a model to at least one jewelry piece before generating.',
      });
      return;
    }

    const modelUrl = selectedModel?.url ?? customModelImage;
    if (!usesPairAssignments && !modelUrl) {
      toast({ variant: 'destructive', title: 'No model selected', description: 'Select a model before generating.' });
      return;
    }

    const toolName = isProductShot ? 'Product_shot_pipeline' : 'jewelry_photoshoots_generator';
    const hasCredits = await checkCredits(toolName);
    if (!hasCredits) return;

    setIsBulkGenerating(true);
    setBulkErrors([]);

    const category = TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType;

    async function startOne(pair: BulkGenerationPair): Promise<{ workflow_id: string }> {
      const { asset, assignment } = pair;
      const pairModelUrl = assignment.url;
      const idempotencyKey = `${Date.now()}-bulk-${asset.assetId}`;
      if (isProductShot) {
        return startPdpShot({
          jewelry_image_url: asset.thumbnailUrl,
          inspiration_image_url: pairModelUrl,
          category,
          idempotency_key: idempotencyKey,
          input_jewelry_asset_id: asset.assetId,
          ...(assignment.presetModelId
            ? { input_preset_inspiration_id: assignment.presetModelId }
            : assignment.modelAssetId
            ? { input_inspiration_asset_id: assignment.modelAssetId }
            : {}),
        });
      }
      return startPhotoshoot({
        jewelry_image_url: asset.thumbnailUrl,
        model_image_url: pairModelUrl,
        category,
        idempotency_key: idempotencyKey,
        input_jewelry_asset_id: asset.assetId,
        ...(assignment.modelAssetId ? { input_model_asset_id: assignment.modelAssetId } : {}),
        ...(assignment.presetModelId && !assignment.modelAssetId ? { input_preset_model_id: assignment.presetModelId } : {}),
      });
    }

    const jobs: BulkGenerationPair[] = usesPairAssignments
      ? completePairs
      : selectedAssets.map((asset) => ({
          asset,
          assignment: {
            url: modelUrl!,
            label: selectedModel?.label ?? 'Selected model',
            presetModelId: selectedModel?.id ?? undefined,
            modelAssetId: modelAssetId ?? undefined,
          },
        }));

    try {
      const results = await Promise.allSettled(jobs.map(startOne));

      const errors: Array<{ assetId: string; error: string }> = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const { workflow_id } = r.value;
          trackGeneration({ workflowId: workflow_id, isProductShot, jewelryType: category });
          markGenerationStarted(workflow_id);
        } else {
          errors.push({ assetId: jobs[i].asset.assetId, error: String(r.reason) });
        }
      });

      setBulkErrors(errors);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;

      if (succeeded > 0) {
        toast({
          title: `${succeeded} photoshoot${succeeded > 1 ? 's' : ''} started`,
          description: 'Track progress in Generations.',
        });
        navigate('/generations');
      } else {
        toast({ variant: 'destructive', title: 'All jobs failed', description: 'Please try again.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Bulk generation failed', description: 'Please try again.' });
    } finally {
      setIsBulkGenerating(false);
    }
  }, [
    isBulkGenerating, selectedAssets, assetModelPairs, selectedModel, customModelImage,
    modelAssetId, isProductShot, effectiveJewelryType, checkCredits, toast, trackGeneration, navigate,
  ]);

  return { isBulkGenerating, bulkErrors, handleBulkGenerate };
}
