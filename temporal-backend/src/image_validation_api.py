"""Image validation API for detecting worn vs flatlay jewelry images."""
import base64
import logging
import httpx
from typing import List, Optional
from dataclasses import dataclass
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/validate", tags=["validation"])


class ImageType(str, Enum):
    """Detected image type."""
    WORN = "worn"           # Jewelry worn on a person/mannequin
    FLATLAY = "flatlay"     # Jewelry laid flat on surface
    PACKSHOT = "packshot"   # Product shot on plain background
    UNKNOWN = "unknown"     # Could not determine


class ValidationFlag(str, Enum):
    """Validation warning flags."""
    NOT_WORN = "not_worn"           # Image is not jewelry worn on model
    LOW_QUALITY = "low_quality"     # Image quality too low
    NO_JEWELRY = "no_jewelry"       # No jewelry detected
    MULTIPLE_ITEMS = "multiple"     # Multiple jewelry pieces
    WRONG_CATEGORY = "wrong_category"  # Wrong jewelry type for category


@dataclass
class ImageValidationResult:
    """Result of validating a single image."""
    image_index: int
    detected_type: ImageType
    is_acceptable: bool
    flags: List[ValidationFlag]
    confidence: float
    message: str


class ValidateImagesRequest(BaseModel):
    """Request to validate uploaded images."""
    images: List[str] = Field(..., description="List of base64-encoded images")
    category: str = Field(..., description="Expected jewelry category (necklace, ring, etc.)")


class ImageValidationResponse(BaseModel):
    """Single image validation response."""
    index: int
    detected_type: str
    is_acceptable: bool
    flags: List[str]
    confidence: float
    message: str


class ValidateImagesResponse(BaseModel):
    """Response with validation results for all images."""
    results: List[ImageValidationResponse]
    all_acceptable: bool
    flagged_count: int
    message: str


# -------------------------
# AI-Based Image Analysis
# -------------------------

