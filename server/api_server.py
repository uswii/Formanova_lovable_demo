#!/usr/bin/env python3
"""
FormaNova Unified API Server
Supports all jewelry types: necklace, ring, bracelet, earring, watch

Necklace: Two modes (Standard/Flux + Enhanced/Gemini)
Other jewelry: Single mode (Gemini-based pipeline with transformation)

Run: python api_server.py
"""

import os
import sys
import subprocess
from pathlib import Path

# ═════════════════════════════════════════════════════════════════════
# AUTO-INSTALL DEPENDENCIES
# ═════════════════════════════════════════════════════════════════════
def auto_install():
    required = ["fastapi", "uvicorn", "python-multipart", "google-generativeai"]
    pip_path = Path("/home/bilal/viton_jewelry_model/.venv/bin/pip")
    
    for pkg in required:
        try:
            mod = pkg.replace("-", "_").replace("google-generativeai", "google.genai")
            __import__(mod)
        except ImportError:
            print(f"Installing {pkg}...")
            subprocess.check_call([str(pip_path), "install", "-q", pkg])

auto_install()

import base64
import io
import json
import logging
import re
import time
import uuid
import glob
from typing import List, Optional, Dict, Any, Tuple

# ═════════════════════════════════════════════════════════════════════
# VENV ISOLATION
# ═════════════════════════════════════════════════════════════════════
APP_VENV_PY = Path("/home/bilal/viton_jewelry_model/.venv/bin/python").resolve()
if Path(sys.executable).resolve() != APP_VENV_PY:
    os.environ["PYTHONNOUSERSITE"] = "1"
    os.environ.pop("PYTHONPATH", None)
    os.execv(str(APP_VENV_PY), [str(APP_VENV_PY), __file__, *sys.argv[1:]])

