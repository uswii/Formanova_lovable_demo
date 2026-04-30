import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useCredits } from "@/contexts/CreditsContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelRightClose, PanelLeft, PanelRight, X } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { performCreditPreflight, type PreflightResult } from "@/lib/credit-preflight";
import { TOOL_COSTS } from "@/lib/credits-api";
import { AuthExpiredError } from "@/lib/authenticated-fetch";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { pollWorkflow, type PollWorkflowResult } from "@/lib/poll-workflow";
import {
  resolveCadTerminalNode,
  resolveCadProgressNode,
  parseCadResult,
  type CadGenerationResult,
} from "@/lib/cad-poll-resolvers";
import {
  CAD_EDIT_WORKFLOW,
  CAD_IMAGE_GENERATION_WORKFLOW,
  buildCadEditStartBody,
  buildImageCadStartBody,
  CAD_GENERATION_WORKFLOW,
  buildCadGenerationStartBody,
} from "@/lib/cad-workflows";
import { resolveCadGenerationTier } from "@/lib/cad-tier";
import { trackPaywallHit, trackCadGenerationCompleted } from '@/lib/posthog-events';
import { InsufficientCreditsInline } from "@/components/InsufficientCreditsInline";
import { getStoredToken } from "@/lib/auth-api";

import ImagePromptScreen from "@/components/text-to-cad/ImagePromptScreen";
import LeftPanel from "@/components/text-to-cad/LeftPanel";
import { useAuth } from "@/contexts/AuthContext";
import { isCadUploadEnabled } from "@/lib/feature-flags";

import MeshPanel from "@/components/text-to-cad/MeshPanel";
import CADCanvas from "@/components/text-to-cad/CADCanvas";
import type { CADCanvasHandle, CanvasSnapshot, MeshTransformData } from "@/components/text-to-cad/CADCanvas";
import CADRuntimeErrorBoundary from "@/components/cad/CADRuntimeErrorBoundary";
import ViewportDisplayMenu from "@/components/text-to-cad/ViewportDisplayMenu";
import KeyboardShortcutsPanel from "@/components/text-to-cad/KeyboardShortcutsPanel";
import GenerationProgress from "@/components/text-to-cad/GenerationProgress";
import { useCADKeyboardShortcuts } from "@/hooks/use-cad-keyboard-shortcuts";
import {
  ViewportToolbar,
  ViewportSideTools,
} from "@/components/text-to-cad/ViewportOverlays";
import GemToggle from "@/components/text-to-cad/QualityToggle";
import { runMicroBenchmark } from "@/lib/gpu-detect";
import type { GemMode } from "@/components/text-to-cad/CADCanvas";
import type { MeshItemData, StatsData } from "@/components/text-to-cad/types";

