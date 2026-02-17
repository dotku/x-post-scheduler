from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..tools.knowledge_reader import get_recent_posts

AUTHOR_SYSTEM_PROMPT = """You are an expert social media content author specializing in creating engaging tweets for business lead generation.

Your task is to draft tweet content based on the provided knowledge base. Follow these rules:

1. Keep content under 280 characters (STRICT limit)
2. Write in a natural, authentic tone - not salesy or spammy
3. Use 1-2 relevant hashtags maximum
4. Use 1-2 emojis maximum
5. Include a compelling hook in the first line
6. Focus on value and insight, not direct selling
7. If a specific language is requested, write in that language
8. If knowledge base content is in a non-English language, match that language unless instructed otherwise
9. Avoid repeating topics from recent posts

Output ONLY the tweet text. No explanations, no quotes, no labels."""

MULTIPLE_SYSTEM_PROMPT = """You are an expert social media content author. Generate exactly {count} distinct tweet suggestions based on the knowledge base.

Rules for each tweet:
1. Keep under 280 characters (STRICT limit)
2. Natural, authentic tone
3. 1-2 hashtags max, 1-2 emojis max
4. Each suggestion should take a DIFFERENT angle or topic
5. Focus on value and lead generation
6. Match the language of the knowledge base unless instructed otherwise

Output each tweet on a separate line. Number them 1., 2., 3. No other text."""


async def run_author(
    session: AsyncSession,
    user_id: str,
    knowledge_context: str,
    prompt: str | None,
    language: str | None,
    multiple: bool = False,
    count: int = 3,
) -> dict:
    """Author agent: drafts tweet content based on knowledge context."""
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.9 if multiple else 0.8,
        max_tokens=500 if multiple else 150,
        api_key=settings.openai_api_key,
    )

    # Get recent posts to avoid repetition
    recent_posts = await get_recent_posts(session, user_id)
    recent_context = ""
    if recent_posts:
        recent_context = "\n\nRECENT POSTS TO AVOID REPEATING:\n" + "\n".join(
            f"- {p[:100]}" for p in recent_posts[:10]
        )

    language_instruction = ""
    if language and language != "auto":
        language_instruction = f"\n\nIMPORTANT: Write the tweet in {language}."

    user_prompt_parts = [f"KNOWLEDGE BASE:\n{knowledge_context}"]
    if recent_context:
        user_prompt_parts.append(recent_context)
    if language_instruction:
        user_prompt_parts.append(language_instruction)
    if prompt:
        user_prompt_parts.append(f"\nUSER TOPIC/DIRECTION: {prompt}")

    user_content = "\n".join(user_prompt_parts)

    if multiple:
        system = MULTIPLE_SYSTEM_PROMPT.format(count=count)
        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user_content),
        ])
        # Parse numbered suggestions
        lines = response.content.strip().split("\n")
        suggestions = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Remove numbering like "1. ", "2. ", etc.
            import re
            cleaned = re.sub(r"^\d+\.\s*", "", line)
            if cleaned and len(cleaned) <= 280:
                suggestions.append(cleaned)

        return {
            "suggestions": suggestions[:count],
            "draft_content": suggestions[0] if suggestions else "",
            "log": f"Generated {len(suggestions)} suggestions",
        }
    else:
        response = await llm.ainvoke([
            SystemMessage(content=AUTHOR_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ])
        draft = response.content.strip()
        # Truncate if over 280
        if len(draft) > 280:
            draft = draft[:277] + "..."

        return {
            "draft_content": draft,
            "suggestions": [],
            "log": f"Drafted tweet ({len(draft)} chars)",
        }