os.environ["PYTHONNOUSERSITE"] = "1"
os.environ.setdefault("PYTHONUNBUFFERED", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import numpy as np
from PIL import Image
import torch
import cv2

# Import models (for necklace pipeline)
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

# Gemini for multi-jewelry
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# ═════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═════════════════════════════════════════════════════════════════════
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3-pro-image-preview"
QUALITY_CHECK_MODEL = "gemini-2.0-flash-exp"

# Dimensions
NECKLACE_WIDTH, NECKLACE_HEIGHT = 2000, 2667
MULTI_WIDTH, MULTI_HEIGHT = 912, 1168

DILATION_PX = 1
APP_ROOT = Path("/home/bilal/viton_jewelry_model")
OUTPUT_DIR = APP_ROOT / "api_outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
EXAMPLES_DIR = Path("/home/bilal/uswa/viton_jewelry_model/EXAMPLES")

# ═════════════════════════════════════════════════════════════════════
# LOGGING
# ═════════════════════════════════════════════════════════════════════
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger(__name__)

# ═════════════════════════════════════════════════════════════════════
# PROMPTS FOR MULTI-JEWELRY
# ═════════════════════════════════════════════════════════════════════
SKETCH_PROMPTS = {
    "earring": """Create a simple white outline sketch on black solid background showing ONLY the body outline where the jewelry will be placed.
CRITICAL POSITIONING AND FRAMING:
- Preserve the EXACT framing, crop, and composition of the original image
- Match the original image zoom level and boundaries PRECISELY
Draw simple white outline sketch of EXACTLY what is visible in the original image:
- Ears outline at EXACT position where earrings sit
Use thin white lines only, no shading, no texture. Black solid background. Do NOT include jewelry in the sketch.""",

    "bracelet": """Create a simple white outline sketch on black solid background showing ONLY the body outline where the jewelry will be placed.
CRITICAL POSITIONING: The body part outline must be drawn at the EXACT position, scale, and orientation as in the original image.
Draw simple white outline sketch of:
- Hand shape and position (exact size and location as original)
- Wrist outline at EXACT position where bracelet sits
- Fingers outline if visible
Use thin white lines only, no shading, no texture. Black solid background. Do NOT include jewelry in the sketch.""",

    "ring": """Create a simple white outline sketch on black solid background showing ONLY the body outline where the jewelry will be placed.
CRITICAL POSITIONING: The body part outline must be drawn at the EXACT position, scale, and orientation as in the original image.
Draw simple white outline sketch of:
- Hand shape and position (exact size and location as original)
- Fingers outline at EXACT position where ring sits
Use thin white lines only, no shading, no texture. Black solid background. Do NOT include jewelry in the sketch.""",

    "watch": """Create a simple white outline sketch on black solid background showing ONLY the body outline where the jewelry will be placed.
CRITICAL POSITIONING: The body part outline must be drawn at the EXACT position, scale, and orientation as in the original image.
Draw simple white outline sketch of:
- Hand shape and position (exact size and location as original)
- Wrist outline at EXACT position where watch sits
Use thin white lines only, no shading, no texture. Black solid background. Do NOT include jewelry in the sketch."""
}

VTON_BASE_PROMPT = """Lock the jewelry area completely so its pixels remain 100% identical.
CRITICAL MASK INFORMATION (SAM3-GENERATED):
- A binary mask is attached where WHITE PIXELS (255) = JEWELRY LOCATION
- This mask was generated by SAM3 and defines the EXACT jewelry boundaries
JEWELRY PRESERVATION RULES:
- Use jewelry boundary (white pixels in mask) as IMMUTABLE, LOCKED, FIXED edges
- Copy jewelry pixels from composite EXACTLY - pixel-for-pixel, no modifications
GENERATION INSTRUCTIONS:
Convert this sketch into a realistic {skin_color} woman model by generating realistic human features ONLY in the BLACK mask areas.
Keep the same exact zoom level. No change in jewelry structure."""

VTON_TYPE_PROMPTS = {
    "earring": """
FACE/HEAD SPECIFICATIONS:
- Generate beautiful, professional model features ({skin_color} skin tone, 20-25 years old)
- Clean, elegant makeup - Tiffany & Co. catalog style
- Hair styled AWAY from ears
- Earrings MUST be fully visible
INTEGRATION:
- Integrate ears seamlessly with earrings
- Off-white/pure white background""",

    "bracelet": """
HAND/WRIST SPECIFICATIONS:
- Generate beautiful, professional female hand/wrist ({skin_color} skin tone, 20-25 years old)
- Clean, soft skin - no body hair
- Elegant, natural hand pose
INTEGRATION:
- Integrate wrist naturally with bracelet
- No gaps between bracelet and wrist""",

    "ring": """
HAND/FINGER SPECIFICATIONS:
- Generate beautiful, professional female hand/fingers ({skin_color} skin tone, 20-25 years old)
- Clean, soft skin - no body hair
- Simple, clean fingernails
INTEGRATION:
- Ring should sit naturally on finger
- No gaps between ring and finger""",

    "watch": """
WRIST/ARM SPECIFICATIONS:
- Generate beautiful, professional wrist/arm ({skin_color} skin tone, 20-25 years old)
- Clean, soft skin - no body hair
INTEGRATION:
- Watch should sit naturally on wrist
- Proper watch band fitting"""
}

VTON_BACKGROUND = """
BACKGROUND SPECIFICATIONS:
- SOLID studio background - pure white only
- Clean, minimalist, professional studio setting
FINAL CHECKS:
- Do not make or extend jewelry pixels"""

INPAINT_PROMPT = """This is an inpainting task to remove jewelry and restore natural skin/body.
TASK: Remove ALL jewelry from this image and fill the jewelry areas with natural, realistic skin/body.
OUTPUT REQUIREMENTS:
- Remove EVERY trace of jewelry in the masked areas
- Fill removed areas with clean, realistic skin/body texture
- Generate natural skin that perfectly matches surrounding skin tone"""

QUALITY_CHECK_PROMPT = """Analyze this jewelry virtual try-on image for quality issues.
Check for: unfinished output, sketch lines visible, long beard, overweight model.
Respond in JSON format ONLY:
{"has_issues": true/false, "issues": {...}, "reason": "Brief explanation"}"""


# ═════════════════════════════════════════════════════════════════════
# GLOBAL MODELS
# ═════════════════════════════════════════════════════════════════════
inference_pipe = None
sam_predictor = None
birefnet_model = None
gemini_client = None
models_loaded = False

def load_models():
    global inference_pipe, sam_predictor, birefnet_model, gemini_client, models_loaded
    if models_loaded:
        return
    
    log.info("Loading models...")
    log.info("Loading Flux...")
    inference_pipe = get_flux_pipeline()
    log.info("Loading SAM...")
    sam_predictor = get_sam_predictor()
    log.info("Loading BiRefNet...")
    birefnet_model = get_birefnet_model()
    
    # Initialize Gemini
    if GENAI_AVAILABLE and GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        log.info("✓ Gemini client initialized")
    else:
        log.warning("⚠️ Gemini not available (no API key or module)")
    
    log.info("✓ All models loaded!")
    models_loaded = True


# ═════════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═════════════════════════════════════════════════════════════════════
app = FastAPI(
    title="FormaNova Unified API",
    description="AI Jewelry Photography for all jewelry types",
    version="2.0.0"
)

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
    gemini_available: bool
    message: str

class ExampleImage(BaseModel):
    id: str
    name: str
    image_base64: str
    thumbnail_base64: Optional[str] = None

class ExamplesResponse(BaseModel):
    examples: List[ExampleImage]

class SegmentRequest(BaseModel):
    image_base64: str
    points: List[List[float]]

class SegmentResponse(BaseModel):
    mask_base64: str
    mask_overlay_base64: str
    processed_image_base64: str
    original_mask_base64: str
    scaled_points: List[List[float]]
    session_id: str
    image_width: int
    image_height: int

class RefineMaskRequest(BaseModel):
    original_image_base64: str
    current_mask_base64: str
    brush_strokes: List[Dict[str, Any]]

class RefineMaskResponse(BaseModel):
    mask_base64: str
    mask_overlay_base64: str

class GenerateRequest(BaseModel):
    image_base64: str
    mask_base64: str
    jewelry_type: str = "necklace"  # ring, bracelet, earring, necklace, watch
    skin_tone: str = "medium"
    original_mask_base64: Optional[str] = None
    gender: str = "female"
    use_gemini: bool = True
    scaled_points: Optional[List[List[float]]] = None
    enable_quality_check: bool = True
    enable_transformation: bool = True

class GenerateResponse(BaseModel):
    result_base64: str
    result_gemini_base64: Optional[str] = None  # Only for necklace
    fidelity_viz_base64: Optional[str] = None
    fidelity_viz_gemini_base64: Optional[str] = None  # Only for necklace
    metrics: Optional[Dict[str, float]] = None
    metrics_gemini: Optional[Dict[str, float]] = None  # Only for necklace
    session_id: str
    has_two_modes: bool = False  # True only for necklace


# ═════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═════════════════════════════════════════════════════════════════════
def base64_to_pil(base64_str: str) -> Image.Image:
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    image_data = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(image_data))

