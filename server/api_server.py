#!/usr/bin/env python3
"""
FormaNova API Server (Complete Version)
Run on A100 server to expose jewelry generation endpoints.

Usage:
    cd /home/bilal/uswa/viton_jewelry_model
    /home/bilal/viton_jewelry_model/.venv/bin/python api_server.py

Endpoints:
    GET  /health              - Check if server is online
    GET  /examples            - Get example gallery images
    POST /segment             - Run SAM segmentation on image with click points
    POST /refine-mask         - Apply brush edits to mask
    POST /generate            - Generate photoshoot from image + mask
"""

import os
import sys
import subprocess
from pathlib import Path

# ═════════════════════════════════════════════════════════════════════
# AUTO-INSTALL DEPENDENCIES
# ═════════════════════════════════════════════════════════════════════
def auto_install():
    """Auto-install required packages if missing"""
    required = ["fastapi", "uvicorn", "python-multipart"]
    pip_path = Path("/home/bilal/viton_jewelry_model/.venv/bin/pip")
    
    for pkg in required:
        try:
            __import__(pkg.replace("-", "_"))
        except ImportError:
            print(f"Installing {pkg}...")
            subprocess.check_call([str(pip_path), "install", "-q", pkg])

auto_install()

import base64
import io
import logging
import time
import uuid
import glob
from typing import List, Optional, Dict, Any

# ═════════════════════════════════════════════════════════════════════
# VENV ISOLATION (same as your app_nb.py)
# ═════════════════════════════════════════════════════════════════════
APP_VENV_PY = Path("/home/bilal/viton_jewelry_model/.venv/bin/python").resolve()
if Path(sys.executable).resolve() != APP_VENV_PY:
    os.environ["PYTHONNOUSERSITE"] = "1"
    os.environ.pop("PYTHONPATH", None)
    os.execv(str(APP_VENV_PY), [str(APP_VENV_PY), __file__, *sys.argv[1:]])

os.environ["PYTHONNOUSERSITE"] = "1"
os.environ.setdefault("PYTHONUNBUFFERED", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

# Now import everything
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
import numpy as np
from PIL import Image
import torch
import cv2

# Import your existing modules
from models_init import get_flux_pipeline, get_sam_predictor, get_birefnet_model, upscale_with_external_script
from utils import (
    TransformTracker,
    segment_image_on_transparent_background,
    segment_image_on_white_background,
    process_mask,
    resize_to_fixed_dimensions,
    remove_background_birefnet,
    downscale_for_flux,
    extract_masked_region,
    paste_masked_region_on_upscaled,
    binarize_mask,
    adjust_mask,
    composite_zero_transformation_improved,
    get_jewelry_only_mask,
    compare_masks,
    run_sam_on_image,
)
from gemini_refinement import refine_with_gemini

# ═════════════════════════════════════════════════════════════════════
# LOGGING
# ═════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger(__name__)

# ═════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═════════════════════════════════════════════════════════════════════
DILATION_PX = 1
APP_ROOT = Path("/home/bilal/uswa/viton_jewelry_model").resolve()
OUTPUT_DIR = APP_ROOT / "api_outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Example gallery path - update this to your actual examples folder
EXAMPLES_DIR = APP_ROOT / "examples"

# ═════════════════════════════════════════════════════════════════════
# GLOBAL MODELS (loaded once at startup)
# ═════════════════════════════════════════════════════════════════════
inference_pipe = None
sam_predictor = None
birefnet_model = None
models_loaded = False

def load_models():
    global inference_pipe, sam_predictor, birefnet_model, models_loaded
    if models_loaded:
        return
    
    log.info("Loading models...")
    log.info("Loading Flux...")
    inference_pipe = get_flux_pipeline()
    log.info("Loading SAM...")
    sam_predictor = get_sam_predictor()
    log.info("Loading BiRefNet...")
    birefnet_model = get_birefnet_model()
    log.info("✓ All models loaded!")
    models_loaded = True

# ═════════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═════════════════════════════════════════════════════════════════════
app = FastAPI(
    title="FormaNova API",
    description="AI Jewelry Photography API",
    version="1.0.0"
)

# CORS - allow all origins for the Lovable frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═════════════════════════════════════════════════════════════════════
class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    gpu_available: bool
    gpu_name: Optional[str] = None
    message: str

class ExampleImage(BaseModel):
    id: str
    name: str
    image_base64: str
    thumbnail_base64: Optional[str] = None

class ExamplesResponse(BaseModel):
    examples: List[ExampleImage]

class SegmentRequest(BaseModel):
    image_base64: str  # Base64 encoded image
    points: List[List[float]]  # [[x1, y1], [x2, y2], ...]

class SegmentResponse(BaseModel):
    mask_base64: str
    mask_overlay_base64: str
    processed_image_base64: str
    original_mask_base64: str  # Before dilation
    session_id: str
    image_width: int
    image_height: int

class RefineMaskRequest(BaseModel):
    original_image_base64: str
    current_mask_base64: str
    brush_strokes: List[Dict[str, Any]]  # [{type: "add"|"remove", points: [[x,y]...], radius: int}]

class RefineMaskResponse(BaseModel):
    mask_base64: str
    mask_overlay_base64: str

class GenerateRequest(BaseModel):
    image_base64: str  # Original image (base64) - 2000x2667
    mask_base64: str   # Edited mask image (base64)
    original_mask_base64: Optional[str] = None  # Original SAM mask before edits
    gender: str = "female"  # "male" or "female"
    use_gemini: bool = True  # Whether to use Gemini refinement
    scaled_points: Optional[List[List[float]]] = None  # For remask analysis

class GenerateResponse(BaseModel):
    result_base64: str  # Final Flux result image
    result_gemini_base64: Optional[str] = None  # Gemini refined result
    fidelity_viz_base64: Optional[str] = None  # Fidelity visualization
    metrics: Optional[Dict[str, float]] = None  # Fidelity metrics
    session_id: str

# ═════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═════════════════════════════════════════════════════════════════════
def base64_to_pil(base64_str: str) -> Image.Image:
    """Convert base64 string to PIL Image"""
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    image_data = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(image_data))

