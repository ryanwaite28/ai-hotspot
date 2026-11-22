import type {
  MediaAssetView,
  MediaCommentView,
  MediaDerivativeAssembly,
  MediaDerivativeRelationshipView,
  MediaDerivativeType,
  MediaProcessingStatus,
  MediaUploadSessionView,
  MediaVisibility,
} from '../../../../../packages/contracts/src/index';
import {
  mediaQueries,
  type MediaAssetRow,
  type MediaCommentRow,
  type MediaDerivativeRelationshipRow,
  type MediaUploadSessionRow,
  type QueryExecutor,
} from '../../db/queries/media.queries';

export interface CreateUploadSessionInput {
  ownerUserId: string;
  provider: string;
  uploadUrl: string;
  objectKey: string;
  mimeType: string;
  fileSizeBytes: number;
  chunkSizeBytes: number;
  expiresAtEpochSeconds: number;
  mediaKind: 'photo' | 'video';
  visibility: MediaVisibility;
  caption: string | null;
  altText: string | null;
  allowRemix: boolean;
  eventId: string;
  occurredAtEpochSeconds: number;
}

export interface MediaRepository {
  createUploadSessionWithAssetDraft(input: CreateUploadSessionInput): Promise<{
    uploadSession: MediaUploadSessionView;
    mediaAsset: MediaAssetView;
  } | null>;
  addCarouselItem(input: {
    mediaAssetId: string;
    position: number;
    childMediaAssetId: string;
  }): Promise<void>;
  getMediaAssetById(mediaAssetId: string): Promise<MediaAssetView | null>;
  getMediaAssetByUploadSessionId(uploadSessionId: string): Promise<MediaAssetView | null>;
  completeUploadSessionAndGetAsset(uploadSessionId: string): Promise<MediaAssetView | null>;
  setMediaProcessingStatus(input: {
    mediaAssetId: string;
    processingStatus: MediaProcessingStatus;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaAssetView | null>;
  createMediaComment(input: {
    mediaAssetId: string;
    parentCommentId: string | null;
    authorUserId: string;
    bodyText: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaCommentView | null>;
  listMediaComments(input: {
    mediaAssetId: string;
    limit: number;
  }): Promise<MediaCommentView[]>;
  createDerivative(input: {
    sourceMediaAssetId: string;
    destinationMediaAssetId: string;
    derivativeType: MediaDerivativeType;
    assembly: MediaDerivativeAssembly;
    ownerUserId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaDerivativeRelationshipView | null>;
  setDerivativeStatus(input: {
    relationshipId: string;
    status: 'processing' | 'ready' | 'rejected' | 'takedown';
    takedownReason: string | null;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaDerivativeRelationshipView | null>;
  takeDownDerivativesFromSource(input: {
    sourceMediaAssetId: string;
    takedownReason: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaDerivativeRelationshipView[]>;
}

function mapUploadSessionRow(row: MediaUploadSessionRow): {
  uploadSession: MediaUploadSessionView;
  mediaAsset: MediaAssetView;
} {
  return {
    uploadSession: {
      uploadSessionId: row.upload_session_id,
      mediaAssetId: row.media_asset_id,
      provider: row.provider,
      uploadUrl: row.upload_url,
      objectKey: row.object_key,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      chunkSizeBytes: row.chunk_size_bytes,
      status: row.upload_status,
      expiresAt: row.expires_at,
      createdAt: row.session_created_at,
    },
    mediaAsset: {
      mediaAssetId: row.media_asset_id,
      ownerUserId: row.owner_user_id,
      mediaKind: row.media_kind,
      mimeType: row.mime_type,
      objectKey: row.object_key,
      processingStatus: row.processing_status,
      visibility: row.visibility,
      caption: row.caption,
      altText: row.alt_text,
      allowRemix: row.allow_remix,
      sourceMediaAssetId: row.source_media_asset_id,
      readyAt: row.ready_at,
      createdAt: row.asset_created_at,
      updatedAt: row.asset_updated_at,
    },
  };
}

function mapMediaAssetRow(row: MediaAssetRow): MediaAssetView {
  return {
    mediaAssetId: row.id,
    ownerUserId: row.owner_user_id,
    mediaKind: row.media_kind,
    mimeType: row.mime_type,
    objectKey: row.object_key,
    processingStatus: row.processing_status,
    visibility: row.visibility,
    caption: row.caption,
    altText: row.alt_text,
    allowRemix: row.allow_remix,
    sourceMediaAssetId: row.source_media_asset_id,
    readyAt: row.ready_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMediaCommentRow(row: MediaCommentRow): MediaCommentView {
  return {
    commentId: row.id,
    mediaAssetId: row.media_asset_id,
    parentCommentId: row.parent_comment_id,
    authorUserId: row.author_user_id,
    bodyText: row.body_text,
    status: row.status,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function mapMediaDerivativeRelationshipRow(row: MediaDerivativeRelationshipRow): MediaDerivativeRelationshipView {
  return {
    relationshipId: row.id,
    sourceMediaAssetId: row.source_media_asset_id,
    destinationMediaAssetId: row.destination_media_asset_id,
    derivativeType: row.derivative_type,
    assembly: JSON.parse(row.assembly_json) as MediaDerivativeAssembly,
    ownerUserId: row.owner_user_id,
    attribution: {
      sourceOwnerUserId: row.source_owner_user_id,
      destinationOwnerUserId: row.destination_owner_user_id,
      sourceMediaAssetId: row.source_media_asset_id,
      destinationMediaAssetId: row.destination_media_asset_id,
      createdByUserId: row.created_by_user_id,
    },
    status: row.status,
    takedownReason: row.takedown_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresMediaRepository implements MediaRepository {
  constructor(private readonly db: QueryExecutor) {}

  async createUploadSessionWithAssetDraft(input: CreateUploadSessionInput): Promise<{
    uploadSession: MediaUploadSessionView;
    mediaAsset: MediaAssetView;
  } | null> {
    const result = await this.db.query<MediaUploadSessionRow>(mediaQueries.insertUploadSessionAndAssetWithOutbox, [
      input.ownerUserId,
      input.provider,
      input.uploadUrl,
      input.objectKey,
      input.mimeType,
      input.fileSizeBytes,
      input.chunkSizeBytes,
      input.expiresAtEpochSeconds,
      input.mediaKind,
      input.visibility,
      input.caption,
      input.altText,
      input.allowRemix,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUploadSessionRow(result.rows[0]);
  }

  async addCarouselItem(input: {
    mediaAssetId: string;
    position: number;
    childMediaAssetId: string;
  }): Promise<void> {
    await this.db.query(mediaQueries.insertCarouselItem, [
      input.mediaAssetId,
      input.position,
      input.childMediaAssetId,
    ]);
  }

  async getMediaAssetById(mediaAssetId: string): Promise<MediaAssetView | null> {
    const result = await this.db.query<MediaAssetRow>(mediaQueries.selectMediaAssetById, [mediaAssetId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapMediaAssetRow(result.rows[0]);
  }

  async getMediaAssetByUploadSessionId(uploadSessionId: string): Promise<MediaAssetView | null> {
    const result = await this.db.query<MediaAssetRow>(mediaQueries.selectMediaAssetByUploadSessionId, [uploadSessionId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapMediaAssetRow(result.rows[0]);
  }

  async completeUploadSessionAndGetAsset(uploadSessionId: string): Promise<MediaAssetView | null> {
    const result = await this.db.query<MediaAssetRow>(mediaQueries.markUploadSessionCompletedAndSelectAsset, [uploadSessionId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapMediaAssetRow(result.rows[0]);
  }

  async setMediaProcessingStatus(input: {
    mediaAssetId: string;
    processingStatus: MediaProcessingStatus;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaAssetView | null> {
    const result = await this.db.query<MediaAssetRow>(mediaQueries.updateMediaStatusWithOutbox, [
      input.mediaAssetId,
      input.processingStatus,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapMediaAssetRow(result.rows[0]);
  }

  async createMediaComment(input: {
    mediaAssetId: string;
    parentCommentId: string | null;
    authorUserId: string;
    bodyText: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaCommentView | null> {
    const result = await this.db.query<MediaCommentRow>(mediaQueries.insertMediaCommentWithOutbox, [
      input.mediaAssetId,
      input.parentCommentId,
      input.authorUserId,
      input.bodyText,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapMediaCommentRow(result.rows[0]);
  }

  async listMediaComments(input: {
    mediaAssetId: string;
    limit: number;
  }): Promise<MediaCommentView[]> {
    const result = await this.db.query<MediaCommentRow>(mediaQueries.selectMediaCommentsByAsset, [
      input.mediaAssetId,
      input.limit,
    ]);

    return result.rows.map(mapMediaCommentRow);
  }

  async createDerivative(input: {
    sourceMediaAssetId: string;
    destinationMediaAssetId: string;
    derivativeType: MediaDerivativeType;
    assembly: MediaDerivativeAssembly;
    ownerUserId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaDerivativeRelationshipView | null> {
    const result = await this.db.query<MediaDerivativeRelationshipRow>(
      mediaQueries.insertMediaDerivativeRelationshipWithOutbox,
      [
        input.sourceMediaAssetId,
        input.destinationMediaAssetId,
        input.derivativeType,
        JSON.stringify(input.assembly),
        input.ownerUserId,
        input.eventId,
        input.occurredAtEpochSeconds,
      ],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapMediaDerivativeRelationshipRow(result.rows[0]);
  }

  async setDerivativeStatus(input: {
    relationshipId: string;
    status: 'processing' | 'ready' | 'rejected' | 'takedown';
    takedownReason: string | null;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaDerivativeRelationshipView | null> {
    const result = await this.db.query<MediaDerivativeRelationshipRow>(mediaQueries.updateMediaDerivativeStatusWithOutbox, [
      input.relationshipId,
      input.status,
      input.takedownReason,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapMediaDerivativeRelationshipRow(result.rows[0]);
  }

  async takeDownDerivativesFromSource(input: {
    sourceMediaAssetId: string;
    takedownReason: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<MediaDerivativeRelationshipView[]> {
    const result = await this.db.query<MediaDerivativeRelationshipRow>(mediaQueries.takeDownDerivativesFromSourceWithOutbox, [
      input.sourceMediaAssetId,
      input.takedownReason,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    return result.rows.map(mapMediaDerivativeRelationshipRow);
  }
}
