import asyncio
import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; XPostBot/1.0)",
}
MAX_CONTENT_LENGTH = 50_000


def _is_cjk(text: str) -> bool:
    cjk_count = sum(1 for c in text if "\u4e00" <= c <= "\u9fff" or "\u3040" <= c <= "\u30ff" or "\uac00" <= c <= "\ud7af")
    return cjk_count > len(text) * 0.1


def _clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


async def scrape_single_page(client: httpx.AsyncClient, url: str) -> dict:
    try:
        resp = await client.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        return {"url": url, "title": "", "content": "", "images": [], "error": str(e)}

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove noise
    for tag in soup.find_all(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    for tag in soup.find_all(class_=re.compile(r"ad|popup|modal|cookie|banner", re.I)):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    # Extract content from main content areas
    content_el = (
        soup.find("article")
        or soup.find("main")
        or soup.find(class_=re.compile(r"content|post|entry", re.I))
        or soup.find("body")
    )

    content = _clean_text(content_el.get_text(" ", strip=True)) if content_el else ""

    min_length = 30 if _is_cjk(content) else 100
    if len(content) < min_length:
        content = _clean_text(soup.get_text(" ", strip=True))

    # Extract product images
    images: list[dict] = []
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if not src:
            continue
        src = urljoin(url, src)

        # Filter out small icons, logos, etc.
        alt = img.get("alt", "")
        width = img.get("width", "")
        height = img.get("height", "")

        # Skip tiny images
        try:
            if width and int(width) < 150:
                continue
            if height and int(height) < 150:
                continue
        except ValueError:
            pass

        # Skip common non-product images
        src_lower = src.lower()
        if any(skip in src_lower for skip in ["logo", "icon", "favicon", "sprite", "pixel", "tracking", "avatar"]):
            continue

        # Check for valid image extensions
        path = urlparse(src).path.lower()
        if not any(path.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
            # Also accept URLs without extensions (could be CDN)
            if "." in path.split("/")[-1] and not any(path.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                continue

        images.append({"url": src, "alt": alt})

    # Extract internal links
    internal_links: list[str] = []
    parsed_base = urlparse(url)
    for a in soup.find_all("a", href=True):
        href = urljoin(url, a["href"])
        parsed = urlparse(href)
        if parsed.netloc == parsed_base.netloc and parsed.path != parsed_base.path:
            clean_href = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if clean_href not in internal_links:
                internal_links.append(clean_href)

    return {
        "url": url,
        "title": title,
        "content": content,
        "images": images,
        "internal_links": internal_links,
    }


async def scrape_website(url: str, max_pages: int = 20) -> dict:
    visited: set[str] = set()
    to_visit: list[str] = [url]
    all_content: list[str] = []
    all_images: list[dict] = []
    pages_scraped = 0

    async with httpx.AsyncClient() as client:
        while to_visit and pages_scraped < max_pages:
            current_url = to_visit.pop(0)
            if current_url in visited:
                continue
            visited.add(current_url)

            result = await scrape_single_page(client, current_url)
            if result.get("error"):
                continue

            pages_scraped += 1
            content = result["content"]
            if content:
                title = result.get("title", "")
                all_content.append(f"## {title}\nSource: {current_url}\n\n{content}")

            all_images.extend(result.get("images", []))

            # Add internal links to visit
            for link in result.get("internal_links", []):
                if link not in visited and link not in to_visit:
                    to_visit.append(link)

            # Rate limiting
            if to_visit:
                await asyncio.sleep(0.2)

    combined = "\n\n---\n\n".join(all_content)
    if len(combined) > MAX_CONTENT_LENGTH:
        combined = combined[:MAX_CONTENT_LENGTH]

    # Deduplicate images by URL
    seen_urls: set[str] = set()
    unique_images: list[dict] = []
    for img in all_images:
        if img["url"] not in seen_urls:
            seen_urls.add(img["url"])
            unique_images.append(img)

    return {
        "success": True,
        "content": combined,
        "pages_scraped": pages_scraped,
        "images": unique_images[:50],  # Cap at 50 images
    }
