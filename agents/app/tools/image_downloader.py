import io

import httpx
from PIL import Image

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; XPostBot/1.0)",
}
MIN_DIMENSION = 200
MAX_DIMENSION = 2048


async def download_and_validate_image(url: str) -> dict | None:
    """Download an image from URL, validate it, and return processed bytes."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                return None

            image_data = resp.content
            if len(image_data) > 10 * 1024 * 1024:  # 10MB limit
                return None

            # Validate with Pillow
            img = Image.open(io.BytesIO(image_data))
            width, height = img.size

            if width < MIN_DIMENSION or height < MIN_DIMENSION:
                return None

            # Resize if too large
            if width > MAX_DIMENSION or height > MAX_DIMENSION:
                img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
                width, height = img.size

            # Convert to JPEG for consistency
            output = io.BytesIO()
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(output, format="JPEG", quality=85)
            processed_data = output.getvalue()

            return {
                "data": processed_data,
                "mime_type": "image/jpeg",
                "width": width,
                "height": height,
            }
    except Exception:
        return None
