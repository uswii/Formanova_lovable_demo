#!/usr/bin/env python3
"""
FormaNova Multi-Jewelry API Server
Unified endpoint for all jewelry types: necklace, ring, bracelet, earring, watch

Pipeline:
1. User uploads image → resize to 912×1168
2. User marks jewelry (click points) → SAM3 mask (handled separately)
3. User edits mask (brush strokes) → refined mask
4. Generate: Sketch → Composite → AI VTON → Quality Check → Transform → Inpaint → Composite

Run: python multi_jewelry_api.py
"""

import os
import sys
import base64
import io
import logging
import time
import uuid
from pathlib import Path
from typing import Tuple, Dict, List, Optional, Any

# ═════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═════════════════════════════════════════════════════════════════════
API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3-pro-image-preview"
QUALITY_CHECK_MODEL = "gemini-2.0-flash-exp"

# Target dimensions for Gemini processing
TARGET_WIDTH = 912
TARGET_HEIGHT = 1168

# Output directory
OUTPUT_DIR = Path("./api_outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ═════════════════════════════════════════════════════════════════════
# AUTO-INSTALL & IMPORTS
# ═════════════════════════════════════════════════════════════════════
def auto_install():
    required = ["fastapi", "uvicorn", "python-multipart", "google-generativeai", "opencv-python", "scipy"]
    import subprocess
    for pkg in required:
        try:
            __import__(pkg.replace("-", "_").replace("opencv-python", "cv2").replace("google-generativeai", "google.genai"))
        except ImportError:
            print(f"Installing {pkg}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])

auto_install()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import numpy as np
from PIL import Image
import cv2
from scipy import ndimage

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    print("⚠️ google-generativeai not available - AI generation disabled")

# ═════════════════════════════════════════════════════════════════════
# LOGGING
# ═════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger(__name__)

# ═════════════════════════════════════════════════════════════════════
# PROMPTS CONFIGURATION
# ═════════════════════════════════════════════════════════════════════

SKETCH_PROMPTS = {
    "earring": """Create a simple white outline sketch on black solid background showing ONLY the body outline where the jewelry will be placed.

CRITICAL POSITIONING AND FRAMING:
- Preserve the EXACT framing, crop, and composition of the original image
- Match the original image zoom level and boundaries PRECISELY
- DO NOT add or complete body parts that are cropped out of the frame
- The body part outline must be drawn at the EXACT position, scale, and orientation as in the original image

Draw simple white outline sketch of EXACTLY what is visible in the original image:
- Ears outline at EXACT position where earrings sit
- Match the original framing exactly
- DO NOT extend beyond the original frame boundaries

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
- Finger placement and spacing

Use thin white lines only, no shading, no texture. Black solid background. Do NOT include jewelry in the sketch.""",

    "necklace": """Create a simple white outline sketch on black solid background showing ONLY the body outline where the jewelry will be placed.

CRITICAL POSITIONING: The body part outline must be drawn at the EXACT position, scale, and orientation as in the original image.

Draw simple white outline sketch of:
- Neck shape and position (exact size and location as original)
- Chest and collarbone outline
- Shoulders outline at EXACT position where necklace sits

Use thin white lines only, no shading, no texture. Black solid background. Do NOT include jewelry in the sketch.""",

    "watch": """Create a simple white outline sketch on black solid background showing ONLY the body outline where the jewelry will be placed.

CRITICAL POSITIONING: The body part outline must be drawn at the EXACT position, scale, and orientation as in the original image.

Draw simple white outline sketch of:
- Hand shape and position (exact size and location as original)
- Wrist outline at EXACT position where watch sits
- Forearm outline if visible

Use thin white lines only, no shading, no texture. Black solid background. Do NOT include jewelry in the sketch."""
}

VTON_BASE_PROMPT = """Lock the jewelry area completely so its pixels remain 100% identical.

CRITICAL MASK INFORMATION (SAM3-GENERATED):
- A binary mask is attached where WHITE PIXELS (255) = JEWELRY LOCATION
- This mask was generated by SAM3 and defines the EXACT jewelry boundaries
- The composite image already contains the jewelry at correct location - DO NOT move or modify it

JEWELRY PRESERVATION RULES:
- Use jewelry boundary (white pixels in mask) as IMMUTABLE, LOCKED, FIXED edges
- Copy jewelry pixels from composite EXACTLY - pixel-for-pixel, no modifications
- Do NOT regenerate, reinterpret, redraw, or modify ANY pixels within white mask area

GENERATION INSTRUCTIONS:
Convert this sketch into a realistic {skin_color} woman model by generating realistic human features ONLY in the BLACK mask areas.
The jewelry must remain at exact same position, orientation, scale, and axis. Zero movement, zero reshaping.
Generate new realistic {skin_color} female model pixels only in the BLACK mask areas.
Keep the same exact zoom level. No change in jewelry structure."""

VTON_TYPE_PROMPTS = {
    "earring": """
FACE/HEAD SPECIFICATIONS:
- Match the framing and composition from the sketch EXACTLY
- Generate beautiful, professional model features ({skin_color} skin tone, 20-25 years old)
- Clean, elegant makeup - Tiffany & Co. catalog style
- Ears must look natural, anatomically correct
- Hair styled AWAY from ears - updo, slicked back, or short cut
- Earrings MUST be fully visible - no hair covering

INTEGRATION:
- Integrate ears seamlessly with earrings as in real-life jewelry photography
- Earrings should appear naturally worn through ear piercings
- Off-white/pure white background""",

    "bracelet": """
HAND/WRIST SPECIFICATIONS:
- Generate beautiful, professional female hand/wrist ({skin_color} skin tone, 20-25 years old)
- Clean, soft skin - no body hair
- Elegant, natural hand pose
- Wrist should look natural and proportional
- Professional jewelry photography standard

INTEGRATION:
- Integrate wrist naturally with bracelet
- Bracelet should sit naturally on wrist as in real life
- No gaps between bracelet and wrist""",

    "ring": """
HAND/FINGER SPECIFICATIONS:
- Generate beautiful, professional female hand/fingers ({skin_color} skin tone, 20-25 years old)
- Clean, soft skin - no body hair
- Elegant, natural finger pose
- Simple, clean fingernails
- Professional jewelry photography standard

INTEGRATION:
- Ring should sit naturally on finger as in real life
- Show proper ring placement at finger base
- No gaps between ring and finger""",

    "necklace": """
NECK/CHEST SPECIFICATIONS:
- Generate beautiful, professional female neck/chest ({skin_color} skin tone, 20-25 years old)
- Clean, elegant skin - smooth texture
- Natural collarbone definition
- Elegant neck angle matching sketch
- Minimal clothing (strapless, off-shoulder, or simple neckline)
- Hair styled away from necklace area

INTEGRATION:
- Necklace should drape naturally on skin/collarbone
- Show proper necklace positioning on collarbone/chest
- No gaps between necklace and skin""",

    "watch": """
WRIST/ARM SPECIFICATIONS:
- Generate beautiful, professional wrist/arm ({skin_color} skin tone, 20-25 years old)
- Clean, soft skin - no body hair
- Natural wrist pose
- Professional watch photography standard

INTEGRATION:
- Watch should sit naturally on wrist
- Proper watch band fitting
- No gaps between watch and wrist"""
}

VTON_BACKGROUND = """
BACKGROUND SPECIFICATIONS:
- SOLID studio background - pure white only
- NO patterns, textures, or busy elements
- Clean, minimalist, professional studio setting
- Think TIFFANY & CO catalog - pristine and simple

FINAL CHECKS:
- Do not make or extend jewelry pixels
- Do not add even a single pixel to jewelry
- Make a realistic women model like Tiffany & Co., Bulgari, Cartier"""

INPAINT_PROMPT = """This is an inpainting task to remove jewelry and restore natural skin/body.

TASK: Remove ALL jewelry from this image and fill the jewelry areas with natural, realistic skin/body.

OUTPUT REQUIREMENTS:
- Remove EVERY trace of jewelry in the masked areas
- Fill removed areas with clean, realistic skin/body texture
- Generate natural skin that perfectly matches surrounding skin tone
- Create smooth, seamless transitions at former jewelry boundaries
- NO jewelry remnants, shadows, reflections, or artifacts

SKIN QUALITY:
- Match the skin tone of surrounding visible skin exactly
- Professional model-quality skin texture
- Natural lighting and shadows
- Seamless blending - should look like jewelry was never there"""

QUALITY_CHECK_PROMPT = """Analyze this jewelry virtual try-on image for quality issues.

Check for these specific problems:
1. UNFINISHED/CORRUPTED OUTPUT: Incomplete generation, artifacts, glitches, blurry regions
2. SKETCH LINES VISIBLE: Are there visible sketch/outline lines on the realistic human skin?
3. LONG BEARD: Is there a long beard on the model?
4. BODY TYPE: Is the person overweight or not slim?

Respond in JSON format ONLY:
{
    "has_issues": true/false,
    "issues": {
        "unfinished": true/false,
        "sketch_lines": true/false,
        "long_beard": true/false,
        "overweight": true/false
    },
    "reason": "Brief explanation"
}"""


# ═════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
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
        return ""
    buffered = io.BytesIO()
    if format.upper() == "JPEG" and image.mode == "RGBA":
        image = image.convert("RGB")
    image.save(buffered, format=format, quality=95 if format.upper() == "JPEG" else None)
    return base64.b64encode(buffered.getvalue()).decode()


def resize_and_pad(img: Image.Image, target_size: Tuple[int, int], fill_color) -> Tuple[Image.Image, dict]:
    """Scale down & pad to target size. Returns resized image and metadata for reverse."""
    target_w, target_h = target_size
    img_w, img_h = img.size

    ratio = min(target_w / img_w, target_h / img_h)
    new_w = int(img_w * ratio)
    new_h = int(img_h * ratio)

    resized_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new(img.mode, target_size, fill_color)
    x_offset = (target_w - new_w) // 2
    y_offset = (target_h - new_h) // 2

    if img.mode == 'RGBA':
        canvas.paste(resized_img, (x_offset, y_offset), resized_img)
    else:
        canvas.paste(resized_img, (x_offset, y_offset))

    metadata = {
        'original_size': (img_w, img_h),
        'resized_size': (new_w, new_h),
        'offsets': (x_offset, y_offset),
        'ratio': ratio
    }
    return canvas, metadata


def restore_geometry(ai_img: Image.Image, metadata: dict) -> Image.Image:
    """Reverse transform: Crop padding & scale up to original dimensions."""
    orig_w, orig_h = metadata['original_size']
    inner_w, inner_h = metadata['resized_size']
    x_off, y_off = metadata['offsets']

    cropped_ai = ai_img.crop((x_off, y_off, x_off + inner_w, y_off + inner_h))
    restored_img = cropped_ai.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
    return restored_img


def get_jewelry_bbox(mask_np):
    """Find bounding box of jewelry pixels (low values <128 = jewelry)."""
    jewelry_mask = mask_np < 128
    coords = np.argwhere(jewelry_mask)
    if len(coords) == 0:
        return None
    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    return {
        'x': int(x_min), 'y': int(y_min),
        'width': int(x_max - x_min + 1),
        'height': int(y_max - y_min + 1),
        'center_x': float((x_min + x_max) / 2),
        'center_y': float((y_min + y_max) / 2)
    }


def get_jewelry_orientation(mask_np):
    """Calculate orientation angle using image moments."""
    jewelry_mask = (mask_np < 128).astype(np.uint8) * 255
    moments = cv2.moments(jewelry_mask)
    if moments['mu20'] == moments['mu02']:
        return 0
    angle = 0.5 * np.arctan2(2 * moments['mu11'], moments['mu20'] - moments['mu02'])
    return np.degrees(angle)


def detect_transformations(input_mask_np, output_mask_np):
    """Detect translation, rotation, and scale between input and output masks."""
    in_bbox = get_jewelry_bbox(input_mask_np)
    out_bbox = get_jewelry_bbox(output_mask_np)
    if in_bbox is None or out_bbox is None:
        return None

    translation = {
        'x': out_bbox['center_x'] - in_bbox['center_x'],
        'y': out_bbox['center_y'] - in_bbox['center_y']
    }
    scale = {
        'x': out_bbox['width'] / in_bbox['width'] if in_bbox['width'] > 0 else 1.0,
        'y': out_bbox['height'] / in_bbox['height'] if in_bbox['height'] > 0 else 1.0
    }
    in_angle = get_jewelry_orientation(input_mask_np)
    out_angle = get_jewelry_orientation(output_mask_np)
    rotation = out_angle - in_angle

    return {
        'translation': translation,
        'scale': scale,
        'rotation': rotation,
        'input_bbox': in_bbox,
        'output_bbox': out_bbox
    }


def extract_jewelry(image_pil, mask_pil_black_jewelry):
    """Extract jewelry pixels with transparency."""
    image_rgba = image_pil.convert("RGBA")
    image_np = np.array(image_rgba)
    mask_np = np.array(mask_pil_black_jewelry.convert("L"))
    jewelry_mask = mask_np < 128
    alpha_channel = np.where(jewelry_mask, 255, 0).astype(np.uint8)
    result = image_np.copy()
    result[:, :, 3] = alpha_channel
    return Image.fromarray(result, mode="RGBA")


def transform_jewelry(jewelry_pil, transform_data):
    """Apply translation, rotation, scale to jewelry."""
    jewelry_np = np.array(jewelry_pil)
    h, w = jewelry_np.shape[:2]

    in_bbox = transform_data['input_bbox']
    out_bbox = transform_data['output_bbox']
    scale = transform_data['scale']
    rotation = transform_data['rotation']

    in_cx, in_cy = in_bbox['center_x'], in_bbox['center_y']
    out_cx, out_cy = out_bbox['center_x'], out_bbox['center_y']

    T1 = np.array([[1, 0, -in_cx], [0, 1, -in_cy], [0, 0, 1]], dtype=np.float32)
    S = np.array([[scale['x'], 0, 0], [0, scale['y'], 0], [0, 0, 1]], dtype=np.float32)
    theta = np.radians(rotation)
    R = np.array([
        [np.cos(theta), -np.sin(theta), 0],
        [np.sin(theta), np.cos(theta), 0],
        [0, 0, 1]
    ], dtype=np.float32)
    T2 = np.array([[1, 0, out_cx], [0, 1, out_cy], [0, 0, 1]], dtype=np.float32)

    M = T2 @ R @ S @ T1
    M = M[:2, :]

    transformed_np = cv2.warpAffine(
        jewelry_np, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0)
    )
    return Image.fromarray(transformed_np, mode="RGBA")


def transform_mask(mask_pil, transform_data):
    """Apply same transformation to mask."""
    mask_np = np.array(mask_pil.convert("L"))
    h, w = mask_np.shape[:2]

    in_bbox = transform_data['input_bbox']
    out_bbox = transform_data['output_bbox']
    scale = transform_data['scale']
    rotation = transform_data['rotation']

    in_cx, in_cy = in_bbox['center_x'], in_bbox['center_y']
    out_cx, out_cy = out_bbox['center_x'], out_bbox['center_y']

    T1 = np.array([[1, 0, -in_cx], [0, 1, -in_cy], [0, 0, 1]], dtype=np.float32)
    S = np.array([[scale['x'], 0, 0], [0, scale['y'], 0], [0, 0, 1]], dtype=np.float32)
    theta = np.radians(rotation)
    R = np.array([
        [np.cos(theta), -np.sin(theta), 0],
        [np.sin(theta), np.cos(theta), 0],
        [0, 0, 1]
    ], dtype=np.float32)
    T2 = np.array([[1, 0, out_cx], [0, 1, out_cy], [0, 0, 1]], dtype=np.float32)

    M = T2 @ R @ S @ T1
    M = M[:2, :]

    transformed_mask_np = cv2.warpAffine(
        mask_np, M, (w, h),
        flags=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255
    )
    return Image.fromarray(transformed_mask_np, mode="L")


def composite_jewelry(output_image_pil, transformed_jewelry_pil):
    """Alpha composite transformed jewelry onto output image."""
    output_rgba = output_image_pil.convert("RGBA")
    return Image.alpha_composite(output_rgba, transformed_jewelry_pil)


def compare_masks_fidelity(mask_input, mask_output) -> dict:
    """Calculate fidelity metrics between input and output masks."""
    if mask_input is None or mask_output is None:
        return {"iou": 0, "dice": 0, "precision": 0, "recall": 0, "growth_ratio": 1, "extra_area_fraction": 0}

    if mask_input.size != mask_output.size:
        mask_output = mask_output.resize(mask_input.size, Image.Resampling.NEAREST)

    input_arr = (np.array(mask_input.convert("L")) < 128).astype(np.uint8)
    output_arr = (np.array(mask_output.convert("L")) < 128).astype(np.uint8)

    area_input = int(np.sum(input_arr))
    area_output = int(np.sum(output_arr))

    if area_input == 0:
        return {"iou": 0, "dice": 0, "precision": 0, "recall": 0, "growth_ratio": 1, "extra_area_fraction": 0}

    intersection = int(np.sum(input_arr & output_arr))
    union = int(np.sum(input_arr | output_arr))

    iou = intersection / union if union > 0 else 0
    dice = (2 * intersection) / (area_input + area_output) if (area_input + area_output) > 0 else 0
    precision = intersection / area_output if area_output > 0 else 0
    recall = intersection / area_input if area_input > 0 else 0
    growth_ratio = area_output / area_input
    extra_area = max(0, area_output - area_input) / area_input

    return {
        "iou": float(iou),
        "dice": float(dice),
        "precision": float(precision),
        "recall": float(recall),
        "growth_ratio": float(growth_ratio),
        "extra_area_fraction": float(extra_area)
    }


def create_fidelity_visualization(output_image, mask_input, mask_output):
    """Create overlay showing GREEN=correct, BLUE=expansion."""
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
    overlay[correct] = cv2.addWeighted(
        overlay[correct], 0.7,
        np.full_like(overlay[correct], [0, 255, 0]), 0.3, 0
    )

    expansion = (~input_arr) & output_arr
    overlay[expansion] = cv2.addWeighted(
        overlay[expansion], 0.5,
        np.full_like(overlay[expansion], [0, 191, 255]), 0.5, 0
    )

    return Image.fromarray(overlay)


def invert_mask(mask_pil):
    """Invert mask."""
    mask_np = np.array(mask_pil.convert("L"))
    return Image.fromarray((255 - mask_np).astype(np.uint8), mode="L")


def enforce_binary_mask(mask_pil, threshold=127):
    """Enforce binary mask."""
    mask_np = np.array(mask_pil.convert("L"))
    binary = np.where(mask_np >= threshold, 255, 0).astype(np.uint8)
    return Image.fromarray(binary, mode="L")


# ═════════════════════════════════════════════════════════════════════
# GEMINI API CALLS
# ═════════════════════════════════════════════════════════════════════

def call_gemini_for_image(client, image_bytes: bytes, mime_type: str, prompt: str) -> bytes:
    """Call Gemini API with image and prompt, return generated image bytes."""
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(mime_type=mime_type, data=image_bytes),
                types.Part.from_text(text=prompt),
            ],
        ),
    ]
    config = types.GenerateContentConfig(response_modalities=["IMAGE"])

    generated_data = None
    for chunk in client.models.generate_content_stream(
        model=GEMINI_MODEL, contents=contents, config=config
    ):
        if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                d = part.inline_data.data
                generated_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)

    if generated_data is None:
        raise Exception("No response from Gemini API")
    return generated_data