def pil_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert PIL Image to base64 string"""
    if image is None:
        return None
    buffered = io.BytesIO()
    if format.upper() == "JPEG" and image.mode == "RGBA":
        image = image.convert("RGB")
    image.save(buffered, format=format, quality=95 if format.upper() == "JPEG" else None)
    return base64.b64encode(buffered.getvalue()).decode()

def should_remove_background(image: Image.Image) -> bool:
    """Detect if image has a removable background"""
    try:
        img_array = np.array(image.convert("RGB"))
        h, w = img_array.shape[:2]
        sample_size = min(20, h // 10, w // 10)
        
        edge_pixels = []
        edge_pixels.extend(img_array[0:sample_size, :].reshape(-1, 3))
        edge_pixels.extend(img_array[h - sample_size:h, :].reshape(-1, 3))
        edge_pixels.extend(img_array[:, 0:sample_size].reshape(-1, 3))
        edge_pixels.extend(img_array[:, w - sample_size:w].reshape(-1, 3))
        
        edge_pixels = np.array(edge_pixels)
        edge_std = np.std(edge_pixels, axis=0).mean()
        
        return edge_std < 90
    except:
        return False

def create_overlay_visualization(image: Image.Image, mask: Image.Image) -> Image.Image:
    """Create green overlay visualization"""
    img_rgb = image.convert("RGB")
    bin_mask = binarize_mask(mask, 128)
    overlay = img_rgb.copy()
    arr = np.array(overlay)
    mask_arr = np.array(bin_mask)
    
    green_layer = np.zeros_like(arr)
    green_layer[mask_arr == 255] = [0, 255, 0]
    arr = cv2.addWeighted(arr, 0.7, green_layer, 0.3, 0)
    
    return Image.fromarray(arr)

def create_binary_mask_display(mask: Image.Image) -> Image.Image:
    """Create binary black/white mask display"""
    binary = binarize_mask(mask, 128)
    display = Image.new("RGB", binary.size, (0, 0, 0))
    white_pixels = np.array(binary) == 255
    arr = np.array(display)
    arr[white_pixels] = [255, 255, 255]
    return Image.fromarray(arr)

def create_fidelity_visualization(original, generated, mask_input, mask_generated):
    """Create overlay showing correct (green) and expansion (blue) areas"""
    mask_input_arr = np.array(mask_input.convert("L")) > 128
    mask_generated_arr = np.array(mask_generated.convert("L")) > 128
    
    generated_rgb = np.array(generated.convert("RGB"))
    overlay = generated_rgb.copy()
    
    # GREEN: Correct regions
    correct = mask_input_arr & mask_generated_arr
    overlay[correct] = cv2.addWeighted(
        overlay[correct], 0.7,
        np.full_like(overlay[correct], [0, 255, 0]), 0.3, 0
    )
    
    # BLUE: Expansion
    expansion = (~mask_input_arr) & mask_generated_arr
    overlay[expansion] = cv2.addWeighted(
        overlay[expansion], 0.5,
        np.full_like(overlay[expansion], [0, 191, 255]), 0.5, 0
    )
    
    return Image.fromarray(overlay)

# ═════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═════════════════════════════════════════════════════════════════════
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the API server is running and models are loaded"""
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
    
    return HealthResponse(
        status="online",
        models_loaded=models_loaded,
        gpu_available=gpu_available,
        gpu_name=gpu_name,
        message="FormaNova API is ready" if models_loaded else "Models loading..."
    )

