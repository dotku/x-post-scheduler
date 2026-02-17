from ..database import async_session
from ..schemas import GenerateResponse
from .database_manager import run_database_manager
from .author import run_author
from .editor import run_editor


async def run_pipeline(
    user_id: str,
    prompt: str | None = None,
    language: str | None = None,
    multiple: bool = False,
) -> GenerateResponse:
    """
    Run the 3-agent pipeline: Database Manager → Author → Editor.

    Returns a GenerateResponse with the final content and metadata.
    """
    pipeline_log: dict[str, str] = {}

    async with async_session() as session:
        # Stage 1: Database Manager
        # Refreshes stale knowledge sources, downloads images, returns context
        db_result = await run_database_manager(session, user_id)
        pipeline_log["database_manager"] = db_result["log"]

        knowledge_context = db_result["knowledge_context"]
        if not knowledge_context:
            return GenerateResponse(
                success=False,
                error="No knowledge sources found. Please add at least one website to your knowledge base.",
                pipeline_log=pipeline_log,
            )

        # Stage 2: Author
        # Drafts tweet content based on knowledge context
        author_result = await run_author(
            session=session,
            user_id=user_id,
            knowledge_context=knowledge_context,
            prompt=prompt,
            language=language,
            multiple=multiple,
        )
        pipeline_log["author"] = author_result["log"]

        # Stage 3: Editor
        # Refines the draft for engagement, selects best image
        editor_result = await run_editor(
            draft_content=author_result["draft_content"],
            suggestions=author_result["suggestions"],
            available_images=db_result["available_images"],
            multiple=multiple,
        )
        pipeline_log["editor"] = editor_result["log"]

    return GenerateResponse(
        success=True,
        content=editor_result["final_content"],
        suggestions=editor_result.get("suggestions", []),
        media_asset_id=editor_result.get("media_asset_id"),
        pipeline_log=pipeline_log,
    )
