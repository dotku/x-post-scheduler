from pydantic import BaseModel


class GenerateRequest(BaseModel):
    user_id: str
    prompt: str | None = None
    language: str | None = None
    multiple: bool = False


class GenerateResponse(BaseModel):
    success: bool
    content: str | None = None
    suggestions: list[str] = []
    media_asset_id: str | None = None
    pipeline_log: dict[str, str] = {}
    error: str | None = None


class BatchGenerateRequest(BaseModel):
    user_id: str
    count: int = 3
    schedule_times: list[str] = []


class BatchGenerateResponse(BaseModel):
    success: bool
    posts_created: int = 0
    post_ids: list[str] = []
    error: str | None = None