def check_image_quality(client, image_pil: Image.Image) -> dict:
    """Check generated image quality using Gemini vision."""
    img_io = io.BytesIO()
    image_pil.convert("RGB").save(img_io, format="JPEG", quality=95)
    img_bytes = img_io.getvalue()

    response = client.models.generate_content(
        model=QUALITY_CHECK_MODEL,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=QUALITY_CHECK_PROMPT),
                    types.Part.from_bytes(mime_type="image/jpeg", data=img_bytes)
                ]
            )
        ]
    )

    response_text = response.text.strip()
    import re, json
    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(0))
    return {"has_issues": False, "issues": {}, "reason": "Parse error"}


# ═════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═════════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    status: str
    gemini_available: bool

class BrushStroke(BaseModel):
    type: str  # "add" or "remove"
    points: List[List[float]]  # [[x, y], ...]
    radius: float

class GenerateRequest(BaseModel):
    image_base64: str          # Resized input image (912x1168 or original)
    mask_base64: str           # Edited mask (BLACK=jewelry, WHITE=background)
    jewelry_type: str          # "ring", "bracelet", "earring", "necklace", "watch" (SINGULAR!)
    skin_tone: str             # "light", "fair", "medium", "olive", "brown", "dark"
    enable_quality_check: bool = True
    enable_transformation: bool = True