async def analyze_image_with_ai(
    image_base64: str,
    category: str,
    ai_gateway_url: str = "https://ai.gateway.lovable.dev/v1/chat/completions",
    api_key: Optional[str] = None,
) -> ImageValidationResult:
    """
    Analyze an image using Lovable AI Gateway to detect if it's worn jewelry.
    
    Uses vision model to classify:
    - Is jewelry present?
    - Is it worn on a person/mannequin or flatlay/packshot?
    - Does it match the expected category?
    """
    prompt = f"""Analyze this jewelry image and determine:

1. Is there jewelry visible in the image?
2. Is the jewelry being WORN by a person or mannequin (on neck, ears, wrist, fingers)?
3. Or is it a FLATLAY/PACKSHOT (jewelry lying flat on a surface, hanging on a stand, product photo)?
4. Does the jewelry type match the expected category: {category}?

Respond in this exact JSON format:
{{
    "has_jewelry": true/false,
    "image_type": "worn" | "flatlay" | "packshot" | "unknown",
    "is_worn": true/false,
    "matches_category": true/false,
    "detected_category": "necklace" | "ring" | "earring" | "bracelet" | "watch" | "other",
    "confidence": 0.0 to 1.0,
    "reason": "brief explanation"
}}

Only output the JSON, no other text."""

    try:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        # Prepare the image for the vision model
        image_url = f"data:image/jpeg;base64,{image_base64[:100]}..."  # truncated for logging
        
        payload = {
            "model": "google/gemini-2.5-flash",  # Fast vision model
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                        }
                    ]
                }
            ],
            "max_tokens": 500,
            "temperature": 0.1,  # Low temperature for consistent classification
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(ai_gateway_url, json=payload, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # Parse the JSON response
            import json
            # Clean up the response (remove markdown code blocks if present)
            content = content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()
            
            analysis = json.loads(content)
            
            # Build flags list
            flags = []
            is_acceptable = True
            
            if not analysis.get("has_jewelry", False):
                flags.append(ValidationFlag.NO_JEWELRY)
                is_acceptable = False
            
            if not analysis.get("is_worn", False):
                flags.append(ValidationFlag.NOT_WORN)
                # This is a warning, not a hard rejection
            
            if not analysis.get("matches_category", True):
                flags.append(ValidationFlag.WRONG_CATEGORY)
            
            detected_type = ImageType(analysis.get("image_type", "unknown"))
            
            return ImageValidationResult(
                image_index=0,  # Will be set by caller
                detected_type=detected_type,
                is_acceptable=is_acceptable or analysis.get("is_worn", False),
                flags=flags,
                confidence=analysis.get("confidence", 0.5),
                message=analysis.get("reason", "Analysis complete"),
            )
            
    except httpx.HTTPError as e:
        logger.error(f"AI Gateway request failed: {e}")
        # Return permissive result on error - don't block uploads
        return ImageValidationResult(
            image_index=0,
            detected_type=ImageType.UNKNOWN,
            is_acceptable=True,
            flags=[],
            confidence=0.0,
            message=f"Validation service unavailable: {str(e)}",
        )
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        return ImageValidationResult(
            image_index=0,
            detected_type=ImageType.UNKNOWN,
            is_acceptable=True,
            flags=[],
            confidence=0.0,
            message="Could not parse validation response",
        )
    except Exception as e:
        logger.error(f"Image validation error: {e}")
        return ImageValidationResult(
            image_index=0,
            detected_type=ImageType.UNKNOWN,
            is_acceptable=True,
            flags=[],
            confidence=0.0,
            message=f"Validation error: {str(e)}",
        )


# -------------------------
# Simple Heuristic Fallback
# -------------------------

def analyze_image_heuristic(image_base64: str, category: str) -> ImageValidationResult:
    """
    Simple heuristic analysis as fallback when AI is unavailable.
    Checks basic image properties.
    """
    try:
        # Decode and check image
        image_data = base64.b64decode(image_base64)
        
        # Basic size check
        size_kb = len(image_data) / 1024
        
        flags = []
        if size_kb < 10:
            flags.append(ValidationFlag.LOW_QUALITY)
        
        # Without AI, we can't detect worn vs flatlay
        # Return acceptable with unknown type
        return ImageValidationResult(
            image_index=0,
            detected_type=ImageType.UNKNOWN,
            is_acceptable=True,
            flags=flags,
            confidence=0.3,
            message="Basic validation passed (AI unavailable)",
        )
        
    except Exception as e:
        return ImageValidationResult(
            image_index=0,
            detected_type=ImageType.UNKNOWN,
            is_acceptable=False,
            flags=[ValidationFlag.LOW_QUALITY],
            confidence=0.0,
            message=f"Invalid image data: {str(e)}",
        )


# -------------------------
# API Endpoints
# -------------------------

@router.post("/images", response_model=ValidateImagesResponse)
async def validate_images(request: ValidateImagesRequest):
    """
    Validate uploaded images for worn vs flatlay detection.
    
    Returns validation results for each image with flags.
    Images flagged as flatlay/packshot will have NOT_WORN flag
    but are still submittable (user can choose to proceed).
    """
    import os
    
    results = []
    flagged_count = 0
    
    # Get API key for Lovable AI Gateway (optional - may work without it)
    api_key = os.getenv("LOVABLE_API_KEY")
    
    for idx, image_b64 in enumerate(request.images):
        # Try AI-based analysis first
        if api_key:
            result = await analyze_image_with_ai(
                image_base64=image_b64,
                category=request.category,
                api_key=api_key,
            )
        else:
            # Fall back to AI gateway without key (may still work)
            result = await analyze_image_with_ai(
                image_base64=image_b64,
                category=request.category,
            )
        
        # If AI failed, use heuristic
        if result.detected_type == ImageType.UNKNOWN and result.confidence == 0.0:
            result = analyze_image_heuristic(image_b64, request.category)
        
        result.image_index = idx
        
        if result.flags:
            flagged_count += 1
        
        results.append(ImageValidationResponse(
            index=idx,
            detected_type=result.detected_type.value,
            is_acceptable=result.is_acceptable,
            flags=[f.value for f in result.flags],
            confidence=result.confidence,
            message=result.message,
        ))
    
    all_acceptable = all(r.is_acceptable for r in results)
    
    if flagged_count > 0:
        message = f"{flagged_count} image(s) flagged - review recommended before submission"
    else:
        message = "All images passed validation"
    
    return ValidateImagesResponse(
        results=results,
        all_acceptable=all_acceptable,
        flagged_count=flagged_count,
        message=message,
    )


@router.post("/single", response_model=ImageValidationResponse)
async def validate_single_image(
    image_base64: str,
    category: str = "necklace",
):
    """Validate a single image."""
    import os
    
    api_key = os.getenv("LOVABLE_API_KEY")
    
    result = await analyze_image_with_ai(
        image_base64=image_base64,
        category=category,
        api_key=api_key,
    )
    
    if result.detected_type == ImageType.UNKNOWN and result.confidence == 0.0:
        result = analyze_image_heuristic(image_base64, category)
    
    return ImageValidationResponse(
        index=0,
        detected_type=result.detected_type.value,
        is_acceptable=result.is_acceptable,
        flags=[f.value for f in result.flags],
        confidence=result.confidence,
        message=result.message,
    )
