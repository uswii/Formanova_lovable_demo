# text-to-cad components

## Protected files -- DO NOT MODIFY
- `CADCanvas.tsx` -- 3D canvas, GLB loading, mesh selection, transform gizmos
- `GemInstanceRenderer.ts` -- instanced gem rendering
- Do not touch WebGL context management, `_isTransformDragging`, or `SELECTION_MATERIAL`

## CADCanvas.tsx

Ref-based imperative API (`CADCanvasHandle`) -- all mesh operations go through this ref, never via props:

```ts
applyMaterial(matId: string, meshNames: string[])
resetTransform / deleteMeshes / duplicateMeshes / flipNormals / centerOrigin
subdivideMesh(meshNames, iterations) / smoothMesh(meshNames, iterations)
setWireframe(on: boolean)
applyTransform(meshNames) -- bakes current transform into geometry
removeAllTextures() / applyMagicTextures()
getSnapshot() / restoreSnapshot(snap)     -- undo/redo
exportSceneBlob() / exportSceneStlBlob(scaleMm) / exportSceneRawBlob()
zoomIn() / zoomOut() / resetCamera()
```

Props:
- `glbUrl` -- primary model URL; `additionalGlbUrls` -- secondary overlays
- `selectedMeshNames: Set<string>` -- drives selection highlight
- `hiddenMeshNames?: Set<string>`
- `transformMode: string` -- "orbit" | "translate" | "rotate" | "scale"
- `onMeshesDetected` fires once after GLB load with `{ name, verts, faces }[]`
- `onModelReady` fires after first render is complete
- `qualityMode?: QualityMode` -- "performance" | "balanced" | "quality"
- `gemMode?: GemMode` -- "simple" | "refraction"; can be overridden by GPU detection via `onGemModeForced`

Multi-mesh transform: all selected meshes rotate/scale around a shared bounding-box pivot. Do not break this by setting transforms individually.

## LeftPanel.tsx

Props (all required unless marked):
```ts
model / setModel         -- AI model id ("gemini" | "claude-opus")
prompt / setPrompt       -- initial generation prompt
editPrompt / setEditPrompt
isGenerating / isEditing / hasModel  -- booleans that gate UI sections
onGenerate / onEdit      -- trigger generation/edit
magicTexturing / onMagicTexturingChange
onGlbUpload(file: File)
onRebuildPart?(partId, description)  -- optional, gated by CAD_EDIT_TOOLS_ENABLED
onAddPart?(description)              -- optional, gated by CAD_EDIT_TOOLS_ENABLED
onReset?()
creditBlock?: React.ReactNode        -- slot for credit cost display
```

AI model selector is commented out (hidden until model selection ships). Do not re-enable it without a feature flag.

## MeshPanel.tsx

Props:
```ts
meshes: MeshItemData[]           -- from CADCanvas onMeshesDetected
onSelectMesh(name, multi: bool)  -- multi=true on Shift/Ctrl click
onAction(action: string)         -- mesh-level ops ("delete", "duplicate", etc.)
onApplyMaterial(matId: string)
onSceneAction(action: string)    -- scene-level ops
```

Material library split into `"metal"` and `"gemstone"` tabs. Source of truth is `MATERIAL_LIBRARY` in `src/components/cad-studio/materials.ts` -- do not duplicate it here.

## ViewportOverlays.tsx

Stateless display components only -- no direct Three.js access:
- `ViewportToolbar` -- orbit/translate/rotate/scale mode buttons
- `ProgressOverlay` -- generation progress bar + step text

## types.ts

Central constants for this directory:
- `AI_MODELS`, `QUICK_EDITS`, `PART_REGEN_PARTS`, `TRANSFORM_MODES`, `PROGRESS_STEPS`
- `MeshItemData`, `StatsData` interfaces
- Re-exports `MATERIAL_LIBRARY` and material types from `cad-studio/materials`

## Key invariants
- Material definitions live in `src/components/cad-studio/materials.ts` only. Never copy them here.
- `CAD_EDIT_TOOLS_ENABLED` in `src/lib/feature-flags.ts` is `false` -- Edit/Rebuild UI is hidden. Do not render those sections unconditionally.
- `CAD_MODEL_SELECTOR_ENABLED` is `false` -- model quality picker stays hidden.
- All PostHog events must be imported from `src/lib/posthog-events.ts`, never from `posthog-js` directly.
