# Backend Requirements - Plain Explanation

Hey, here's what we need from the backend for both pipelines:

---

## Mask Convention (IMPORTANT!)

Our masks use **BLACK = jewelry, WHITE = background**.

SAM outputs WHITE jewelry on BLACK background - so you need to **invert SAM outputs** before comparing with input masks or doing any fidelity analysis.

**UPDATE:** Frontend no longer inverts masks. Backend is fully responsible for returning all masks with black=jewelry convention.

---

## Flux Gen Pipeline - What to Return

We need **6 outputs** from `/result/{workflow_id}`:

1. `composite.image_base64` - The Flux result image (Azure URI)
2. `output_mask.mask_base64` - Jewelry mask detected from Flux output (inverted to BLACK jewelry)
3. `quality_metrics` - Object with precision, recall, iou, growth_ratio, fidelity_viz_base64, summary
4. `composite_gemini.image_base64` - The Gemini-refined result image (Azure URI)
5. `output_mask_gemini.mask_base64` - Jewelry mask detected from Gemini output (inverted to BLACK jewelry)
6. `quality_metrics_gemini` - Same structure as quality_metrics but for Gemini

---

## Fidelity Analysis - How It Works

Compare ONLY the jewelry pixels between input mask and output mask:

- **Precision** = How much of the output jewelry was actually intended (TP / output_jewelry_pixels)
- **Recall** = How much of the input jewelry was preserved (TP / input_jewelry_pixels)
- **IoU** = Intersection over Union of jewelry regions
- **Growth Ratio** = output_area / input_area (>1 means expansion, <1 means shrinkage)

---

## Fidelity Visualization

Generate an overlay image on the result showing:

- **GREEN (30% opacity)** = Preserved jewelry (input AND output both have jewelry here)
- **BLUE (50% opacity)** = Expansion/bleeding (output has jewelry but input didn't)
- **RED (50% opacity)** = Shrinkage (input had jewelry but output lost it)

Return this as `fidelity_viz_base64` (Azure URI) in the quality_metrics object.

---

## All Jewelry Pipeline - Additional Inputs

For the all-jewelry pipeline, frontend will send:

**jewelry_type**: `necklace | earrings | bracelet | ring`
**skin_tone**: `light | fair | medium | olive | brown | dark`

Use these for:
1. Prompt enhancement (include type and skin tone in generation prompt)
2. Region-aware mask detection (SAM should focus on relevant body area based on jewelry type)

This pipeline also needs the same 6 outputs (composite, output_mask, quality_metrics for both Flux and Gemini).

---

## Example Response Format

```json
{
  "composite": [{ "image_base64": { "uri": "azure://..." } }],
  "output_mask": [{ "mask_base64": { "uri": "azure://..." } }],
  "quality_metrics": [{
    "precision": 0.95,
    "recall": 0.88,
    "iou": 0.85,
    "growth_ratio": 1.08,
    "fidelity_viz_base64": { "uri": "azure://..." },
    "summary": "Good: 95% precision, 88% recall"
  }],
  "composite_gemini": [{ "image_base64": { "uri": "azure://..." } }],
  "output_mask_gemini": [{ "mask_base64": { "uri": "azure://..." } }],
  "quality_metrics_gemini": [{
    "precision": 0.97,
    "recall": 0.92,
    "iou": 0.90,
    "growth_ratio": 1.03,
    "fidelity_viz_base64": { "uri": "azure://..." },
    "summary": "Excellent: Gemini improved to 97% precision"
  }]
}
```

---

## Key Questions for You

1. Can DAG return all 6 outputs instead of just the terminal node?
2. How will you use jewelry_type and skin_tone in the pipeline?
3. Is SAM inversion happening before quality metrics calculation?