def pil_to_base64(image: Image.Image, format: str = "PNG") -> str:
    if image is None:
        return None
    buffered = io.BytesIO()
    if format.upper() == "JPEG" and image.mode == "RGBA":
        image = image.convert("RGB")
    image.save(buffered, format=format, quality=95 if format.upper() == "JPEG" else None)
    return base64.b64encode(buffered.getvalue()).decode()

def should_remove_background(image: Image.Image) -> bool:
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
    img_rgb = image.convert("RGB")
    bin_mask = binarize_mask(mask, 128)
    overlay = img_rgb.copy()
    arr = np.array(overlay)
    mask_arr = np.array(bin_mask)
    green_layer = np.zeros_like(arr)
    green_layer[mask_arr == 255] = [0, 255, 0]
    arr = cv2.addWeighted(arr, 0.7, green_layer, 0.3, 0)
    return Image.fromarray(arr)

def create_fidelity_visualization(original, generated, mask_input, mask_generated):
    mask_input_arr = np.array(mask_input.convert("L")) > 128
    mask_generated_arr = np.array(mask_generated.convert("L")) > 128
    generated_rgb = np.array(generated.convert("RGB"))
    overlay = generated_rgb.copy()
    correct = mask_input_arr & mask_generated_arr
    overlay[correct] = cv2.addWeighted(overlay[correct], 0.7, np.full_like(overlay[correct], [0, 255, 0]), 0.3, 0)
    expansion = (~mask_input_arr) & mask_generated_arr
    overlay[expansion] = cv2.addWeighted(overlay[expansion], 0.5, np.full_like(overlay[expansion], [0, 191, 255]), 0.5, 0)
    return Image.fromarray(overlay)

# Multi-jewelry helpers
def resize_and_pad(img: Image.Image, target_size: Tuple[int, int], fill_color) -> Tuple[Image.Image, dict]:
    target_w, target_h = target_size
    img_w, img_h = img.size
    ratio = min(target_w / img_w, target_h / img_h)
    new_w, new_h = int(img_w * ratio), int(img_h * ratio)
    resized_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new(img.mode, target_size, fill_color)
    x_offset = (target_w - new_w) // 2
    y_offset = (target_h - new_h) // 2
    if img.mode == 'RGBA':
        canvas.paste(resized_img, (x_offset, y_offset), resized_img)
    else:
        canvas.paste(resized_img, (x_offset, y_offset))
    metadata = {'original_size': (img_w, img_h), 'resized_size': (new_w, new_h), 'offsets': (x_offset, y_offset), 'ratio': ratio}
    return canvas, metadata

def restore_geometry(ai_img: Image.Image, metadata: dict) -> Image.Image:
    orig_w, orig_h = metadata['original_size']
    inner_w, inner_h = metadata['resized_size']
    x_off, y_off = metadata['offsets']
    cropped_ai = ai_img.crop((x_off, y_off, x_off + inner_w, y_off + inner_h))
    return cropped_ai.resize((orig_w, orig_h), Image.Resampling.LANCZOS)

def get_jewelry_bbox(mask_np):
    jewelry_mask = mask_np < 128
    coords = np.argwhere(jewelry_mask)
    if len(coords) == 0:
        return None
    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    return {'x': int(x_min), 'y': int(y_min), 'width': int(x_max - x_min + 1), 'height': int(y_max - y_min + 1),
            'center_x': float((x_min + x_max) / 2), 'center_y': float((y_min + y_max) / 2)}

def get_jewelry_orientation(mask_np):
    jewelry_mask = (mask_np < 128).astype(np.uint8) * 255
    moments = cv2.moments(jewelry_mask)
    if moments['mu20'] == moments['mu02']:
        return 0
    angle = 0.5 * np.arctan2(2 * moments['mu11'], moments['mu20'] - moments['mu02'])
    return np.degrees(angle)

def detect_transformations(input_mask_np, output_mask_np):
    in_bbox = get_jewelry_bbox(input_mask_np)
    out_bbox = get_jewelry_bbox(output_mask_np)
    if in_bbox is None or out_bbox is None:
        return None
    translation = {'x': out_bbox['center_x'] - in_bbox['center_x'], 'y': out_bbox['center_y'] - in_bbox['center_y']}
    scale = {'x': out_bbox['width'] / in_bbox['width'] if in_bbox['width'] > 0 else 1.0,
             'y': out_bbox['height'] / in_bbox['height'] if in_bbox['height'] > 0 else 1.0}
    rotation = get_jewelry_orientation(output_mask_np) - get_jewelry_orientation(input_mask_np)
    return {'translation': translation, 'scale': scale, 'rotation': rotation, 'input_bbox': in_bbox, 'output_bbox': out_bbox}

def extract_jewelry(image_pil, mask_pil_black_jewelry):
    image_rgba = image_pil.convert("RGBA")
    image_np = np.array(image_rgba)
    mask_np = np.array(mask_pil_black_jewelry.convert("L"))
    jewelry_mask = mask_np < 128
    alpha_channel = np.where(jewelry_mask, 255, 0).astype(np.uint8)
    result = image_np.copy()
    result[:, :, 3] = alpha_channel
    return Image.fromarray(result, mode="RGBA")