@app.get("/examples", response_model=ExamplesResponse)
async def get_examples():
    """Get example gallery images"""
    examples = []
    
    if EXAMPLES_DIR.exists():
        for i, img_path in enumerate(sorted(EXAMPLES_DIR.glob("*.jpg")) + sorted(EXAMPLES_DIR.glob("*.png"))):
            try:
                img = Image.open(img_path)
                
                # Create thumbnail
                thumb = img.copy()
                thumb.thumbnail((300, 300), Image.Resampling.LANCZOS)
                
                examples.append(ExampleImage(
                    id=f"example_{i}",
                    name=img_path.stem,
                    image_base64=pil_to_base64(img, "JPEG"),
                    thumbnail_base64=pil_to_base64(thumb, "JPEG")
                ))
            except Exception as e:
                log.warning(f"Failed to load example {img_path}: {e}")
    
    return ExamplesResponse(examples=examples)

@app.post("/segment", response_model=SegmentResponse)
async def segment_jewelry(request: SegmentRequest):
    """
    Run SAM segmentation on the uploaded image with click points.
    Returns the mask and overlay visualization.
    """
    if not models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet. Please wait.")
    
    session_id = f"api_{uuid.uuid4().hex[:8]}"
    log.info(f"[{session_id}] Starting segmentation with {len(request.points)} points")
    
    try:
        # Decode image
        image_pil = base64_to_pil(request.image_base64)
        points = request.points
        
        if not points:
            raise HTTPException(status_code=400, detail="No click points provided")
        
        original_image = image_pil.copy()
        
        # Background removal if needed
        if should_remove_background(image_pil):
            log.info(f"[{session_id}] Removing background...")
            image_no_bg = remove_background_birefnet(image_pil, birefnet_model, bg_color=(250, 250, 250))
        else:
            log.info(f"[{session_id}] Skipping background removal (close-up detected)")
            image_no_bg = image_pil.copy()
        
        # Resize to fixed dimensions (2000x2667)
        image_highres_nobg, tracker = resize_to_fixed_dimensions(image_no_bg, 2000, 2667)
        image_highres_original, _ = resize_to_fixed_dimensions(original_image, 2000, 2667)
        
        # Transform points to new coordinates
        scaled_points = tracker.transform_points(points)
        log.info(f"[{session_id}] Transformed points: {scaled_points}")
        
        # Run SAM
        log.info(f"[{session_id}] Running SAM...")
        sam_predictor.set_image(np.array(image_highres_nobg))
        
        scaled_points_np = np.array(scaled_points)
        labels = np.ones(len(scaled_points), dtype=int)
        
        masks, scores, logits = sam_predictor.predict(
            point_coords=scaled_points_np,
            point_labels=labels,
            multimask_output=False
        )
        
        log.info(f"[{session_id}] SAM complete, score: {scores[0]:.3f}")
        
        # Process mask
        mask_array = (masks[0] * 255).astype(np.uint8)
        mask_pil_original = Image.fromarray(mask_array).convert("L")
        mask_pil_original = process_mask(mask_pil_original, invert=False)
        
        # Dilate mask
        mask_dilated = adjust_mask(mask_pil_original, DILATION_PX)
        
        # Create overlay visualization
        overlay = create_overlay_visualization(image_highres_original, mask_dilated)
        
        log.info(f"[{session_id}] Segmentation complete!")
        
        return SegmentResponse(
            mask_base64=pil_to_base64(mask_dilated, "PNG"),
            mask_overlay_base64=pil_to_base64(overlay, "JPEG"),
            processed_image_base64=pil_to_base64(image_highres_original, "JPEG"),
            original_mask_base64=pil_to_base64(mask_pil_original, "PNG"),
            session_id=session_id,
            image_width=2000,
            image_height=2667
        )
        
    except Exception as e:
        log.error(f"[{session_id}] Segmentation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refine-mask", response_model=RefineMaskResponse)
