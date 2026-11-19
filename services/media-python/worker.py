from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

MediaProcessingStatus = Literal["uploaded", "processing", "ready", "rejected"]


@dataclass(frozen=True)
class MediaProcessingPayload:
    media_asset_id: str
    owner_user_id: str
    object_key: str
    mime_type: str


@dataclass(frozen=True)
class DomainEventEnvelope:
    event_id: str
    event_type: str
    aggregate_type: str
    aggregate_id: str
    occurred_at: str
    payload: MediaProcessingPayload


@dataclass(frozen=True)
class MediaProcessingResult:
    media_asset_id: str
    processing_status: MediaProcessingStatus
    processed_at: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def process_media_event(event: DomainEventEnvelope) -> MediaProcessingResult:
    """
    Phase 4 scaffold:
    - The worker accepts media processing requests from RabbitMQ.
    - Real transcode/thumbnail/fingerprint logic is added in a later Phase 4 slice.
    """
    if event.event_type != "media.processing.requested":
        raise ValueError("Unsupported media event type")

    return MediaProcessingResult(
        media_asset_id=event.aggregate_id,
        processing_status="processing",
        processed_at=utc_now_iso(),
    )