def transform_jewelry(jewelry_pil, transform_data):
    jewelry_np = np.array(jewelry_pil)
    h, w = jewelry_np.shape[:2]
    in_bbox, out_bbox = transform_data['input_bbox'], transform_data['output_bbox']
    scale, rotation = transform_data['scale'], transform_data['rotation']
    in_cx, in_cy = in_bbox['center_x'], in_bbox['center_y']
    out_cx, out_cy = out_bbox['center_x'], out_bbox['center_y']
    T1 = np.array([[1, 0, -in_cx], [0, 1, -in_cy], [0, 0, 1]], dtype=np.float32)
    S = np.array([[scale['x'], 0, 0], [0, scale['y'], 0], [0, 0, 1]], dtype=np.float32)
    theta = np.radians(rotation)
    R = np.array([[np.cos(theta), -np.sin(theta), 0], [np.sin(theta), np.cos(theta), 0], [0, 0, 1]], dtype=np.float32)
    T2 = np.array([[1, 0, out_cx], [0, 1, out_cy], [0, 0, 1]], dtype=np.float32)
    M = (T2 @ R @ S @ T1)[:2, :]
    transformed_np = cv2.warpAffine(jewelry_np, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    return Image.fromarray(transformed_np, mode="RGBA")

def transform_mask(mask_pil, transform_data):
    mask_np = np.array(mask_pil.convert("L"))
    h, w = mask_np.shape[:2]
    in_bbox, out_bbox = transform_data['input_bbox'], transform_data['output_bbox']
    scale, rotation = transform_data['scale'], transform_data['rotation']
    in_cx, in_cy = in_bbox['center_x'], in_bbox['center_y']
    out_cx, out_cy = out_bbox['center_x'], out_bbox['center_y']
    T1 = np.array([[1, 0, -in_cx], [0, 1, -in_cy], [0, 0, 1]], dtype=np.float32)
    S = np.array([[scale['x'], 0, 0], [0, scale['y'], 0], [0, 0, 1]], dtype=np.float32)
    theta = np.radians(rotation)
    R = np.array([[np.cos(theta), -np.sin(theta), 0], [np.sin(theta), np.cos(theta), 0], [0, 0, 1]], dtype=np.float32)
    T2 = np.array([[1, 0, out_cx], [0, 1, out_cy], [0, 0, 1]], dtype=np.float32)
    M = (T2 @ R @ S @ T1)[:2, :]
    transformed_mask_np = cv2.warpAffine(mask_np, M, (w, h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=255)
    return Image.fromarray(transformed_mask_np, mode="L")

def composite_jewelry(output_image_pil, transformed_jewelry_pil):
    output_rgba = output_image_pil.convert("RGBA")
    return Image.alpha_composite(output_rgba, transformed_jewelry_pil)

def invert_mask(mask_pil):
    mask_np = np.array(mask_pil.convert("L"))
    return Image.fromarray((255 - mask_np).astype(np.uint8), mode="L")

def enforce_binary_mask(mask_pil, threshold=127):
    mask_np = np.array(mask_pil.convert("L"))
    return Image.fromarray(np.where(mask_np >= threshold, 255, 0).astype(np.uint8), mode="L")

def compare_masks_fidelity(mask_input, mask_output) -> dict:
    if mask_input is None or mask_output is None:
        return {"iou": 0, "dice": 0, "precision": 0, "recall": 0, "growth_ratio": 1, "extra_area_fraction": 0}
    if mask_input.size != mask_output.size:
        mask_output = mask_output.resize(mask_input.size, Image.Resampling.NEAREST)
    input_arr = (np.array(mask_input.convert("L")) < 128).astype(np.uint8)
    output_arr = (np.array(mask_output.convert("L")) < 128).astype(np.uint8)
    area_input, area_output = int(np.sum(input_arr)), int(np.sum(output_arr))
    if area_input == 0:
        return {"iou": 0, "dice": 0, "precision": 0, "recall": 0, "growth_ratio": 1, "extra_area_fraction": 0}
    intersection = int(np.sum(input_arr & output_arr))
    union = int(np.sum(input_arr | output_arr))
    iou = intersection / union if union > 0 else 0
    dice = (2 * intersection) / (area_input + area_output) if (area_input + area_output) > 0 else 0
    precision = intersection / area_output if area_output > 0 else 0
    recall = intersection / area_input if area_input > 0 else 0
    return {"iou": float(iou), "dice": float(dice), "precision": float(precision), "recall": float(recall),
            "growth_ratio": float(area_output / area_input), "extra_area_fraction": float(max(0, area_output - area_input) / area_input)}

def create_fidelity_viz_multi(output_image, mask_input, mask_output):
    if output_image is None or mask_input is None or mask_output is None:
        return output_image
    if mask_input.size != mask_output.size:
        mask_output = mask_output.resize(mask_input.size, Image.Resampling.NEAREST)
    if output_image.size != mask_input.size:
        output_image = output_image.resize(mask_input.size, Image.Resampling.LANCZOS)
    input_arr = (np.array(mask_input.convert("L")) < 128)
    output_arr = (np.array(mask_output.convert("L")) < 128)
    output_rgb = np.array(output_image.convert("RGB"))
    overlay = output_rgb.copy()
    correct = input_arr & output_arr
    overlay[correct] = cv2.addWeighted(overlay[correct], 0.7, np.full_like(overlay[correct], [0, 255, 0]), 0.3, 0)
    expansion = (~input_arr) & output_arr
    overlay[expansion] = cv2.addWeighted(overlay[expansion], 0.5, np.full_like(overlay[expansion], [0, 191, 255]), 0.5, 0)
    return Image.fromarray(overlay)

def call_gemini_for_image(client, image_bytes: bytes, mime_type: str, prompt: str) -> bytes:
    contents = [types.Content(role="user", parts=[types.Part.from_bytes(mime_type=mime_type, data=image_bytes), types.Part.from_text(text=prompt)])]
    config = types.GenerateContentConfig(response_modalities=["IMAGE"])
    generated_data = None
    for chunk in client.models.generate_content_stream(model=GEMINI_MODEL, contents=contents, config=config):
        if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                d = part.inline_data.data
                generated_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)
    if generated_data is None:
        raise Exception("No response from Gemini API")
    return generated_data

def check_image_quality(client, image_pil: Image.Image) -> dict:
    img_io = io.BytesIO()
    img_io = io.BytesIO()
    image_pil.convert("RGB").save(img_io, format="JPEG", quality=95)
    response = client.models.generate_content(
        model=QUALITY_CHECK_MODEL,
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=QUALITY_CHECK_PROMPT), types.Part.from_bytes(mime_type="image/jpeg", data=img_io.getvalue())])]
    )
    response_text = response.text.strip()
    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(0))
    return {"has_issues": False, "issues": {}, "reason": "Parse error"}