interface UndoEntry {
  label: string;
  meshes: MeshItemData[];
  canvasSnapshot: CanvasSnapshot | null;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageToCAD() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshCredits } = useCredits();
  const { user } = useAuth();
  const showCadUpload = isCadUploadEnabled(user?.email);

  const [model] = useState("gemini");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreviewUrl, setReferenceImagePreviewUrl] = useState<string | null>(null);
  const [secondReferenceImage, setSecondReferenceImage] = useState<File | null>(null);
  const [secondReferenceImagePreviewUrl, setSecondReferenceImagePreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const [progressStep, setProgressStep] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [transformMode, setTransformMode] = useState("orbit");
  const [meshes, setMeshes] = useState<MeshItemData[]>([]);
  const [glbUrl, setGlbUrl] = useState<string | undefined>(undefined);
  const [glbArtifact, setGlbArtifact] = useState<{ uri: string; type: string; bytes: number; sha256: string } | null>(null);
  const [sourceWorkflowId, setSourceWorkflowId] = useState<string | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [creditBlock, setCreditBlock] = useState<PreflightResult | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
  const [selectedTransform, setSelectedTransform] = useState<MeshTransformData | null>(null);
  const [magicTexturing, setMagicTexturing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gemMode, setGemMode] = useState<GemMode>("simple");
  const [workspaceActive, setWorkspaceActive] = useState(false);

  const canvasRef = useRef<CADCanvasHandle>(null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const meshesRef = useRef<MeshItemData[]>(meshes);
  const wireframeRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => { runMicroBenchmark(); }, []);

  useEffect(() => () => { pollAbortRef.current?.abort(); }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (hasModel) rightPanelRef.current?.expand(22);
    else rightPanelRef.current?.collapse();
  }, [hasModel]);

  useEffect(() => {
    const glbParam = searchParams.get('glb');
    if (!glbParam) return;
    const workflowIdParam = searchParams.get('workflow_id');
    setWorkspaceActive(true);
    setHasModel(true);
    setIsModelLoading(true);
    setProgressStep("_loading");
    setGlbUrl(glbParam);
    setSourceWorkflowId(workflowIdParam?.trim() || null);
    setGlbArtifact({ uri: glbParam, type: 'model/gltf-binary', bytes: 0, sha256: '' });
    navigate('/image-to-cad', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  meshesRef.current = meshes;

  const selectedMeshNames = useMemo(
    () => new Set(meshes.filter((m) => m.selected).map((m) => m.name)),
    [meshes]
  );

  const hiddenMeshNames = useMemo(
    () => new Set(meshes.filter((m) => !m.visible).map((m) => m.name)),
    [meshes]
  );

  const selectedNames = useMemo(
    () => meshes.filter((m) => m.selected).map((m) => m.name),
    [meshes]
  );

  const pushUndoEntry = useCallback((label: string, entry: UndoEntry) => {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]);
  }, []);

  const pushUndo = useCallback((label: string) => {
    const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
    const snap = canvasRef.current?.getSnapshot() ?? null;
    pushUndoEntry(label, { label, meshes: currentMeshes, canvasSnapshot: snap });
  }, [pushUndoEntry]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      setRedoStack((r) => [...r, { label: last.label, meshes: currentMeshes, canvasSnapshot: snap }]);
      setMeshes(last.meshes);
      if (last.canvasSnapshot) canvasRef.current?.restoreSnapshot(last.canvasSnapshot);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      setUndoStack((u) => [...u, { label: last.label, meshes: currentMeshes, canvasSnapshot: snap }]);
      setMeshes(last.meshes);
      if (last.canvasSnapshot) canvasRef.current?.restoreSnapshot(last.canvasSnapshot);
      return prev.slice(0, -1);
    });
  }, []);

  const preTransformSnapshotRef = useRef<UndoEntry | null>(null);

  const handleTransformStart = useCallback(() => {
    const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
    const snap = canvasRef.current?.getSnapshot() ?? null;
    preTransformSnapshotRef.current = { label: `Transform (${transformMode})`, meshes: currentMeshes, canvasSnapshot: snap };
  }, [transformMode]);

  const handleTransformEnd = useCallback(() => {
    if (preTransformSnapshotRef.current) {
      pushUndoEntry(preTransformSnapshotRef.current.label, preTransformSnapshotRef.current);
      preTransformSnapshotRef.current = null;
    }
    setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
  }, [pushUndoEntry]);

  useEffect(() => {
    setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
  }, [selectedMeshNames]);

  const numericUndoRef = useRef<{ snapshot: UndoEntry; timer: ReturnType<typeof setTimeout> } | null>(null);

  const handleNumericTransformChange = useCallback((axis: 'x' | 'y' | 'z', property: 'position' | 'rotation' | 'scale', value: number) => {
    if (!numericUndoRef.current) {
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      const label = `Numeric ${property}`;
      numericUndoRef.current = {
        snapshot: { label, meshes: currentMeshes, canvasSnapshot: snap },
        timer: setTimeout(() => {
          if (numericUndoRef.current) {
            pushUndoEntry(numericUndoRef.current.snapshot.label, numericUndoRef.current.snapshot);
            numericUndoRef.current = null;
          }
        }, 800),
      };
    } else {
      clearTimeout(numericUndoRef.current.timer);
      numericUndoRef.current.timer = setTimeout(() => {
        if (numericUndoRef.current) {
          pushUndoEntry(numericUndoRef.current.snapshot.label, numericUndoRef.current.snapshot);
          numericUndoRef.current = null;
        }
      }, 800);
    }
    canvasRef.current?.setMeshTransform(axis, property, value);
    requestAnimationFrame(() => {
      setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
    });
  }, [pushUndoEntry]);

  const handleModelReady = useCallback(() => {
    setIsModelLoading(false);
    toast.success("Ring generated successfully");
  }, []);

  const handleReferenceImageChange = useCallback((file: File | null, previewUrl: string | null) => {
    setReferenceImage(file);
    setReferenceImagePreviewUrl(previewUrl);
    if (!file) {
      setSecondReferenceImage(null);
      setSecondReferenceImagePreviewUrl(null);
    }
  }, []);

  const handleSecondReferenceImageChange = useCallback((file: File | null, previewUrl: string | null) => {
    setSecondReferenceImage(file);
    setSecondReferenceImagePreviewUrl(previewUrl);
  }, []);

  const simulateGeneration = useCallback(async () => {
    if (isGenerating) return;
    const hasImage = !!referenceImage;
    const hasPrompt = !!prompt.trim();
    if (!hasImage && !hasPrompt) {
      toast.error("Upload an image or describe your ring first");
      return;
    }

    const workflow = hasImage ? CAD_IMAGE_GENERATION_WORKFLOW : CAD_GENERATION_WORKFLOW;
    const modelKey = `${workflow}:${model}`;
    const requiredCredits = TOOL_COSTS[modelKey] ?? TOOL_COSTS.cad_generation ?? 5;

    try {
      const tier = resolveCadGenerationTier(model);
      const result = await performCreditPreflight(workflow, 1, {
        model,
        pricingContext: { tier },
      });
      const balance = result.currentBalance;
      const cost = result.estimatedCredits > 0 ? result.estimatedCredits : requiredCredits;
      if (balance < cost) {
        setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
        trackPaywallHit({ category: 'ring', steps_completed: 1 });
        return;
      }
      setCreditBlock(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return;
      console.error('[ImageToCAD Preflight] failed, skipping block:', err);
      setCreditBlock(null);
    }

    const cadGenStartTime = Date.now();
    setWorkspaceActive(true);
    setIsGenerating(true);
    setGenerationFailed(false);
    setRetryAttempt(0);
    setHasModel(false);
    setSourceWorkflowId(null);
    setProgressStep(hasImage ? "generate_from_sketch" : "generate_initial");

    try {
      let requestBody: object;
      if (hasImage) {
        const dataUri = await fileToDataUri(referenceImage!);
        const secondDataUri = secondReferenceImage ? await fileToDataUri(secondReferenceImage) : null;
        const refImages = secondDataUri ? [dataUri, secondDataUri] : [dataUri];
        requestBody = buildImageCadStartBody(refImages, prompt, model);
      } else {
        requestBody = buildCadGenerationStartBody(prompt, model);
      }

      const startRes = await authenticatedFetch(`/api/run/${workflow}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to start generation (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error("No workflow_id returned");

      pollAbortRef.current?.abort();
      const pollAbort = new AbortController();
      pollAbortRef.current = pollAbort;

      let genPollResult: PollWorkflowResult<CadGenerationResult>;
      try {
        genPollResult = await pollWorkflow<CadGenerationResult>({
          mode: 'status-then-result',
          fetchStatus: () => authenticatedFetch(
            `/api/status/${encodeURIComponent(workflow_id)}`,
            { signal: pollAbort.signal }
          ),
          fetchResult: () => authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`),
          resolveState: (statusData) => {
            const s = statusData as { runtime?: { state?: string }; progress?: { state?: string }; state?: string };
            const state = (s.runtime?.state || s.progress?.state || s.state || 'unknown').toLowerCase();
            return (state === 'failed' || state === 'budget_exhausted' || state === 'terminated' || state === 'cancelled' || state === 'timed_out' || state === 'timeout') ? 'completed' : state;
          },
          resolveProgressNode: resolveCadProgressNode,
          parseResult: (d) => parseCadResult(d, 'generation'),
          onProgress: ({ node, retryCount }) => {
            setProgressStep(node);
            if (retryCount > 0) setRetryAttempt(retryCount);
          },
          onStatusData: (statusData) => {
            const s = statusData as { runtime?: { state?: string } };
            const state = (s.runtime?.state || "").toLowerCase();
            if (state === "failed" || state === "budget_exhausted") {
              setProgressStep("failed_final");
            }
          },
          intervalMs: 2000,
          timeoutMs: 60 * 60 * 1000,
          max404s: 13,
          maxPollErrors: 10,
          maxResultRetries: 1,
          signal: pollAbort.signal,
        });
      } catch (err) {
        if (err instanceof AuthExpiredError) return;
        throw err;
      }

      if (genPollResult.status === 'cancelled') return;

      setProgressStep("_loading");
      const { glb_url, artifact: genArtifact } = genPollResult.result;
      setGlbArtifact(genArtifact);

      setGlbUrl(glb_url);
      trackCadGenerationCompleted({
        category: 'ring',
        prompt_length: prompt.trim().length,
        duration_ms: Date.now() - cadGenStartTime,
      });
      setProgressStep("_loading");
      setIsModelLoading(true);
      setIsGenerating(false);
      refreshCredits().catch(() => {});
      setHasModel(true);
      setSourceWorkflowId(workflow_id);

    } catch (err) {
      console.error("ImageToCAD generation failed:", err);
      setIsGenerating(false);
      setProgressStep("");
      setGenerationFailed(true);
    }
  }, [prompt, model, referenceImage, secondReferenceImage, isGenerating]);

  const runEditWithPrompt = useCallback(async (promptText: string, label: string) => {
    if (!promptText.trim()) { toast.error("Please describe the edit"); return; }
    if (isGenerating || isEditing) return;
    if (!sourceWorkflowId) { toast.error("Generate a ring before editing"); return; }

    const modelKey = `${CAD_EDIT_WORKFLOW}:${model}`;
    const requiredCredits = TOOL_COSTS[modelKey] ?? TOOL_COSTS[CAD_EDIT_WORKFLOW] ?? 5;
    try {
      const result = await performCreditPreflight(CAD_EDIT_WORKFLOW, 1, { model });
      const balance = result.currentBalance;
      const cost = result.estimatedCredits > 0 ? result.estimatedCredits : requiredCredits;
      if (balance < cost) {
        setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
        return;
      }
      setCreditBlock(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return;
      console.error('[ImageToCAD Edit Preflight] failed:', err);
      setCreditBlock(null);
    }

    pushUndo(label);
    setIsEditing(true);
    setIsGenerating(true);
    setRetryAttempt(0);
    setProgressStep("generate_initial");

    try {
      const startRes = await authenticatedFetch(`/api/run/${CAD_EDIT_WORKFLOW}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCadEditStartBody(promptText, sourceWorkflowId, model, getStoredToken(), user?.id)),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to start edit (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error("No workflow_id returned");

      pollAbortRef.current?.abort();
      const pollAbort = new AbortController();
      pollAbortRef.current = pollAbort;

      let editPollResult: PollWorkflowResult<CadGenerationResult>;
      try {
        editPollResult = await pollWorkflow<CadGenerationResult>({
          mode: 'status-then-result',
          fetchStatus: () => authenticatedFetch(
            `/api/status/${encodeURIComponent(workflow_id)}`,
            { signal: pollAbort.signal }
          ),
          fetchResult: () => authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`),
          resolveState: (statusData) => {
            const s = statusData as { runtime?: { state?: string }; progress?: { state?: string }; state?: string };
            const state = (s.runtime?.state || s.progress?.state || s.state || 'unknown').toLowerCase();
            return (state === 'failed' || state === 'budget_exhausted' || state === 'terminated' || state === 'cancelled' || state === 'timed_out' || state === 'timeout') ? 'completed' : state;
          },
          resolveTerminalNode: resolveCadTerminalNode,
          resolveProgressNode: resolveCadProgressNode,
          parseResult: (d) => parseCadResult(d, 'edit'),
          onProgress: ({ node, retryCount }) => {
            setProgressStep(node);
            if (retryCount > 0) setRetryAttempt(retryCount);
          },
          onStatusData: (statusData) => {
            const s = statusData as { runtime?: { state?: string } };
            const state = (s.runtime?.state || "").toLowerCase();
            if (state === "failed" || state === "budget_exhausted") setProgressStep("failed_final");
          },
          intervalMs: 2000,
          timeoutMs: 60 * 60 * 1000,
          max404s: 13,
          maxPollErrors: 10,
          maxResultRetries: 1,
          signal: pollAbort.signal,
        });
      } catch (err) {
        if (err instanceof AuthExpiredError) return;
        throw err;
      }

      if (editPollResult.status === 'cancelled') return;

      setProgressStep("_loading");
      const { glb_url, artifact: editArtifact } = editPollResult.result;
      setGlbArtifact(editArtifact);
      setGlbUrl(glb_url);
      setProgressStep("_loading");
      setIsModelLoading(true);
      setIsGenerating(false);
      setIsEditing(false);
      refreshCredits().catch(() => {});
      setHasModel(true);
      setSourceWorkflowId(workflow_id);
      toast.success(`${label} applied`);

    } catch (err) {
      console.error(`Edit "${label}" failed:`, err);
      toast.error(err instanceof Error ? err.message : "Edit failed");
      setIsGenerating(false);
      setIsEditing(false);
      setProgressStep("");
    }
  }, [model, isGenerating, isEditing, sourceWorkflowId, pushUndo]);

  const simulateEdit = useCallback(async () => {
    await runEditWithPrompt(editPrompt, "AI edit");
    setEditPrompt("");
  }, [editPrompt, runEditWithPrompt]);

  const handleReset = () => {
    setEditPrompt("");
    setHasModel(false);
    setRetryAttempt(0);
    setProgressStep("");
    setMeshes([]);
    setSourceWorkflowId(null);
    setUndoStack([]);
    setRedoStack([]);
    if (glbUrl) URL.revokeObjectURL(glbUrl);
    setGlbUrl(undefined);
  };

  const handleSelectMesh = (name: string, multi: boolean) => {
    if (!name) {
      setMeshes((prev) => prev.map((m) => ({ ...m, selected: false })));
      return;
    }
    setMeshes((prev) =>
      prev.map((m) =>
        m.name === name
          ? { ...m, selected: multi ? !m.selected : true }
          : multi ? m : { ...m, selected: false }
      )
    );
  };

  const handleMeshesDetected = useCallback((detected: { name: string; verts: number; faces: number }[]) => {
    setMeshes((prev) => {
      const prevMap = new Map(prev.map(m => [m.name, m]));
      return detected.map((d) => {
        const existing = prevMap.get(d.name);
        return { ...d, visible: existing?.visible ?? true, selected: existing?.selected ?? false };
      });
    });
  }, []);

  const handleMeshAction = (action: string) => {
    const isVisibilityAction = ["hide", "show", "show-all", "isolate"].includes(action);
    if (isVisibilityAction) pushUndo(`Visibility: ${action}`);
    setMeshes((prev) => {
      switch (action) {
        case "hide": return prev.map((m) => m.selected ? { ...m, visible: false } : m);
        case "show": return prev.map((m) => m.selected ? { ...m, visible: true } : m);
        case "show-all": return prev.map((m) => ({ ...m, visible: true }));
        case "isolate": return prev.map((m) => ({ ...m, visible: m.selected }));
        case "select-all": return prev.map((m) => ({ ...m, selected: true }));
        case "select-none": return prev.map((m) => ({ ...m, selected: false }));
        case "select-invert": return prev.map((m) => ({ ...m, selected: !m.selected }));
        default: return prev;
      }
    });
  };

  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const selectionWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSelectionWarning = useCallback((msg: string) => {
    setSelectionWarning(msg);
    if (selectionWarningTimer.current) clearTimeout(selectionWarningTimer.current);
    selectionWarningTimer.current = setTimeout(() => setSelectionWarning(null), 3000);
  }, []);

  const handleApplyMaterial = useCallback((matId: string) => {
    if (selectedNames.length === 0) { showSelectionWarning("Select meshes first, then apply a material"); return; }
    pushUndo("Apply material");
    canvasRef.current?.applyMaterial(matId, selectedNames);
  }, [selectedNames, pushUndo, showSelectionWarning]);

  const pendingSelectRef = useRef<Set<string> | null>(null);

  const handleSceneAction = useCallback((action: string) => {
    const names = selectedNames;
    switch (action) {
      case "set-mode-translate": setTransformMode("translate"); break;
      case "set-mode-rotate": setTransformMode("rotate"); break;
      case "set-mode-scale": setTransformMode("scale"); break;
      case "reset-transform":
        pushUndo("Reset transform");
        canvasRef.current?.resetTransform(names.length ? names : meshes.map((m) => m.name));
        break;
      case "apply-transform":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Apply transform");
        canvasRef.current?.applyTransform(names);
        break;
      case "delete":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Delete meshes");
        canvasRef.current?.deleteMeshes(names);
        setMeshes((prev) => prev.filter((m) => !names.includes(m.name)));
        break;
      case "duplicate":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Duplicate meshes");
        const existingNames = new Set(meshesRef.current.map(m => m.name));
        const dupNames = new Set<string>();
        names.forEach(n => {
          let finalName = `${n}_copy`;
          let suffix = 2;
          while (existingNames.has(finalName) || dupNames.has(finalName)) finalName = `${n}_copy_${suffix++}`;
          dupNames.add(finalName);
        });
        pendingSelectRef.current = dupNames;
        canvasRef.current?.duplicateMeshes(names);
        break;
      case "flip-normals":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Flip normals");
        canvasRef.current?.flipNormals(names);
        break;
      case "center-origin":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Center origin");
        canvasRef.current?.centerOrigin(names);
        break;
      case "wireframe-on": canvasRef.current?.setWireframe(true); break;
      case "wireframe-off": canvasRef.current?.setWireframe(false); break;
      default: break;
    }
  }, [selectedNames, meshes, pushUndo, showSelectionWarning]);

  const toggleWireframe = useCallback(() => {
    wireframeRef.current = !wireframeRef.current;
    canvasRef.current?.setWireframe(wireframeRef.current);
  }, []);

  const clipboardRef = useRef<string[]>([]);
  const handleCopy = useCallback(() => {
    const names = meshesRef.current.filter(m => m.selected).map(m => m.name);
    if (names.length) clipboardRef.current = names;
  }, []);
  const handlePaste = useCallback(() => {
    if (!clipboardRef.current.length) return;
    pushUndo("Paste meshes");
    canvasRef.current?.duplicateMeshes(clipboardRef.current);
  }, [pushUndo]);
  const handleCut = useCallback(() => {
    const names = meshesRef.current.filter(m => m.selected).map(m => m.name);
    if (!names.length) return;
    clipboardRef.current = names;
    pushUndo("Cut meshes");
    canvasRef.current?.deleteMeshes(names);
    setMeshes((prev) => prev.filter((m) => !names.includes(m.name)));
  }, [pushUndo]);

  useCADKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: () => handleSceneAction("delete"),
    onDuplicate: () => handleSceneAction("duplicate"),
    onSelectAll: () => setMeshes((prev) => prev.map((m) => ({ ...m, selected: true }))),
    onDeselectAll: () => setMeshes((prev) => prev.map((m) => ({ ...m, selected: false }))),
    onSetTransformMode: setTransformMode,
    onToggleWireframe: toggleWireframe,
    onToggleShortcutsPanel: () => setShortcutsOpen((p) => !p),
    onCopy: handleCopy,
    onPaste: handlePaste,
    onCut: handleCut,
    onResetTransform: () => handleSceneAction("reset-transform"),
    enabled: workspaceActive,
  });

  const handleDownloadGlb = useCallback(async () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const defaultName = `model-${timestamp}.glb`;
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: defaultName, file_type: 'glb', context: 'image-to-cad' }));
    const anchorDownload = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    try {
      let blob: Blob;
      if (canvasRef.current) {
        blob = await canvasRef.current.exportSceneBlob();
      } else if (glbUrl) {
        const response = await fetch(glbUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        blob = await response.blob();
      } else { toast.error("No model to download"); return; }
      if (!blob || blob.size === 0) { toast.error("Export produced an empty file"); return; }
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: 'GLB 3D Model', accept: { 'model/gltf-binary': ['.glb'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          anchorDownload(blob);
        }
      } else { anchorDownload(blob); }
    } catch (err) {
      console.error('[Download]', err);
      toast.error("Failed to download model");
    }
  }, [glbUrl]);

  // ── Phase 1: Initial prompt screen ──
  if (!workspaceActive) {
    return (
      <div className="h-[calc(100vh-5rem)] flex bg-background" tabIndex={0}>
        <ImagePromptScreen
          model={model}
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={isGenerating}
          onGenerate={simulateGeneration}
          referenceImagePreviewUrl={referenceImagePreviewUrl}
          onReferenceImageChange={handleReferenceImageChange}
          secondReferenceImagePreviewUrl={secondReferenceImagePreviewUrl}
          onSecondReferenceImageChange={handleSecondReferenceImageChange}
          onGlbUpload={showCadUpload ? (file) => { setWorkspaceActive(true); setHasModel(true); setIsModelLoading(true); setProgressStep("_loading"); const url = URL.createObjectURL(file); setGlbUrl(url); } : undefined}
          creditBlock={creditBlock ? (
            <InsufficientCreditsInline
              currentBalance={creditBlock.currentBalance}
              requiredCredits={creditBlock.estimatedCredits}
              onDismiss={() => setCreditBlock(null)}
            />
          ) : undefined}
        />
      </div>
    );
  }

  // ── Phase 2: Full workspace with resizable panels ──
  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden bg-background" tabIndex={-1}>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel
          ref={leftPanelRef}
          id="left-panel"
          order={1}
          defaultSize={22}
          minSize={15}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => setLeftCollapsed(false)}
          className="relative"
        >
          {!leftCollapsed && (
            <LeftPanel
              model={model} setModel={() => {}}
              prompt={prompt} setPrompt={setPrompt}
              editPrompt={editPrompt} setEditPrompt={setEditPrompt}
              isGenerating={isGenerating} isEditing={isEditing}
              hasModel={hasModel}
              onGenerate={simulateGeneration}
              onEdit={simulateEdit}
              magicTexturing={magicTexturing}
              onMagicTexturingChange={(on) => {
                setMagicTexturing(on);
                if (on) canvasRef.current?.applyMagicTextures();
                else canvasRef.current?.removeAllTextures();
              }}
              onGlbUpload={() => {}}
              onReset={hasModel ? handleReset : undefined}
              pageTitle="Image to CAD"
              referenceImagePreviewUrl={referenceImagePreviewUrl}
              onClearReferenceImage={() => handleReferenceImageChange(null, null)}
              secondReferenceImagePreviewUrl={secondReferenceImagePreviewUrl}
              onSecondReferenceImageChange={handleSecondReferenceImageChange}
              creditBlock={creditBlock ? (
                <InsufficientCreditsInline
                  currentBalance={creditBlock.currentBalance}
                  requiredCredits={creditBlock.estimatedCredits}
                  onDismiss={() => setCreditBlock(null)}
                />
              ) : undefined}
            />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />

        <ResizablePanel id="viewport-panel" order={2} defaultSize={hasModel ? 56 : 78} minSize={30}>
          <div data-cad-viewport className="relative h-full border-x-2 border-primary/20 shadow-[inset_0_0_30px_-10px_hsl(var(--primary)/0.15)]" style={{ background: "#000000" }}>
            {!isFullscreen && (
              <>
                <button
                  onClick={() => { const p = leftPanelRef.current; if (p) { leftCollapsed ? p.expand(22) : p.collapse(); } }}
                  className="absolute top-2 left-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                  title={leftCollapsed ? "Show left panel" : "Hide left panel"}
                >
                  {leftCollapsed ? <PanelLeft className="w-4 h-4 text-foreground/70" /> : <PanelLeftClose className="w-4 h-4 text-foreground/70" />}
                </button>
                {hasModel && (
                  <button
                    onClick={() => { const p = rightPanelRef.current; if (p) { rightCollapsed ? p.expand(22) : p.collapse(); } }}
                    className="absolute top-2 right-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                    title={rightCollapsed ? "Show right panel" : "Hide right panel"}
                  >
                    {rightCollapsed ? <PanelRight className="w-4 h-4 text-foreground/70" /> : <PanelRightClose className="w-4 h-4 text-foreground/70" />}
                  </button>
                )}
              </>
            )}

            <CADRuntimeErrorBoundary resetKeys={[glbUrl, hasModel]}>
              <CADCanvas
                ref={canvasRef}
                hasModel={hasModel}
                glbUrl={glbUrl}
                additionalGlbUrls={[]}
                selectedMeshNames={selectedMeshNames}
                hiddenMeshNames={hiddenMeshNames}
                onMeshClick={handleSelectMesh}
                transformMode={transformMode}
                onMeshesDetected={handleMeshesDetected}
                onTransformStart={handleTransformStart}
                onTransformEnd={handleTransformEnd}
                lightIntensity={1}
                onModelReady={handleModelReady}
                magicTexturing={magicTexturing}
                qualityMode="balanced"
                gemMode={gemMode}
                onGemModeForced={(mode) => setGemMode(mode)}
              />
            </CADRuntimeErrorBoundary>

            <AnimatePresence>
              {generationFailed && !isGenerating && !hasModel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 z-[20] flex items-center justify-center"
                >
                  <div className="bg-card border border-border shadow-2xl px-10 py-8 max-w-sm text-center">
                    <div className="font-display text-lg uppercase tracking-[0.15em] text-foreground mb-3">
                      Generation Unavailable
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground leading-[1.8] tracking-wide mb-6">
                      We're really sorry. Something went wrong while generating your design. Our AI generation service may be temporarily unavailable. Please try again in a few minutes.
                    </p>
                    <button
                      onClick={() => setGenerationFailed(false)}
                      className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!hasModel && !isGenerating && !isModelLoading && !generationFailed && (
              <div className="absolute inset-0 z-[10] flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="font-display text-2xl text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">
                    Workspace Ready
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/30 tracking-wide">
                    Your ring will appear here
                  </div>
                </div>
              </div>
            )}

            {hasModel && (
              <ViewportToolbar
                mode={transformMode}
                setMode={setTransformMode}
                transformData={selectedTransform}
                onTransformChange={handleNumericTransformChange}
                onResetTransform={() => handleSceneAction("reset-transform")}
              />
            )}

            {hasModel && !isGenerating && !isModelLoading && (
              <div className="absolute bottom-4 left-4 z-50">
                <GemToggle visible mode={gemMode} onModeChange={setGemMode} />
              </div>
            )}
            {hasModel && !isGenerating && !isModelLoading && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 font-mono text-[9px] h-[30px]">
                <div className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-green-400" />
                <span className="text-muted-foreground/60 uppercase tracking-[0.1em]">Ready</span>
              </div>
            )}

            <ViewportDisplayMenu
              visible={hasModel && !isGenerating && !isModelLoading}
              open={displayMenuOpen}
              onOpenChange={setDisplayMenuOpen}
              onSceneAction={handleSceneAction}
              anchor="side-toolbar"
            />
            <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

            <AnimatePresence>
              {selectionWarning && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none"
                >
                  <div className="pointer-events-auto bg-card border border-border shadow-2xl px-8 py-5 max-w-xs text-center">
                    <div className="font-display text-sm uppercase tracking-[0.15em] text-foreground mb-1.5">No Selection</div>
                    <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{selectionWarning}</p>
                    <button
                      onClick={() => setSelectionWarning(null)}
                      className="mt-4 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      OK
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <GenerationProgress visible={isGenerating || isModelLoading} currentStep={progressStep} retryAttempt={retryAttempt} onRetry={() => simulateGeneration()} />
            <ViewportSideTools
              visible={hasModel && !isGenerating && !isModelLoading}
              onZoomIn={() => canvasRef.current?.zoomIn()}
              onZoomOut={() => canvasRef.current?.zoomOut()}
              onResetView={() => canvasRef.current?.resetCamera()}
              onUndo={handleUndo}
              onRedo={handleRedo}
              undoCount={undoStack.length}
              redoCount={redoStack.length}
              onDownload={handleDownloadGlb}
              onFullscreen={() => {
                const el = document.querySelector('[data-cad-viewport]') as HTMLElement;
                if (el) { document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen(); }
              }}
              onDisplayMenu={() => setDisplayMenuOpen(p => !p)}
              onKeyboardShortcuts={() => setShortcutsOpen(true)}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          ref={rightPanelRef}
          id="right-panel"
          order={3}
          defaultSize={22}
          minSize={15}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onCollapse={() => setRightCollapsed(true)}
          onExpand={() => setRightCollapsed(false)}
        >
          {hasModel && !rightCollapsed && (
            <MeshPanel
              meshes={meshes}
              onSelectMesh={handleSelectMesh}
              onAction={handleMeshAction}
              onApplyMaterial={handleApplyMaterial}
              onSceneAction={handleSceneAction}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