async def refine_mask(request: RefineMaskRequest):
    """
    Apply brush edits to the mask.
    Brush strokes: add (green) or remove (black) regions.
    """
    try:
        original_image = base64_to_pil(request.original_image_base64).convert("RGB")
        current_mask = base64_to_pil(request.current_mask_base64).convert("L")
        
        mask_arr = np.array(current_mask)
        
        for stroke in request.brush_strokes:
            stroke_type = stroke.get("type", "add")
            points = stroke.get("points", [])
            radius = stroke.get("radius", 10)
            
            for point in points:
                x, y = int(point[0]), int(point[1])
                cv2.circle(
                    mask_arr,
                    (x, y),
                    radius,
                    255 if stroke_type == "add" else 0,
                    -1  # Filled
                )
        
        refined_mask = Image.fromarray(mask_arr)
        overlay = create_overlay_visualization(original_image, refined_mask)
        
        return RefineMaskResponse(
            mask_base64=pil_to_base64(refined_mask, "PNG"),
            mask_overlay_base64=pil_to_base64(overlay, "JPEG")
        )
        
    except Exception as e:
        log.error(f"Mask refinement failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=GenerateResponse)
async def generate_photoshoot(request: GenerateRequest):
    """
    Generate a photoshoot from the image and mask.
    Returns the final result with jewelry composited.
    """
    if not models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet. Please wait.")
    
    session_id = f"gen_{uuid.uuid4().hex[:8]}"
    log.info(f"[{session_id}] Starting generation (gender={request.gender}, gemini={request.use_gemini})")
    
    try:
        # Decode inputs
        original_2667 = base64_to_pil(request.image_base64).convert("RGB")
        mask_edited_2667 = base64_to_pil(request.mask_base64).convert("L")
        
        # Get original mask if provided
        if request.original_mask_base64:
            mask_original = base64_to_pil(request.original_mask_base64).convert("L")
        else:
            mask_original = mask_edited_2667.copy()
        
        # Ensure correct size
        if original_2667.size != (2000, 2667):
            original_2667 = original_2667.resize((2000, 2667), Image.Resampling.LANCZOS)
        if mask_edited_2667.size != (2000, 2667):
            mask_edited_2667 = mask_edited_2667.resize((2000, 2667), Image.Resampling.LANCZOS)
        
        # Expand mask for Flux (11px dilation for blend region)
        log.info(f"[{session_id}] Expanding mask for Flux...")
        mask_dilated_expanded = adjust_mask(mask_edited_2667, 11)
        
        # ═════════════════════════════════════════════════════════════
        # FLUX GENERATION
        # ═════════════════════════════════════════════════════════════
        image_1024 = downscale_for_flux(original_2667, 768, 1024)
        mask_1024 = mask_dilated_expanded.resize((768, 1024), Image.Resampling.NEAREST)
        mask_1024_inverted = Image.eval(mask_1024, lambda x: 255 - x)
        image_1024_segmented = segment_image_on_white_background(image_1024, mask_1024)
        
        prompt = f"Necklace worn by {request.gender} model"
        log.info(f"[{session_id}] Running Flux: {prompt}")
        
        flux_output_768 = inference_pipe(
            prompt=prompt,
            image=image_1024_segmented,
            mask_image=mask_1024_inverted,
            width=768,
            height=1024,
            guidance_scale=40,
            num_inference_steps=40
        ).images[0]
        
        # Upscale to 2000x2667
        log.info(f"[{session_id}] Upscaling...")
        flux_enhanced_2667 = upscale_with_external_script(flux_output_768, 2000, 2667)
        
        # ═════════════════════════════════════════════════════════════
        # NON-COMPOSITE (strict jewelry paste)
        # ═════════════════════════════════════════════════════════════
        strict_alpha = binarize_mask(mask_edited_2667, 128)
        strict_rgba = original_2667.convert("RGBA")
        strict_rgba.putalpha(strict_alpha)
        
        result_flux = paste_masked_region_on_upscaled(
            strict_rgba,
            flux_enhanced_2667,
            mode='non-composite'
        )
        
        # ═════════════════════════════════════════════════════════════
        # GEMINI REFINEMENT (optional)
        # ═════════════════════════════════════════════════════════════
        result_gemini = None
        if request.use_gemini:
            try:
                log.info(f"[{session_id}] Running Gemini refinement...")
                gemini_bg = refine_with_gemini(
                    generated_image_2667=result_flux,
                    original_image_2667=original_2667,
                    mask_edited_2667=mask_edited_2667,
                    upscale_fn=upscale_with_external_script,
                    composite_fn=composite_zero_transformation_improved,
                    session_id=session_id,
                    session_dirs=None
                )
                
                result_gemini = paste_masked_region_on_upscaled(
                    strict_rgba,
                    gemini_bg,
                    mode='non-composite'
                )
                log.info(f"[{session_id}] Gemini refinement complete!")
            except Exception as e:
                log.warning(f"[{session_id}] Gemini failed: {e}")
                result_gemini = None
        
        # ═════════════════════════════════════════════════════════════
        # FIDELITY ANALYSIS (optional - if points provided)
        # ═════════════════════════════════════════════════════════════
        fidelity_viz = None
        metrics = None
        
        if request.scaled_points:
            try:
                result_for_metrics = result_gemini if result_gemini else result_flux
                
                # Re-run SAM on final output
                mask_generated = run_sam_on_image(result_for_metrics, request.scaled_points, sam_predictor)
                mask_generated_dilated = adjust_mask(mask_generated, DILATION_PX)
                
                # Apply same brush edits
                input_original_arr = np.array(mask_original.resize((2000, 2667), Image.Resampling.NEAREST))
                input_edited_arr = np.array(mask_edited_2667)
                mask_generated_arr = np.array(mask_generated_dilated)
                
                additions = (input_edited_arr > input_original_arr)
                removals = (input_edited_arr < input_original_arr)
                mask_generated_arr[additions] = 255
                mask_generated_arr[removals] = 0
                
                mask_generated_with_edits = Image.fromarray(mask_generated_arr.astype(np.uint8))
                
                # Compare and visualize
                metrics = compare_masks(mask_edited_2667, mask_generated_with_edits)
                fidelity_viz = create_fidelity_visualization(
                    original_2667, result_for_metrics, mask_edited_2667, mask_generated_with_edits
                )
                
            except Exception as e:
                log.warning(f"[{session_id}] Fidelity analysis failed: {e}")
        
        log.info(f"[{session_id}] Generation complete!")
        
        return GenerateResponse(
            result_base64=pil_to_base64(result_flux, "JPEG"),
            result_gemini_base64=pil_to_base64(result_gemini, "JPEG") if result_gemini else None,
            fidelity_viz_base64=pil_to_base64(fidelity_viz, "JPEG") if fidelity_viz else None,
            metrics=metrics,
            session_id=session_id
        )
        
    except Exception as e:
        log.error(f"[{session_id}] Generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ═════════════════════════════════════════════════════════════════════
# STARTUP
# ═════════════════════════════════════════════════════════════════════
@app.on_event("startup")
async def startup_event():
    """Load models on startup"""
    log.info("=" * 60)
    log.info("FormaNova API Server Starting...")
    log.info("=" * 60)
    load_models()
    log.info("=" * 60)
    log.info("Server ready! Endpoints available:")
    log.info("  GET  /health     - Health check")
    log.info("  GET  /examples   - Example gallery")
    log.info("  POST /segment    - SAM segmentation")
    log.info("  POST /refine-mask - Brush mask editing")
    log.info("  POST /generate   - Generate photoshoot")
    log.info("=" * 60)

if __name__ == "__main__":
    # Run with: python api_server.py
    # Or: uvicorn api_server:app --host 0.0.0.0 --port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