# ═════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═════════════════════════════════════════════════════════════════════
@app.get("/health", response_model=HealthResponse)
async def health_check():
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
    return HealthResponse(
        status="online",
        models_loaded=models_loaded,
        gpu_available=gpu_available,
        gpu_name=gpu_name,
        gemini_available=gemini_client is not None,
        message="FormaNova API is ready" if models_loaded else "Models loading..."
    )

@app.get("/examples", response_model=ExamplesResponse)
async def get_examples():
    examples = []
    if EXAMPLES_DIR.exists():
        for i, img_path in enumerate(sorted(EXAMPLES_DIR.glob("*.jpg")) + sorted(EXAMPLES_DIR.glob("*.png"))):
            try:
                img = Image.open(img_path)
                thumb = img.copy()
                thumb.thumbnail((300, 300), Image.Resampling.LANCZOS)
                examples.append(ExampleImage(id=f"example_{i}", name=img_path.stem, image_base64=pil_to_base64(img, "JPEG"), thumbnail_base64=pil_to_base64(thumb, "JPEG")))
            except Exception as e:
                log.warning(f"Failed to load example {img_path}: {e}")
    return ExamplesResponse(examples=examples)

@app.post("/segment", response_model=SegmentResponse)
async def segment_jewelry(request: SegmentRequest):
    if not models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet.")
    session_id = f"seg_{uuid.uuid4().hex[:8]}"
    log.info(f"[{session_id}] Segmentation with {len(request.points)} points")
    try:
        image_pil = base64_to_pil(request.image_base64)
        if not request.points:
            raise HTTPException(status_code=400, detail="No click points provided")
        original_image = image_pil.copy()
        if should_remove_background(image_pil):
            log.info(f"[{session_id}] Removing background...")
            image_no_bg = remove_background_birefnet(image_pil, birefnet_model, bg_color=(250, 250, 250))
        else:
            image_no_bg = image_pil.copy()
        image_highres_nobg, tracker = resize_to_fixed_dimensions(image_no_bg, NECKLACE_WIDTH, NECKLACE_HEIGHT)
        image_highres_original, _ = resize_to_fixed_dimensions(original_image, NECKLACE_WIDTH, NECKLACE_HEIGHT)
        scaled_points = request.points
        log.info(f"[{session_id}] Running SAM...")
        sam_predictor.set_image(np.array(image_highres_nobg))
        masks, scores, _ = sam_predictor.predict(point_coords=np.array(scaled_points), point_labels=np.ones(len(scaled_points), dtype=int), multimask_output=False)
        mask_array = (masks[0] * 255).astype(np.uint8)
        mask_pil_original = Image.fromarray(mask_array).convert("L")
        mask_pil_original = process_mask(mask_pil_original, invert=False)
        mask_dilated = adjust_mask(mask_pil_original, DILATION_PX)
        overlay = create_overlay_visualization(image_highres_original, mask_dilated)
        log.info(f"[{session_id}] Segmentation complete!")
        return SegmentResponse(
            mask_base64=pil_to_base64(mask_dilated, "PNG"),
            mask_overlay_base64=pil_to_base64(overlay, "JPEG"),
            processed_image_base64=pil_to_base64(image_highres_original, "JPEG"),
            original_mask_base64=pil_to_base64(mask_pil_original, "PNG"),
            scaled_points=scaled_points,
            session_id=session_id,
            image_width=NECKLACE_WIDTH,
            image_height=NECKLACE_HEIGHT
        )
    except Exception as e:
        log.error(f"[{session_id}] Segmentation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refine-mask", response_model=RefineMaskResponse)
