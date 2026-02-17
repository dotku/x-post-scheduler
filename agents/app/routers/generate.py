from fastapi import APIRouter, Depends

from ..auth import verify_token
from ..schemas import GenerateRequest, GenerateResponse
from ..agents.pipeline import run_pipeline

router = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest, _token: str = Depends(verify_token)):
    try:
        result = await run_pipeline(
            user_id=request.user_id,
            prompt=request.prompt,
            language=request.language,
            multiple=request.multiple,
        )
        return result
    except Exception as e:
        return GenerateResponse(success=False, error=str(e))