class GenerateResponse(BaseModel):
    result_base64: str                        # Final transformed+inpainted result
    fidelity_viz_base64: Optional[str] = None # Fidelity visualization
    metrics: Optional[dict] = None            # Quality metrics
    session_id: str


# ═════════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="FormaNova Multi-Jewelry API",
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

# Initialize Gemini client
gemini_client = None
if GENAI_AVAILABLE and API_KEY:
    gemini_client = genai.Client(api_key=API_KEY)
    log.info("✓ Gemini client initialized")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="online",
        gemini_available=gemini_client is not None
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate_photoshoot(request: GenerateRequest):
    """
    Generate jewelry photoshoot for any jewelry type.
    Uses transformation-based compositing with inpainting.
    """
    if not gemini_client:
        raise HTTPException(status_code=503, detail="Gemini API not available")

    session_id = f"gen_{uuid.uuid4().hex[:8]}"
    jewelry_type = request.jewelry_type.lower()
    skin_tone = request.skin_tone

    log.info(f"[{session_id}] Starting generation: {jewelry_type}, skin={skin_tone}")

    try:
        # Decode inputs
        original_img = base64_to_pil(request.image_base64).convert("RGBA")
        input_mask_black = base64_to_pil(request.mask_base64).convert("L")

        # Resize to target dimensions
        resized_img, resize_metadata = resize_and_pad(original_img, (TARGET_WIDTH, TARGET_HEIGHT), (0, 0, 0, 255))
        resized_img = resized_img.convert("RGBA")

        # Resize mask too
        mask_resized, _ = resize_and_pad(input_mask_black, (TARGET_WIDTH, TARGET_HEIGHT), 255)
        mask_resized = enforce_binary_mask(mask_resized)

        # Convert to pipeline format: WHITE=jewelry
        mask_white = invert_mask(mask_resized)

        # ═══════════════════════════════════════════════════════════
        # STAGE 1: Generate Sketch
        # ═══════════════════════════════════════════════════════════
        log.info(f"[{session_id}] Generating sketch...")
        sketch_prompt = SKETCH_PROMPTS.get(jewelry_type, SKETCH_PROMPTS["bracelet"])

        temp_resized = io.BytesIO()
        resized_img.convert("RGB").save(temp_resized, format="JPEG", quality=95)
        resized_bytes = temp_resized.getvalue()

        sketch_bytes = call_gemini_for_image(gemini_client, resized_bytes, "image/jpeg", sketch_prompt)
        sketch_img = Image.open(io.BytesIO(sketch_bytes)).convert("RGBA")

        # ═══════════════════════════════════════════════════════════
        # STAGE 2: Create Jewelry Segment + Composite
        # ═══════════════════════════════════════════════════════════
        log.info(f"[{session_id}] Creating composite...")
        jewelry_segment = resized_img.copy()
        jewelry_segment.putalpha(mask_white)

        composite = sketch_img.copy()
        composite.paste(jewelry_segment, (0, 0), jewelry_segment)

        # ═══════════════════════════════════════════════════════════
        # STAGE 3: Generate AI Try-On
        # ═══════════════════════════════════════════════════════════
        log.info(f"[{session_id}] Generating VTON...")
        vton_type_prompt = VTON_TYPE_PROMPTS.get(jewelry_type, VTON_TYPE_PROMPTS["bracelet"])
        full_vton_prompt = (
            VTON_BASE_PROMPT.format(skin_color=skin_tone) +
            vton_type_prompt.format(skin_color=skin_tone) +
            VTON_BACKGROUND
        )

        composite_io = io.BytesIO()
        composite.save(composite_io, format="PNG")
        composite_bytes = composite_io.getvalue()

        # Create green jewelry segment for reference
        jewelry_green = Image.new("RGBA", jewelry_segment.size, (0, 255, 0, 255))
        jewelry_green.paste(jewelry_segment, (0, 0), jewelry_segment)
        jewelry_io = io.BytesIO()
        jewelry_green.save(jewelry_io, format="PNG")
        jewelry_bytes = jewelry_io.getvalue()

        mask_io = io.BytesIO()
        mask_white.save(mask_io, format="PNG")
        mask_bytes = mask_io.getvalue()

        # Call Gemini for VTON
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=full_vton_prompt),
                    types.Part.from_text(text="SKETCH IMAGE (Composite):"),
                    types.Part.from_bytes(mime_type="image/png", data=composite_bytes),
                    types.Part.from_text(text="JEWELRY SEGMENT PNG:"),
                    types.Part.from_bytes(mime_type="image/png", data=jewelry_bytes),
                    types.Part.from_text(text="MASK IMAGE:"),
                    types.Part.from_bytes(mime_type="image/png", data=mask_bytes),
                ],
            ),
        ]
        config = types.GenerateContentConfig(response_modalities=["IMAGE"])

        ai_data = None
        for chunk in gemini_client.models.generate_content_stream(
            model=GEMINI_MODEL, contents=contents, config=config
        ):
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                part = chunk.candidates[0].content.parts[0]
                if part.inline_data and part.inline_data.data:
                    d = part.inline_data.data
                    ai_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)

        if not ai_data:
            raise HTTPException(status_code=500, detail="Gemini returned no image for VTON")

        ai_img = Image.open(io.BytesIO(ai_data)).convert("RGBA")

        # ═══════════════════════════════════════════════════════════
        # STAGE 4: Quality Check (with retry)
        # ═══════════════════════════════════════════════════════════
        if request.enable_quality_check:
            for retry in range(3):
                quality = check_image_quality(gemini_client, ai_img)
                if not quality.get("has_issues", False):
                    log.info(f"[{session_id}] Quality check passed")
                    break
                log.warning(f"[{session_id}] Quality issues: {quality.get('reason')}, retrying...")
                # Regenerate
                for chunk in gemini_client.models.generate_content_stream(
                    model=GEMINI_MODEL, contents=contents, config=config
                ):
                    if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                        part = chunk.candidates[0].content.parts[0]
                        if part.inline_data and part.inline_data.data:
                            d = part.inline_data.data
                            ai_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)
                if ai_data:
                    ai_img = Image.open(io.BytesIO(ai_data)).convert("RGBA")

        # ═══════════════════════════════════════════════════════════
        # STAGE 5: Generate Output Mask (simple threshold for now)
        # For production, use SAM3 text prompt
        # ═══════════════════════════════════════════════════════════
        # Use input mask as output mask approximation
        output_mask_black = mask_resized.copy()

        # ═══════════════════════════════════════════════════════════
        # STAGE 6: Transformation-based Compositing
        # ═══════════════════════════════════════════════════════════
        transformed_result = None
        transform_data = None

        if request.enable_transformation:
            log.info(f"[{session_id}] Applying transformation compositing...")
            transform_data = detect_transformations(
                np.array(mask_resized),
                np.array(output_mask_black)
            )

            if transform_data:
                jewelry_extracted = extract_jewelry(resized_img, mask_resized)
                jewelry_transformed = transform_jewelry(jewelry_extracted, transform_data)
                transformed_result = composite_jewelry(ai_img, jewelry_transformed)
            else:
                # Fallback: simple paste
                transformed_result = ai_img.copy()
                transformed_result.paste(jewelry_segment, (0, 0), jewelry_segment)
        else:
            transformed_result = ai_img.copy()
            transformed_result.paste(jewelry_segment, (0, 0), jewelry_segment)

        # ═══════════════════════════════════════════════════════════
        # STAGE 7: Inpaint Background
        # ═══════════════════════════════════════════════════════════
        log.info(f"[{session_id}] Inpainting background...")
        ai_io = io.BytesIO()
        ai_img.convert("RGB").save(ai_io, format="PNG")
        ai_bytes = ai_io.getvalue()

        output_mask_white = invert_mask(output_mask_black)
        mask_inpaint_io = io.BytesIO()
        output_mask_white.save(mask_inpaint_io, format="PNG")
        mask_inpaint_bytes = mask_inpaint_io.getvalue()

        inpaint_contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=INPAINT_PROMPT),
                    types.Part.from_text(text="IMAGE WITH JEWELRY TO REMOVE:"),
                    types.Part.from_bytes(mime_type="image/png", data=ai_bytes),
                    types.Part.from_text(text="MASK (white = jewelry to remove):"),
                    types.Part.from_bytes(mime_type="image/png", data=mask_inpaint_bytes),
                ],
            ),
        ]

        inpaint_data = None
        for chunk in gemini_client.models.generate_content_stream(
            model=GEMINI_MODEL, contents=inpaint_contents, config=config
        ):
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                part = chunk.candidates[0].content.parts[0]
                if part.inline_data and part.inline_data.data:
                    d = part.inline_data.data
                    inpaint_data = base64.b64decode(d) if isinstance(d, str) else bytes(d)

        inpainted_bg = ai_img
        if inpaint_data:
            inpainted_bg = Image.open(io.BytesIO(inpaint_data)).convert("RGBA")

        # ═══════════════════════════════════════════════════════════
        # STAGE 8: Final Composite on Inpainted Background
        # ═══════════════════════════════════════════════════════════
        log.info(f"[{session_id}] Creating final result...")
        if request.enable_transformation and transform_data:
            jewelry_extracted = extract_jewelry(resized_img, mask_resized)
            jewelry_transformed = transform_jewelry(jewelry_extracted, transform_data)
            final_result = composite_jewelry(inpainted_bg, jewelry_transformed)
        else:
            final_result = inpainted_bg.copy()
            final_result.paste(jewelry_segment, (0, 0), jewelry_segment)

        # ═══════════════════════════════════════════════════════════
        # STAGE 9: Calculate Fidelity Metrics
        # ═══════════════════════════════════════════════════════════
        metrics = None
        fidelity_viz = None

        if transform_data:
            transformed_mask = transform_mask(mask_resized, transform_data)
            metrics = compare_masks_fidelity(transformed_mask, output_mask_black)
            fidelity_viz = create_fidelity_visualization(final_result, transformed_mask, output_mask_black)
        else:
            metrics = compare_masks_fidelity(mask_resized, output_mask_black)
            fidelity_viz = create_fidelity_visualization(final_result, mask_resized, output_mask_black)

        # ═══════════════════════════════════════════════════════════
        # STAGE 10: Restore to Original Size
        # ═══════════════════════════════════════════════════════════
        final_restored = restore_geometry(final_result, resize_metadata)
        fidelity_viz_restored = restore_geometry(fidelity_viz, resize_metadata) if fidelity_viz else None

        log.info(f"[{session_id}] Generation complete!")

        return GenerateResponse(
            result_base64=pil_to_base64(final_restored, "JPEG"),
            fidelity_viz_base64=pil_to_base64(fidelity_viz_restored, "JPEG") if fidelity_viz_restored else None,
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
    log.info("=" * 60)
    log.info("FormaNova Multi-Jewelry API Server Starting...")
    log.info("=" * 60)
    log.info(f"Gemini Available: {gemini_client is not None}")
    log.info("Endpoints:")
    log.info("  GET  /health   - Health check")
    log.info("  POST /generate - Generate photoshoot")
    log.info("=" * 60)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
