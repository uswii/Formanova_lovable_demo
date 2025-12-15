#!/usr/bin/env python3
"""
FormaNova API Server
Run on A100 server to expose jewelry generation endpoints.

Usage:
    cd /home/bilal/uswa/viton_jewelry_model
    /home/bilal/viton_jewelry_model/.venv/bin/python api_server.py

Endpoints:
    GET  /health          - Check if server is online
    POST /segment         - Run SAM segmentation on image with click points
    POST /generate        - Generate photoshoot from image + mask
"""

import os
import sys
from pathlib import Path
import base64
import io
import logging
import time
import uuid
from typing import List, Optional

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
from pydantic import BaseModel
import uvicorn
import numpy as np
from PIL import Image
import torch

# Import your existing modules
from models_init import get_flux_pipeline, get_sam_predictor, get_birefnet_model, upscale_with_external_script
from utils import (
    segment_image_on_white_background,
    process_mask,
    resize_to_fixed_dimensions,
    remove_background_birefnet,
    downscale_for_flux,
    paste_masked_region_on_upscaled,
    binarize_mask,
    adjust_mask,
    composite_zero_transformation_improved,
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
    message: str

class SegmentRequest(BaseModel):
    image_base64: str  # Base64 encoded image
    points: List[List[float]]  # [[x1, y1], [x2, y2], ...]

class SegmentResponse(BaseModel):
    mask_base64: str
    mask_overlay_base64: str
    processed_image_base64: str
    session_id: str

class GenerateRequest(BaseModel):
    image_base64: str  # Original image (base64)
    mask_base64: str   # Mask image (base64)
    gender: str = "female"  # "male" or "female"
    use_gemini: bool = True  # Whether to use Gemini refinement

class GenerateResponse(BaseModel):
    result_base64: str  # Final result image
    result_gemini_base64: Optional[str] = None  # Gemini refined result
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
    buffered = io.BytesIO()
    image.save(buffered, format=format, quality=95 if format == "JPEG" else None)
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
    import cv2
    img_rgb = image.convert("RGB")
    bin_mask = binarize_mask(mask, 128)
    overlay = img_rgb.copy()
    arr = np.array(overlay)
    mask_arr = np.array(bin_mask)
    
    green_layer = np.zeros_like(arr)
    green_layer[mask_arr == 255] = [0, 255, 0]
    arr = cv2.addWeighted(arr, 0.7, green_layer, 0.3, 0)
    
    return Image.fromarray(arr)

# ═════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═════════════════════════════════════════════════════════════════════
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the API server is running and models are loaded"""
    gpu_available = torch.cuda.is_available()
    return HealthResponse(
        status="online",
        models_loaded=models_loaded,
        gpu_available=gpu_available,
        message="FormaNova API is running" if models_loaded else "Models not loaded yet"
    )

@app.post("/segment", response_model=SegmentResponse)
async def segment_jewelry(request: SegmentRequest):
    """
    Run SAM segmentation on the uploaded image with click points.
    Returns the mask and overlay visualization.
    """
    if not models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet")
    
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
            image_no_bg = image_pil.copy()
        
        # Resize to fixed dimensions
        image_highres_nobg, tracker = resize_to_fixed_dimensions(image_no_bg, 2000, 2667)
        image_highres_original, _ = resize_to_fixed_dimensions(original_image, 2000, 2667)
        
        # Transform points
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
        mask_pil = Image.fromarray(mask_array).convert("L")
        mask_pil = process_mask(mask_pil, invert=False)
        
        # Dilate mask
        mask_dilated = adjust_mask(mask_pil, DILATION_PX)
        
        # Create overlay
        overlay = create_overlay_visualization(image_highres_original, mask_dilated)
        
        log.info(f"[{session_id}] Segmentation complete!")
        
        return SegmentResponse(
            mask_base64=pil_to_base64(mask_dilated, "PNG"),
            mask_overlay_base64=pil_to_base64(overlay, "JPEG"),
            processed_image_base64=pil_to_base64(image_highres_original, "JPEG"),
            session_id=session_id
        )
        
    except Exception as e:
        log.error(f"[{session_id}] Segmentation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=GenerateResponse)
async def generate_photoshoot(request: GenerateRequest):
    """
    Generate a photoshoot from the image and mask.
    Returns the final result with jewelry composited.
    """
    if not models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet")
    
    session_id = f"gen_{uuid.uuid4().hex[:8]}"
    log.info(f"[{session_id}] Starting generation (gender={request.gender}, gemini={request.use_gemini})")
    
    try:
        # Decode inputs
        original_2667 = base64_to_pil(request.image_base64).convert("RGB")
        mask_edited_2667 = base64_to_pil(request.mask_base64).convert("L")
        
        # Ensure correct size
        if original_2667.size != (2000, 2667):
            original_2667 = original_2667.resize((2000, 2667), Image.Resampling.LANCZOS)
        if mask_edited_2667.size != (2000, 2667):
            mask_edited_2667 = mask_edited_2667.resize((2000, 2667), Image.Resampling.LANCZOS)
        
        # Expand mask for Flux
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
        
        # Upscale
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
        
        log.info(f"[{session_id}] Generation complete!")
        
        return GenerateResponse(
            result_base64=pil_to_base64(result_flux, "JPEG"),
            result_gemini_base64=pil_to_base64(result_gemini, "JPEG") if result_gemini else None,
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
    log.info("FormaNova API starting up...")
    load_models()

if __name__ == "__main__":
    # Run with: python api_server.py
    # Or: uvicorn api_server:app --host 0.0.0.0 --port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
