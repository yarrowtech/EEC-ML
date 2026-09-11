import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.modules.video import service as video_svc
from app.modules.video.schemas import VideoUnderstandResponse

router = APIRouter(prefix="/video", tags=["video"])
logger = logging.getLogger(__name__)


@router.post("/understand", response_model=VideoUnderstandResponse)
async def understand(video: UploadFile = File(...)) -> VideoUnderstandResponse:
    """Lecture video -> transcript -> summary + quiz."""
    try:
        return await video_svc.understand_video(video)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Video understanding error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
