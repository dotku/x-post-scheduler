from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import KnowledgeSource, Post

STALENESS_DAYS = 7


async def get_knowledge_context(session: AsyncSession, user_id: str) -> str:
    """Read all active knowledge sources for a user and combine into context."""
    result = await session.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.userId == user_id,
            KnowledgeSource.isActive == True,  # noqa: E712
        )
    )
    sources = result.scalars().all()

    if not sources:
        return ""

    parts: list[str] = []
    for source in sources:
        content = source.content
        if len(content) > 2000:
            content = content[:2000] + "..."
        parts.append(f"Source: {source.name} ({source.url})\n{content}")

    return "\n\n---\n\n".join(parts)


async def get_stale_sources(session: AsyncSession, user_id: str) -> list[KnowledgeSource]:
    """Find knowledge sources that haven't been scraped recently."""
    threshold = datetime.now(timezone.utc) - timedelta(days=STALENESS_DAYS)
    result = await session.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.userId == user_id,
            KnowledgeSource.isActive == True,  # noqa: E712
            (KnowledgeSource.lastScraped == None) | (KnowledgeSource.lastScraped < threshold),  # noqa: E711
        )
    )
    return list(result.scalars().all())


async def get_recent_posts(session: AsyncSession, user_id: str, limit: int = 20) -> list[str]:
    """Get recent post contents to avoid repetition."""
    result = await session.execute(
        select(Post.content)
        .where(Post.userId == user_id)
        .order_by(Post.createdAt.desc())
        .limit(limit)
    )
    return [row[0] for row in result.all()]
