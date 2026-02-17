from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from ..config import settings

EDITOR_SYSTEM_PROMPT = """You are a meticulous social media editor. Review and refine the draft tweet for maximum engagement and lead generation.

Your editing checklist:
1. CHARACTER LIMIT: Must be under 280 characters. If over, shorten it.
2. HOOK: The first line should grab attention immediately.
3. VALUE: The tweet should offer insight, a tip, or interesting information.
4. CTA: Include a subtle call-to-action when appropriate (learn more, check out, etc.)
5. HASHTAGS: Keep 1-2 relevant hashtags. Remove excessive ones.
6. EMOJIS: Keep 1-2 emojis max. Remove if excessive.
7. TONE: Natural and authentic, not corporate or salesy.
8. GRAMMAR: Fix any grammatical errors.
9. LANGUAGE: Maintain the same language as the draft.

Output ONLY the refined tweet text. No explanations."""


async def run_editor(
    draft_content: str,
    suggestions: list[str],
    available_images: list[dict],
    multiple: bool = False,
) -> dict:
    """Editor agent: refines draft for engagement, selects best image."""
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.3,
        max_tokens=500 if multiple else 150,
        api_key=settings.openai_api_key,
    )

    selected_image_id: str | None = None

    if multiple and suggestions:
        # Refine each suggestion
        refined: list[str] = []
        for suggestion in suggestions:
            response = await llm.ainvoke([
                SystemMessage(content=EDITOR_SYSTEM_PROMPT),
                HumanMessage(content=f"DRAFT TWEET:\n{suggestion}"),
            ])
            refined_text = response.content.strip()
            if len(refined_text) > 280:
                refined_text = refined_text[:277] + "..."
            refined.append(refined_text)

        # Select best image for the first suggestion
        if available_images and refined:
            selected_image_id = await _select_best_image(
                llm, refined[0], available_images
            )

        return {
            "final_content": refined[0] if refined else "",
            "suggestions": refined,
            "media_asset_id": selected_image_id,
            "log": f"Refined {len(refined)} suggestions",
        }
    else:
        response = await llm.ainvoke([
            SystemMessage(content=EDITOR_SYSTEM_PROMPT),
            HumanMessage(content=f"DRAFT TWEET:\n{draft_content}"),
        ])
        final = response.content.strip()
        if len(final) > 280:
            final = final[:277] + "..."

        # Select best image
        if available_images:
            selected_image_id = await _select_best_image(
                llm, final, available_images
            )

        return {
            "final_content": final,
            "suggestions": [],
            "media_asset_id": selected_image_id,
            "log": f"Refined tweet ({len(final)} chars)",
        }


async def _select_best_image(
    llm: ChatOpenAI,
    tweet_text: str,
    images: list[dict],
) -> str | None:
    """Use LLM to select the best matching image for the tweet."""
    if not images:
        return None

    image_list = "\n".join(
        f"{i+1}. ID: {img['id']} | Alt: {img.get('alt', 'no description')} | URL: {img['url']}"
        for i, img in enumerate(images[:10])
    )

    response = await llm.ainvoke([
        SystemMessage(
            content="You are an image selector. Given a tweet and a list of available images, "
            "select the image that best matches the tweet content. "
            "Respond with ONLY the image ID, or 'NONE' if no image is a good match."
        ),
        HumanMessage(
            content=f"TWEET:\n{tweet_text}\n\nAVAILABLE IMAGES:\n{image_list}"
        ),
    ])

    result = response.content.strip()
    if result == "NONE":
        return None

    # Validate the returned ID exists
    valid_ids = {img["id"] for img in images}
    if result in valid_ids:
        return result

    # Try to extract ID from response
    for img in images:
        if img["id"] in result:
            return img["id"]

    return None
