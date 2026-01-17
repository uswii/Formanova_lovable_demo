# Backend Requirements for Jewelry Generation Pipelines

## Overview

This document specifies the exact requirements for the DAG workflow backend to support the jewelry virtual try-on application. There are **two main pipelines**:

1. **Flux Generation Pipeline** (`flux_gen_pipeline`) - Single jewelry generation with Flux + optional Gemini refinement
2. **All Jewelry Pipeline** (`all_jewelry_pipeline`) - Multi-jewelry generation with skin tone awareness

---

## 1. Mask Convention (CRITICAL)

### Standard Format
All masks must use this convention:
- **BLACK pixels** = Jewelry area
- **WHITE pixels** = Background

### SAM Output Inversion
SAM (Segment Anything Model) outputs masks with WHITE jewelry on BLACK background. 
**The backend MUST invert SAM outputs** before using them for:
- Comparison with input masks
- Fidelity analysis
- Quality metrics calculation

```python
# Pseudocode for mask inversion
def invert_mask(sam_output):
    return 255 - sam_output  # Invert: white→black, black→white
```

---

## 2. Flux Generation Pipeline (`flux_gen_pipeline`)

### Input Parameters
```json
{
  "image": "base64 or Azure URI",      // Original model image
  "mask": "base64 or Azure URI",       // User-marked jewelry mask (BLACK jewelry)
  "jewelry_image": "base64 or Azure URI",  // Reference jewelry image
  "prompt": "string"                   // Generation prompt
}
```

### Required Node Outputs

The `/result/{workflow_id}` endpoint MUST return ALL of these:

#### A. Flux (Standard) Pipeline Outputs
| Key | Type | Description |
|-----|------|-------------|
| `composite.image_base64` | Azure URI | Final composited Flux result image |
| `output_mask.mask_base64` | Azure URI | Detected jewelry mask from Flux output (BLACK jewelry) |
| `quality_metrics` | Object | Metrics + fidelity visualization for Flux |

#### B. Gemini (Enhanced) Pipeline Outputs
| Key | Type | Description |
|-----|------|-------------|
| `composite_gemini.image_base64` | Azure URI | Final composited Gemini-refined result image |
| `output_mask_gemini.mask_base64` | Azure URI | Detected jewelry mask from Gemini output (BLACK jewelry) |
| `quality_metrics_gemini` | Object | Metrics + fidelity visualization for Gemini |

### Quality Metrics Object Structure

Each `quality_metrics` and `quality_metrics_gemini` must contain:

```json
{
  "precision": 0.95,           // TP / (TP + FP) - How much of output jewelry is correct
  "recall": 0.88,              // TP / (TP + FN) - How much of input jewelry was preserved
  "iou": 0.85,                 // Intersection over Union of jewelry regions
  "growth_ratio": 1.08,        // output_area / input_area
  "area_input": 45000,         // Pixel count of input mask jewelry
  "area_output": 48600,        // Pixel count of output mask jewelry
  "fidelity_viz_base64": "azure://...",  // Fidelity visualization image (see below)
  "summary": "Good: 95% precision, 88% recall, minimal bleeding"
}
```

---

## 3. Fidelity Analysis & Visualization