async def refine_mask(request: RefineMaskRequest):
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
                cv2.circle(mask_arr, (x, y), radius, 255 if stroke_type == "add" else 0, -1)
        refined_mask = Image.fromarray(mask_arr)
        overlay = create_overlay_visualization(original_image, refined_mask)
        return RefineMaskResponse(mask_base64=pil_to_base64(refined_mask, "PNG"), mask_overlay_base64=pil_to_base64(overlay, "JPEG"))
    except Exception as e:
        log.error(f"Mask refinement failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=GenerateResponse)
async def generate_photoshoot(request: GenerateRequest):
    """Unified generate endpoint for all jewelry types."""
    if not models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet.")
    
    jewelry_type = request.jewelry_type.lower()
    session_id = f"gen_{uuid.uuid4().hex[:8]}"
    log.info(f"[{session_id}] Generate: type={jewelry_type}, skin={request.skin_tone}")
    
    # Route to appropriate pipeline
    if jewelry_type == "necklace":
        return await generate_necklace(request, session_id)
    else:
        return await generate_multi_jewelry(request, session_id, jewelry_type)


async def generate_necklace(request: GenerateRequest, session_id: str) -> GenerateResponse:
    """Necklace pipeline: Two modes (Standard/Flux + Enhanced/Gemini)"""
    try:
        original_2667 = base64_to_pil(request.image_base64).convert("RGB")
        mask_edited_2667 = base64_to_pil(request.mask_base64).convert("L")
        
        if request.original_mask_base64:
            mask_original = base64_to_pil(request.original_mask_base64).convert("L")
        else:
            mask_original = mask_edited_2667.copy()
        
        if original_2667.size != (NECKLACE_WIDTH, NECKLACE_HEIGHT):
            original_2667 = original_2667.resize((NECKLACE_WIDTH, NECKLACE_HEIGHT), Image.Resampling.LANCZOS)
        if mask_edited_2667.size != (NECKLACE_WIDTH, NECKLACE_HEIGHT):
            mask_edited_2667 = mask_edited_2667.resize((NECKLACE_WIDTH, NECKLACE_HEIGHT), Image.Resampling.LANCZOS)
        
        mask_dilated_expanded = adjust_mask(mask_edited_2667, 11)
        
        # FLUX GENERATION
        image_1024 = downscale_for_flux(original_2667, 768, 1024)
        mask_1024 = mask_dilated_expanded.resize((768, 1024), Image.Resampling.NEAREST)
        mask_1024_inverted = Image.eval(mask_1024, lambda x: 255 - x)
        image_1024_segmented = segment_image_on_white_background(image_1024, mask_1024)
        
        prompt = f"Necklace worn by female model, beautiful realistic eyes"
        log.info(f"[{session_id}] Running Flux...")
        
        flux_output_768 = inference_pipe(
            prompt=prompt, image=image_1024_segmented, mask_image=mask_1024_inverted,
            width=768, height=1024, guidance_scale=40, num_inference_steps=40
        ).images[0]
        
        log.info(f"[{session_id}] Upscaling...")
        flux_enhanced_2667 = upscale_with_external_script(flux_output_768, NECKLACE_WIDTH, NECKLACE_HEIGHT)
        
        strict_alpha = binarize_mask(mask_edited_2667, 128)
        strict_rgba = original_2667.convert("RGBA")
        strict_rgba.putalpha(strict_alpha)
        
        result_flux = paste_masked_region_on_upscaled(strict_rgba, flux_enhanced_2667, mode='non-composite')
        
        # GEMINI REFINEMENT (Enhanced)
        result_gemini = None
        if request.use_gemini and gemini_client:
            try:
                log.info(f"[{session_id}] Running Gemini refinement...")
                gemini_bg = refine_with_gemini(
                    generated_image_2667=result_flux, original_image_2667=original_2667,
                    mask_edited_2667=mask_edited_2667, upscale_fn=upscale_with_external_script,
                    composite_fn=composite_zero_transformation_improved, session_id=session_id, session_dirs=None
                )
                result_gemini = paste_masked_region_on_upscaled(strict_rgba, gemini_bg, mode='non-composite')
            except Exception as e:
                log.warning(f"[{session_id}] Gemini failed: {e}")
        
        # FIDELITY ANALYSIS
        fidelity_viz_flux, fidelity_viz_gemini, metrics_flux, metrics_gemini = None, None, None, None
        
        if request.scaled_points:
            input_original_arr = np.array(mask_original.resize((NECKLACE_WIDTH, NECKLACE_HEIGHT), Image.Resampling.NEAREST))
            input_edited_arr = np.array(mask_edited_2667)
            additions = (input_edited_arr > input_original_arr)
            removals = (input_edited_arr < input_original_arr)
            
            try:
                mask_gen_flux = run_sam_on_image(result_flux, request.scaled_points, sam_predictor)
                mask_gen_flux_dilated = adjust_mask(mask_gen_flux, DILATION_PX)
                mask_gen_flux_arr = np.array(mask_gen_flux_dilated)
                mask_gen_flux_arr[additions] = 255
                mask_gen_flux_arr[removals] = 0
                mask_gen_flux_edited = Image.fromarray(mask_gen_flux_arr.astype(np.uint8))
                metrics_flux = compare_masks(mask_edited_2667, mask_gen_flux_edited)
                fidelity_viz_flux = create_fidelity_visualization(original_2667, result_flux, mask_edited_2667, mask_gen_flux_edited)
            except Exception as e:
                log.warning(f"[{session_id}] Fidelity analysis for Standard failed: {e}")
            
            if result_gemini:
                try:
                    mask_gen_gemini = run_sam_on_image(result_gemini, request.scaled_points, sam_predictor)
                    mask_gen_gemini_dilated = adjust_mask(mask_gen_gemini, DILATION_PX)
                    mask_gen_gemini_arr = np.array(mask_gen_gemini_dilated)
                    mask_gen_gemini_arr[additions] = 255
                    mask_gen_gemini_arr[removals] = 0
                    mask_gen_gemini_edited = Image.fromarray(mask_gen_gemini_arr.astype(np.uint8))
                    metrics_gemini = compare_masks(mask_edited_2667, mask_gen_gemini_edited)
                    fidelity_viz_gemini = create_fidelity_visualization(original_2667, result_gemini, mask_edited_2667, mask_gen_gemini_edited)
                except Exception as e:
                    log.warning(f"[{session_id}] Fidelity analysis for Enhanced failed: {e}")
        
        log.info(f"[{session_id}] Necklace generation complete!")
        
        return GenerateResponse(
            result_base64=pil_to_base64(result_flux, "JPEG"),
            result_gemini_base64=pil_to_base64(result_gemini, "JPEG") if result_gemini else None,
            fidelity_viz_base64=pil_to_base64(fidelity_viz_flux, "JPEG") if fidelity_viz_flux else None,
            fidelity_viz_gemini_base64=pil_to_base64(fidelity_viz_gemini, "JPEG") if fidelity_viz_gemini else None,
            metrics=metrics_flux,
            metrics_gemini=metrics_gemini,
            session_id=session_id,
            has_two_modes=True
        )
    except Exception as e:
        log.error(f"[{session_id}] Necklace generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def generate_multi_jewelry(request: GenerateRequest, session_id: str, jewelry_type: str) -> GenerateResponse:
    """Multi-jewelry pipeline: Single mode with transformation + inpainting"""
    if not gemini_client:
        raise HTTPException(status_code=503, detail="Gemini API not available for multi-jewelry")
    
    skin_tone = request.skin_tone
    log.info(f"[{session_id}] Multi-jewelry: {jewelry_type}, skin={skin_tone}")
    
    try:
        original_img = base64_to_pil(request.image_base64).convert("RGBA")
        input_mask_black = base64_to_pil(request.mask_base64).convert("L")
        
        # Resize to target dimensions
        resized_img, resize_metadata = resize_and_pad(original_img, (MULTI_WIDTH, MULTI_HEIGHT), (0, 0, 0, 255))
        resized_img = resized_img.convert("RGBA")
        mask_resized, _ = resize_and_pad(input_mask_black, (MULTI_WIDTH, MULTI_HEIGHT), 255)
        mask_resized = enforce_binary_mask(mask_resized)
        mask_white = invert_mask(mask_resized)
        
        # STAGE 1: Generate Sketch
        log.info(f"[{session_id}] Generating sketch...")
        sketch_prompt = SKETCH_PROMPTS.get(jewelry_type, SKETCH_PROMPTS["bracelet"])
        temp_io = io.BytesIO()
        resized_img.convert("RGB").save(temp_io, format="JPEG", quality=95)
        sketch_bytes = call_gemini_for_image(gemini_client, temp_io.getvalue(), "image/jpeg", sketch_prompt)
        sketch_img = Image.open(io.BytesIO(sketch_bytes)).convert("RGBA")
        
        # STAGE 2: Create Jewelry Segment + Composite
        log.info(f"[{session_id}] Creating composite...")
        jewelry_segment = resized_img.copy()
        jewelry_segment.putalpha(mask_white)
        composite = sketch_img.copy()
        composite.paste(jewelry_segment, (0, 0), jewelry_segment)
        
        # STAGE 3: Generate AI Try-On
        log.info(f"[{session_id}] Generating VTON...")
        vton_type_prompt = VTON_TYPE_PROMPTS.get(jewelry_type, VTON_TYPE_PROMPTS["bracelet"])
        full_vton_prompt = VTON_BASE_PROMPT.format(skin_color=skin_tone) + vton_type_prompt.format(skin_color=skin_tone) + VTON_BACKGROUND
        
        composite_io = io.BytesIO()
        composite.save(composite_io, format="PNG")
        jewelry_green = Image.new("RGBA", jewelry_segment.size, (0, 255, 0, 255))
        jewelry_green.paste(jewelry_segment, (0, 0), jewelry_segment)
        jewelry_io = io.BytesIO()
        jewelry_green.save(jewelry_io, format="PNG")
        mask_io = io.BytesIO()
        mask_white.save(mask_io, format="PNG")
        
        contents = [types.Content(role="user", parts=[
            types.Part.from_text(text=full_vton_prompt),
            types.Part.from_text(text="SKETCH IMAGE (Composite):"),
            types.Part.from_bytes(mime_type="image/png", data=composite_io.getvalue()),
            types.Part.from_text(text="JEWELRY SEGMENT PNG:"),
            types.Part.from_bytes(mime_type="image/png", data=jewelry_io.getvalue()),
            types.Part.from_text(text="MASK IMAGE:"),
            types.Part.from_bytes(mime_type="image/png", data=mask_io.getvalue()),
        ])]
        config = types.GenerateContentConfig(response_modalities=["IMAGE"])
        
        ai_data = None
        for chunk in gemini_client.models.generate_content_stream(model=GEMINI_MODEL, contents=contents, config=config):
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                part = chunk.candidates[0].content.parts[0]
                if part.inline_data and part.inline_data.data:
                    d = part.inline_data.data
                    ai_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)
        
        if not ai_data:
            raise HTTPException(status_code=500, detail="Gemini returned no image for VTON")
        ai_img = Image.open(io.BytesIO(ai_data)).convert("RGBA")
        
        # STAGE 4: Quality Check
        if request.enable_quality_check:
            for retry in range(3):
                quality = check_image_quality(gemini_client, ai_img)
                if not quality.get("has_issues", False):
                    break
                log.warning(f"[{session_id}] Quality issues: {quality.get('reason')}, retrying...")
                for chunk in gemini_client.models.generate_content_stream(model=GEMINI_MODEL, contents=contents, config=config):
                    if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                        part = chunk.candidates[0].content.parts[0]
                        if part.inline_data and part.inline_data.data:
                            d = part.inline_data.data
                            ai_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)
                if ai_data:
                    ai_img = Image.open(io.BytesIO(ai_data)).convert("RGBA")
        
        # STAGE 5: Use input mask as output mask (approximation)
        output_mask_black = mask_resized.copy()
        
        # STAGE 6: Transformation-based Compositing
        transformed_result = None
        transform_data = None
        
        if request.enable_transformation:
            log.info(f"[{session_id}] Applying transformation...")
            transform_data = detect_transformations(np.array(mask_resized), np.array(output_mask_black))
            if transform_data:
                jewelry_extracted = extract_jewelry(resized_img, mask_resized)
                jewelry_transformed = transform_jewelry(jewelry_extracted, transform_data)
                transformed_result = composite_jewelry(ai_img, jewelry_transformed)
            else:
                transformed_result = ai_img.copy()
                transformed_result.paste(jewelry_segment, (0, 0), jewelry_segment)
        else:
            transformed_result = ai_img.copy()
            transformed_result.paste(jewelry_segment, (0, 0), jewelry_segment)
        
        # STAGE 7: Inpaint Background
        log.info(f"[{session_id}] Inpainting background...")
        ai_io = io.BytesIO()
        ai_img.convert("RGB").save(ai_io, format="PNG")
        output_mask_white = invert_mask(output_mask_black)
        mask_inpaint_io = io.BytesIO()
        output_mask_white.save(mask_inpaint_io, format="PNG")
        
        inpaint_contents = [types.Content(role="user", parts=[
            types.Part.from_text(text=INPAINT_PROMPT),
            types.Part.from_text(text="IMAGE WITH JEWELRY TO REMOVE:"),
            types.Part.from_bytes(mime_type="image/png", data=ai_io.getvalue()),
            types.Part.from_text(text="MASK (white = jewelry to remove):"),
            types.Part.from_bytes(mime_type="image/png", data=mask_inpaint_io.getvalue()),
        ])]
        
        inpaint_data = None
        for chunk in gemini_client.models.generate_content_stream(model=GEMINI_MODEL, contents=inpaint_contents, config=config):
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                part = chunk.candidates[0].content.parts[0]
                if part.inline_data and part.inline_data.data:
                    d = part.inline_data.data
                    inpaint_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)
        
        inpainted_bg = ai_img
        if inpaint_data:
            inpainted_bg = Image.open(io.BytesIO(inpaint_data)).convert("RGBA")
        
        # STAGE 8: Final Composite on Inpainted Background
        log.info(f"[{session_id}] Creating final result...")
        if request.enable_transformation and transform_data:
            jewelry_extracted = extract_jewelry(resized_img, mask_resized)
            jewelry_transformed = transform_jewelry(jewelry_extracted, transform_data)
            final_result = composite_jewelry(inpainted_bg, jewelry_transformed)
        else:
            final_result = inpainted_bg.copy()
            final_result.paste(jewelry_segment, (0, 0), jewelry_segment)
        
        # STAGE 9: Calculate Fidelity Metrics
        metrics = None
        fidelity_viz = None
        if transform_data:
            transformed_mask = transform_mask(mask_resized, transform_data)
            metrics = compare_masks_fidelity(transformed_mask, output_mask_black)
            fidelity_viz = create_fidelity_viz_multi(final_result, transformed_mask, output_mask_black)
        else:
            metrics = compare_masks_fidelity(mask_resized, output_mask_black)
            fidelity_viz = create_fidelity_viz_multi(final_result, mask_resized, output_mask_black)
        
        # STAGE 10: Restore to Original Size
        final_restored = restore_geometry(final_result, resize_metadata)
        fidelity_viz_restored = restore_geometry(fidelity_viz, resize_metadata) if fidelity_viz else None
        
        log.info(f"[{session_id}] Multi-jewelry generation complete!")
        
        return GenerateResponse(
            result_base64=pil_to_base64(final_restored, "JPEG"),
            result_gemini_base64=None,  # Single mode - no separate Gemini result
            fidelity_viz_base64=pil_to_base64(fidelity_viz_restored, "JPEG") if fidelity_viz_restored else None,
            fidelity_viz_gemini_base64=None,
            metrics=metrics,
            metrics_gemini=None,
            session_id=session_id,
            has_two_modes=False
        )
    except Exception as e:
        log.error(f"[{session_id}] Multi-jewelry generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ═════════════════════════════════════════════════════════════════════
# STARTUP
# ═════════════════════════════════════════════════════════════════════
@app.on_event("startup")
async def startup_event():
    log.info("=" * 60)
    log.info("FormaNova Unified API Server Starting...")
    log.info("=" * 60)
    load_models()
    log.info("=" * 60)
    log.info("Server ready! Endpoints:")
    log.info("  GET  /health       - Health check")
    log.info("  GET  /examples     - Example gallery")
    log.info("  POST /segment      - SAM segmentation")
    log.info("  POST /refine-mask  - Brush mask editing")
    log.info("  POST /generate     - Generate photoshoot (all jewelry types)")
    log.info("=" * 60)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
