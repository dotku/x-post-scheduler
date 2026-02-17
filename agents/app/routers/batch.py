from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select

from ..auth import verify_token
from ..database import async_session
from ..models import KnowledgeSource, Post
from ..schemas import BatchGenerateRequest, BatchGenerateResponse
from ..agents.pipeline import run_pipeline

router = APIRouter()


def _generate_cuid() -> str:
    import time
    import random
    import string

    ts = int(time.time() * 1000)
    chars = string.ascii_lowercase + string.digits
    random_part = "".join(random.choices(chars, k=16))
    return f"c{ts:x}{random_part}"


@router.post("/batch-generate", response_model=BatchGenerateResponse)
async def batch_generate(
    request: BatchGenerateRequest, _token: str = Depends(verify_token)
):
    try:
        # Verify user has knowledge sources
        async with async_session() as session:
            result = await session.execute(
                select(KnowledgeSource).where(
                    KnowledgeSource.userId == request.user_id,
                    KnowledgeSource.isActive == True,  # noqa: E712
                )
            )
            sources = result.scalars().all()
            if not sources:
                return BatchGenerateResponse(
                    success=False,
                    error="No active knowledge sources found",
                )

        post_ids: list[str] = []
        count = min(request.count, 10)

        for i in range(count):
            # Generate unique content for each post
            gen_result = await run_pipeline(
                user_id=request.user_id,
                prompt=f"Create unique post #{i + 1} of {count} for today. Vary the topic and angle.",
                language=None,
                multiple=False,
            )

            if not gen_result.success or not gen_result.content:
                continue

            # Determine schedule time
            scheduled_at = None
            if i < len(request.schedule_times):
                scheduled_at = datetime.fromisoformat(
                    request.schedule_times[i].replace("Z", "+00:00")
                )

            # Create post in database
            async with async_session() as session:
                post = Post(
                    id=_generate_cuid(),
                    content=gen_result.content,
                    status="scheduled",
                    scheduledAt=scheduled_at,
                    mediaAssetId=gen_result.media_asset_id,
                    userId=request.user_id,
                )
                session.add(post)
                await session.commit()
                post_ids.append(post.id)

        return BatchGenerateResponse(
            success=True,
            posts_created=len(post_ids),
            post_ids=post_ids,
        )
    except Exception as e:
        return BatchGenerateResponse(success=False, error=str(e))