### What is Fidelity Analysis?
Compares the **input mask** (user's marked jewelry region) with the **output mask** (detected jewelry in generated image) to measure how accurately the jewelry was preserved.

### Calculation (Jewelry Pixels Only)

```python
# Both masks: BLACK = jewelry, WHITE = background
# Invert for boolean: jewelry = True

input_jewelry = (input_mask < 128)   # Black pixels = jewelry
output_jewelry = (output_mask < 128) # Black pixels = jewelry

# Calculate metrics on JEWELRY REGION ONLY
intersection = input_jewelry & output_jewelry  # True where both have jewelry
union = input_jewelry | output_jewelry         # True where either has jewelry

TP = count(intersection)                       # Correctly preserved jewelry
FP = count(output_jewelry & ~input_jewelry)    # New jewelry (bleeding/expansion)
FN = count(input_jewelry & ~output_jewelry)    # Lost jewelry (shrinkage)

precision = TP / (TP + FP)  # Of output jewelry, how much was intended
recall = TP / (TP + FN)     # Of input jewelry, how much was preserved
iou = TP / count(union)     # Overall overlap
```

### Fidelity Visualization Image

Generate an overlay on the **result image** (not the masks) with:

| Color | Meaning | Calculation |
|-------|---------|-------------|
| **Green** (30% opacity) | Preserved jewelry | `input_jewelry AND output_jewelry` |
| **Blue** (50% opacity) | Expansion/Bleeding | `output_jewelry AND NOT input_jewelry` |
| **Red** (50% opacity) | Shrinkage/Lost | `input_jewelry AND NOT output_jewelry` |

```python
# Pseudocode for visualization
def create_fidelity_viz(result_image, input_mask, output_mask):
    viz = result_image.copy()
    
    input_jewelry = (input_mask < 128)
    output_jewelry = (output_mask < 128)
    
    # Green overlay where both agree (preserved)
    preserved = input_jewelry & output_jewelry
    viz[preserved] = blend(viz[preserved], GREEN, 0.3)
    
    # Blue overlay where output has extra (expansion)
    expanded = output_jewelry & ~input_jewelry
    viz[expanded] = blend(viz[expanded], BLUE, 0.5)
    
    # Red overlay where input was lost (shrinkage)
    shrunk = input_jewelry & ~output_jewelry
    viz[shrunk] = blend(viz[shrunk], RED, 0.5)
    
    return viz
```

---

## 4. All Jewelry Pipeline (`all_jewelry_pipeline`)

### Input Parameters
```json
{
  "image": "base64 or Azure URI",           // Original model image
  "mask": "base64 or Azure URI",            // User-marked jewelry mask (BLACK jewelry)
  "jewelry_image": "base64 or Azure URI",   // Reference jewelry image
  "jewelry_type": "necklace",               // One of: necklace, earrings, bracelet, ring
  "skin_tone": "medium",                    // One of: light, fair, medium, olive, brown, dark
  "prompt": "string"                        // Base generation prompt
}
```

### Jewelry Type Options
```
- necklace
- earrings  
- bracelet
- ring
```

### Skin Tone Options
```
- light    (Very fair, pale)
- fair     (Light with warm undertones)
- medium   (Moderate, tan)
- olive    (Mediterranean, greenish undertones)
- brown    (Medium-dark)
- dark     (Deep, rich tones)
```

### How to Use These Parameters

1. **Prompt Enhancement**: Include jewelry type and skin tone in generation prompts
   ```
   "A {jewelry_type} on a model with {skin_tone} skin tone, professional photography..."
   ```

2. **Output Mask Generation**: Use jewelry_type to guide SAM segmentation
   - For `necklace`: Focus on neck/chest region
   - For `earrings`: Focus on ear regions
   - For `bracelet`: Focus on wrist regions
   - For `ring`: Focus on finger regions

3. **Skin Tone Awareness**: Adjust generation parameters for realistic lighting/reflection on different skin tones

### Required Node Outputs (Same Structure as Flux Pipeline)

```json
{
  "composite": {
    "image_base64": "azure://..."
  },
  "output_mask": {
    "mask_base64": "azure://..."
  },
  "quality_metrics": {
    "precision": 0.92,
    "recall": 0.85,
    "iou": 0.80,
    "growth_ratio": 1.05,
    "area_input": 42000,
    "area_output": 44100,
    "fidelity_viz_base64": "azure://...",
    "summary": "Good: jewelry preserved with 92% precision"
  },
  "composite_gemini": {
    "image_base64": "azure://..."
  },
  "output_mask_gemini": {
    "mask_base64": "azure://..."
  },
  "quality_metrics_gemini": {
    "precision": 0.96,
    "recall": 0.90,
    "iou": 0.87,
    "growth_ratio": 1.03,
    "area_input": 42000,
    "area_output": 43260,
    "fidelity_viz_base64": "azure://...",
    "summary": "Excellent: Gemini refinement improved precision to 96%"
  }
}
```

---

## 5. DAG Structure Recommendations

### Flux Gen Pipeline DAG

```yaml
nodes:
  # Existing nodes...
  resize_image:
    inputs: [image]
  
  resize_mask:
    inputs: [mask]
  
  flux_generate:
    inputs: [resize_image, resize_mask, jewelry_image, prompt]
  
  composite:
    inputs: [flux_generate, resize_image, resize_mask]
    outputs: [image_base64]  # ← MUST be returned
  
  # NEW: Output mask detection for Flux
  output_mask:
    inputs: [composite]
    operation: sam_segment_jewelry
    post_process: invert_mask  # WHITE→BLACK jewelry
    outputs: [mask_base64]     # ← MUST be returned
  
  # NEW: Quality metrics for Flux
  quality_metrics:
    inputs: [composite, resize_mask, output_mask]
    operation: calculate_fidelity
    outputs: [precision, recall, iou, growth_ratio, fidelity_viz_base64, summary]
  
  # Gemini branch
  gemini_refine:
    inputs: [composite]
  
  composite_gemini:
    inputs: [gemini_refine, resize_image, resize_mask]
    outputs: [image_base64]  # ← MUST be returned
  
  # NEW: Output mask detection for Gemini
  output_mask_gemini:
    inputs: [composite_gemini]
    operation: sam_segment_jewelry
    post_process: invert_mask
    outputs: [mask_base64]   # ← MUST be returned
  
  # Gemini quality metrics
  quality_metrics_gemini:
    inputs: [composite_gemini, resize_mask, output_mask_gemini]
    operation: calculate_fidelity
    outputs: [precision, recall, iou, growth_ratio, fidelity_viz_base64, summary]

# Terminal nodes - ALL must be returned
terminal_nodes:
  - composite
  - output_mask
  - quality_metrics
  - composite_gemini
  - output_mask_gemini
  - quality_metrics_gemini
```

### All Jewelry Pipeline DAG

Same structure as above, but with additional input handling:

```yaml
inputs:
  image: base64
  mask: base64
  jewelry_image: base64
  jewelry_type: enum[necklace, earrings, bracelet, ring]
  skin_tone: enum[light, fair, medium, olive, brown, dark]
  prompt: string

nodes:
  prompt_enhance:
    inputs: [prompt, jewelry_type, skin_tone]
    operation: enhance_prompt_with_context
  
  # Use jewelry_type for region-aware mask generation
  output_mask:
    inputs: [composite, jewelry_type]
    operation: sam_segment_jewelry_by_type
    post_process: invert_mask
  
  # ... rest same as flux_gen_pipeline
```

---

## 6. API Response Format

### `/result/{workflow_id}` Response

```json
{
  "workflow_id": "flux-abc123",
  "status": "completed",
  "results": {
    "composite": [{
      "image_base64": {
        "uri": "azure://agentic-artifacts/2026-01-17/.../composite.png"
      }
    }],
    "output_mask": [{
      "mask_base64": {
        "uri": "azure://agentic-artifacts/2026-01-17/.../output_mask.png"
      }
    }],
    "quality_metrics": [{
      "precision": 0.95,
      "recall": 0.88,
      "iou": 0.85,
      "growth_ratio": 1.08,
      "area_input": 45000,
      "area_output": 48600,
      "fidelity_viz_base64": {
        "uri": "azure://agentic-artifacts/2026-01-17/.../fidelity_viz.png"
      },
      "summary": "Good: 95% precision, 88% recall"
    }],
    "composite_gemini": [{
      "image_base64": {
        "uri": "azure://agentic-artifacts/2026-01-17/.../composite_gemini.png"
      }
    }],
    "output_mask_gemini": [{
      "mask_base64": {
        "uri": "azure://agentic-artifacts/2026-01-17/.../output_mask_gemini.png"
      }
    }],
    "quality_metrics_gemini": [{
      "precision": 0.97,
      "recall": 0.92,
      "iou": 0.90,
      "growth_ratio": 1.03,
      "area_input": 45000,
      "area_output": 46350,
      "fidelity_viz_base64": {
        "uri": "azure://agentic-artifacts/2026-01-17/.../fidelity_viz_gemini.png"
      },
      "summary": "Excellent: Gemini improved to 97% precision"
    }]
  }
}
```

---

## 7. Summary Checklist

### For Backend Team:

- [ ] **Invert SAM masks** to BLACK jewelry on WHITE background
- [ ] **Return composite images** for both Flux and Gemini
- [ ] **Return output masks** for both Flux and Gemini
- [ ] **Calculate fidelity metrics** on jewelry pixels only
- [ ] **Generate fidelity visualization** with green/blue/red overlays
- [ ] **Include summary strings** in quality metrics
- [ ] **Handle jewelry_type parameter** in all-jewelry pipeline
- [ ] **Handle skin_tone parameter** in all-jewelry pipeline
- [ ] **Configure DAG** to return ALL terminal node outputs, not just the last one

### Questions for Backend Team:

1. Can the DAG runner be configured to return outputs from multiple terminal nodes?
2. Is there a `collect_outputs` node pattern available?
3. How will `jewelry_type` and `skin_tone` influence the generation prompt?
4. Will SAM segmentation be region-aware based on `jewelry_type`?

---

## 8. Frontend Display

The frontend will display results in two tabs:

### Standard (Flux) Tab
- Shows `composite.image_base64`
- Shows `quality_metrics` values
- Toggle to show `fidelity_viz_base64` overlay

### Enhanced (Gemini) Tab
- Shows `composite_gemini.image_base64`
- Shows `quality_metrics_gemini` values
- Toggle to show `fidelity_viz_base64` overlay

### Metrics Display
```
┌─────────────────────────────────────┐
│  Precision: 95%  │  Recall: 88%    │
│  IoU: 85%        │  Growth: +8%    │
├─────────────────────────────────────┤
│  Summary: Good - jewelry preserved  │
│  with minimal bleeding              │
└─────────────────────────────────────┘
```
