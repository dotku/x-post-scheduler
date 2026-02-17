import time
import random
import string
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import KnowledgeSource, MediaAsset
from ..tools.scraper import scrape_website
from ..tools.image_downloader import download_and_validate_image
from ..tools.knowledge_reader import get_stale_sources, get_knowledge_context


def _generate_cuid() -> str:
    ts = int(time.time() * 1000)
    chars = string.ascii_lowercase + string.digits
    random_part = "".join(random.choices(chars, k=16))
    return f"c{ts:x}{random_part}"


async def run_database_manager(
    session: AsyncSession,
    user_id: str,
) -> dict:
    """
    Database Manager agent: refreshes stale knowledge sources,
    downloads product images, returns knowledge context.
    """
    log_parts: list[str] = []

    # Check for stale sources
    stale_sources = await get_stale_sources(session, user_id)

    if stale_sources:
        log_parts.append(f"Found {len(stale_sources)} stale source(s) to refresh")

        for source in stale_sources:
            try:
                result = await scrape_website(source.url)
                if result["success"]:
                    source.content = result["content"]
                    source.pagesScraped = result["pages_scraped"]
                    source.lastScraped = datetime.now(timezone.utc)
                    source.updatedAt = datetime.now(timezone.utc)

                    # Download product images found during scraping
                    images_downloaded = 0
                    for img_info in result.get("images", [])[:10]:
                        # Check if image already exists
                        existing = await session.execute(
                            select(MediaAsset).where(
                                MediaAsset.sourceUrl == img_info["url"],
                                MediaAsset.userId == user_id,
                            )
                        )
                        if existing.scalar_one_or_none():
                            continue

                        img_data = await download_and_validate_image(img_info["url"])
                        if img_data:
                            asset = MediaAsset(
                                id=_generate_cuid(),
                                sourceUrl=img_info["url"],
                                data=img_data["data"],
                                mimeType=img_data["mime_type"],
                                width=img_data["width"],
                                height=img_data["height"],
                                altText=img_info.get("alt", ""),
                                userId=user_id,
                            )
                            session.add(asset)
                            images_downloaded += 1

                            if images_downloaded >= 5:
                                break

                    log_parts.append(
                        f"Refreshed '{source.name}': {result['pages_scraped']} pages, "
                        f"{images_downloaded} images downloaded"
                    )
            except Exception as e:
                log_parts.append(f"Failed to refresh '{source.name}': {e}")

        await session.commit()
    else:
        log_parts.append("All sources are up to date")

    # Get combined knowledge context
    knowledge_context = await get_knowledge_context(session, user_id)

    # Get available images for this user
    img_result = await session.execute(
        select(MediaAsset.id, MediaAsset.altText, MediaAsset.sourceUrl)
        .where(
            MediaAsset.userId == user_id,
            MediaAsset.isActive == True,  # noqa: E712
        )
        .order_by(MediaAsset.createdAt.desc())
        .limit(20)
    )
    available_images = [
        {"id": row[0], "alt": row[1] or "", "url": row[2]}
        for row in img_result.all()
    ]

    return {
        "knowledge_context": knowledge_context,
        "available_images": available_images,
        "log": "; ".join(log_parts),
    }
