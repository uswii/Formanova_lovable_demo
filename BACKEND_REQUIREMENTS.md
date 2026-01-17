# Backend Requirements - Plain Explanation

Hey, here's what we need from the backend for both pipelines:

---

## Mask Convention (IMPORTANT!)

Our masks use **BLACK = jewelry, WHITE = background**.

SAM outputs WHITE jewelry on BLACK background - so you need to **invert SAM outputs** before comparing with input masks or doing any fidelity analysis.

**UPDATE:** Frontend no longer inverts masks. Backend is fully responsible for returning all masks with black=jewelry convention.

✅ DAG correctly handles this with `mask_invert_flux`, `mask_invert_gemini`, `mask_invert`, and `mask_invert_final` steps.

---

## Flux Gen Pipeline - Expected Outputs

From `/result/{workflow_id}` we need these terminal nodes:

| Output Key | DAG Node | Description |
|------------|----------|-------------|
| `composite` | `composite` | Flux result image (Azure URI) |
| `output_mask` | `mask_invert_flux` | Jewelry mask from Flux output (BLACK=jewelry) |
| `quality_metrics` | `quality_metrics` | Precision, recall, IoU, growth_ratio, fidelity_viz, summary |
| `composite_gemini` | `composite_gemini` | Gemini-refined result image (Azure URI) |
| `output_mask_gemini` | `mask_invert_gemini` | Jewelry mask from Gemini output (BLACK=jewelry) |
| `quality_metrics_gemini` | `quality_metrics_gemini` | Same structure for Gemini |

---

## All Jewelry Pipeline - Expected Outputs

| Output Key | DAG Node | Description |
|------------|----------|-------------|
| `gemini_viton` | `gemini_viton` | Standard VITON result (AI-generated jewelry) |
| `transform_apply` | `transform_apply` | Final result (original jewelry transformed) |
| `output_mask` | `mask_invert` | Mask from VITON result (BLACK=jewelry) |
| `output_mask_final` | `mask_invert_final` | Mask from final composite (BLACK=jewelry) |
| `quality_metrics` | `quality_metrics` | Fidelity analysis between transformed input mask and final output mask |

---

## Quality Metrics Structure

Each `quality_metrics` node should return:

```json
{
  "precision": 0.95,
  "recall": 0.88,
  "iou": 0.85,
  "growth_ratio": 1.08,
  "fidelity_viz_base64": { "uri": "azure://..." },
  "summary": "Good: 95% precision, 88% recall"
}
```

### Fidelity Visualization Colors:
- **GREEN (30% opacity)** = Preserved jewelry (input AND output both have jewelry)
- **BLUE (50% opacity)** = Expansion/bleeding (output has jewelry but input didn't)
- **RED (50% opacity)** = Shrinkage (input had jewelry but output lost it)

---

## All Jewelry Pipeline Inputs

Frontend sends:

| Parameter | Values |
|-----------|--------|
| `jewelry_type` | `necklace`, `earrings`, `bracelet`, `ring` |
| `skin_tone` | `light`, `fair`, `medium`, `olive`, `brown`, `dark` |

✅ DAG correctly uses these in `gemini_sketch`, `gemini_viton`, and `output_mask_*` text prompts.

---

## DAG Structure Confirmed ✅

**flux_gen_pipeline:**
```
resize_image + resize_mask → white_bg_segmenter → flux_fill → upscaler → composite
                                                                            ↓
                                                                     output_mask → mask_invert_flux → quality_metrics
                                                                            ↓
                                                                     resize_for_gemini → gemini_router → gemini_refine → upscaler_gemini → composite_gemini
                                                                                                                                              ↓
                                                                                                                     output_mask_gemini → mask_invert_gemini → quality_metrics_gemini
```

**all_jewelry_generation:**
```
resize → gemini_sketch + segment_green_bg → composite_all_jewelry → gemini_viton → gemini_quality_check
                                                                         ↓
                                                              output_mask_all_jewelry → mask_invert → transform_detect → transform_mask
                                                                         ↓                                    ↓
                                                              gemini_hand_inpaint ←─────────────────────────────┘
                                                                         ↓
                                                                   transform_apply → output_mask_final → mask_invert_final → quality_metrics
```

---

## Questions Resolved

1. ✅ DAG returns all required outputs as terminal nodes
2. ✅ jewelry_type used in gemini_sketch, gemini_viton, and output_mask text_prompt
3. ✅ skin_tone used in gemini_viton
4. ✅ SAM inversion happens via mask_invert_* nodes before quality_metrics
