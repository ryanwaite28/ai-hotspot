import crypto from 'node:crypto';

import type {
  CompleteMediaUploadSessionInput,
  CreateMediaCommentInput,
  CreateMediaUploadSessionInput,
  CreateMediaUploadSessionResult,
  MediaAssetView,
  MediaCommentView,
  MediaDerivative,
  MediaProcessingContract,
  MediaProcessingStatus,
  MediaVisibility,
  UpdateMediaProcessingStatusInput,
} from '../../../../../packages/contracts/src/index';
import type { MediaRepository } from './postgres-media.repository';

const MAX_PHOTO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 512 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 2200;
const MAX_ALT_TEXT_LENGTH = 1000;
const MAX_COMMENT_LENGTH = 2000;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_COMMENT_LIMIT = 100;
const DERIVATIVE_KEY_VERSION = 'v1';
const DERIVATIVE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const PHOTO_MIME_TYPES = new Set<string>(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME_TYPES = new Set<string>(['video/mp4', 'video/webm', 'video/quicktime']);

interface MediaStorageUploadSession {
  provider: string;
  uploadUrl: string;
  expiresAtEpochSeconds: number;
}

export interface MediaStoragePort {
  createResumableUploadSession(input: {
    objectKey: string;
    mimeType: string;
    fileSizeBytes: number;
    expiresInSeconds: number;
  }): Promise<MediaStorageUploadSession>;
}

export interface MediaMetadataPort {
  upsertMediaAssetMetadata(input: {
    mediaAssetId: string;
    ownerUserId: string;
    mediaKind: 'photo' | 'video';
    processingStatus: MediaProcessingStatus;
    objectKey: string;
    mimeType: string;
    visibility: MediaVisibility;
    caption: string | null;
    altText: string | null;
    allowRemix: boolean;
    carouselAssetIds: string[];
  }): Promise<void>;
  recordMediaComment(input: {
    commentId: string;
    mediaAssetId: string;
    authorUserId: string;
    parentCommentId: string | null;
  }): Promise<void>;
  upsertMediaDerivatives(input: MediaProcessingContract): Promise<void>;
}

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function pickObjectExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  if (mimeType === 'video/mp4') {
    return 'mp4';
  }
  if (mimeType === 'video/webm') {
    return 'webm';
  }
  if (mimeType === 'video/quicktime') {
    return 'mov';
  }
  return 'bin';
}

function isValidTransition(currentStatus: MediaProcessingStatus, nextStatus: MediaProcessingStatus): boolean {
  const transitions: {
    current: MediaProcessingStatus;
    allowedNext: MediaProcessingStatus[];
  }[] = [
    { current: 'uploading', allowedNext: ['uploaded', 'processing', 'rejected'] },
    { current: 'uploaded', allowedNext: ['processing', 'rejected'] },
    { current: 'processing', allowedNext: ['ready', 'rejected'] },
    { current: 'ready', allowedNext: ['ready'] },
    { current: 'rejected', allowedNext: ['rejected'] },
  ];

  const matched = transitions.find((item) => item.current === currentStatus);
  if (!matched) {
    return false;
  }

  return matched.allowedNext.includes(nextStatus);
}

export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStoragePort,
    private readonly metadata: MediaMetadataPort,
  ) {}

  private normalizeVisibility(visibility?: MediaVisibility): MediaVisibility {
    return visibility ?? 'public';
  }

  private buildDerivativeKey(baseObjectKey: string, derivativeType: 'thumbnail' | 'transcode', extension: string): string {
    return `${baseObjectKey}.${DERIVATIVE_KEY_VERSION}.${derivativeType}.${extension}`;
  }

  private buildProcessingContract(asset: MediaAssetView): MediaProcessingContract {
    const derivatives: MediaDerivative[] = [];

    if (asset.mediaKind === 'photo') {
      derivatives.push({
        derivativeId: `${asset.mediaAssetId}:thumbnail:webp`,
        derivativeType: 'thumbnail',
        objectKey: this.buildDerivativeKey(asset.objectKey, 'thumbnail', 'webp'),
        mimeType: 'image/webp',
        cacheControl: DERIVATIVE_CACHE_CONTROL,
        immutable: true,
      });
    }

    if (asset.mediaKind === 'video') {
      derivatives.push(
        {
          derivativeId: `${asset.mediaAssetId}:thumbnail:webp`,
          derivativeType: 'thumbnail',
          objectKey: this.buildDerivativeKey(asset.objectKey, 'thumbnail', 'webp'),
          mimeType: 'image/webp',
          cacheControl: DERIVATIVE_CACHE_CONTROL,
          immutable: true,
        },
        {
          derivativeId: `${asset.mediaAssetId}:transcode:mp4`,
          derivativeType: 'transcode',
          objectKey: this.buildDerivativeKey(asset.objectKey, 'transcode', 'mp4'),
          mimeType: 'video/mp4',
          cacheControl: DERIVATIVE_CACHE_CONTROL,
          immutable: true,
        },
      );
    }

    return {
      mediaAssetId: asset.mediaAssetId,
      processingStatus: asset.processingStatus,
      immutableKeyVersion: DERIVATIVE_KEY_VERSION,
      derivatives,
    };
  }

  private normalizeOptionalText(value: string | undefined, maxLength: number, fieldName: string): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new Error(`${fieldName} exceeds maximum length`);
    }

    return normalized;
  }

  private validateMimeType(mediaKind: 'photo' | 'video', mimeType: string): void {
    const normalized = mimeType.trim().toLowerCase();

    if (mediaKind === 'photo' && !PHOTO_MIME_TYPES.has(normalized)) {
      throw new Error('Unsupported photo MIME type');
    }

    if (mediaKind === 'video' && !VIDEO_MIME_TYPES.has(normalized)) {
      throw new Error('Unsupported video MIME type');
    }
  }

  private validateFileSize(mediaKind: 'photo' | 'video', fileSizeBytes: number): void {
    if (!Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
      throw new Error('fileSizeBytes must be a positive integer');
    }

    const maxSize = mediaKind === 'photo' ? MAX_PHOTO_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (fileSizeBytes > maxSize) {
      throw new Error('File exceeds maximum configured size');
    }
  }

  private normalizeCarouselIds(input: CreateMediaUploadSessionInput): string[] {
    const carouselAssetIds = input.carouselAssetIds ?? [];
    if (carouselAssetIds.length === 0) {
      return [];
    }

    if (input.mediaKind !== 'photo') {
      throw new Error('Carousel is currently supported only for photo media');
    }

    if (carouselAssetIds.length > 10) {
      throw new Error('Carousel cannot exceed 10 items');
    }

    const uniqueIds = new Set<string>();
    for (const rawId of carouselAssetIds) {
      const normalizedId = rawId.trim();
      if (normalizedId.length === 0) {
        throw new Error('Carousel item ID cannot be empty');
      }
      uniqueIds.add(normalizedId);
    }

    return Array.from(uniqueIds);
  }

  async createUploadSession(input: CreateMediaUploadSessionInput): Promise<CreateMediaUploadSessionResult | null> {
    this.validateMimeType(input.mediaKind, input.mimeType);
    this.validateFileSize(input.mediaKind, input.fileSizeBytes);

    const caption = this.normalizeOptionalText(input.caption, MAX_CAPTION_LENGTH, 'caption');
    const altText = this.normalizeOptionalText(input.altText, MAX_ALT_TEXT_LENGTH, 'altText');
    const carouselAssetIds = this.normalizeCarouselIds(input);

    const chunkSizeBytes = Math.min(DEFAULT_CHUNK_SIZE_BYTES, input.fileSizeBytes);
    const objectExtension = pickObjectExtension(input.mimeType);
    const objectKey = `media/${input.actorUserId}/${crypto.randomUUID()}.${objectExtension}`;

    const storageSession = await this.storage.createResumableUploadSession({
      objectKey,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    const created = await this.repository.createUploadSessionWithAssetDraft({
      ownerUserId: input.actorUserId,
      provider: storageSession.provider,
      uploadUrl: storageSession.uploadUrl,
      objectKey,
      mimeType: input.mimeType.trim().toLowerCase(),
      fileSizeBytes: input.fileSizeBytes,
      chunkSizeBytes,
      expiresAtEpochSeconds: storageSession.expiresAtEpochSeconds,
      mediaKind: input.mediaKind,
      visibility: this.normalizeVisibility(input.visibility),
      caption,
      altText,
      allowRemix: input.allowRemix ?? false,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });

    if (!created) {
      return null;
    }

    for (const [index, childMediaAssetId] of carouselAssetIds.entries()) {
      await this.repository.addCarouselItem({
        mediaAssetId: created.mediaAsset.mediaAssetId,
        position: index,
        childMediaAssetId,
      });
    }

    await this.metadata.upsertMediaAssetMetadata({
      mediaAssetId: created.mediaAsset.mediaAssetId,
      ownerUserId: created.mediaAsset.ownerUserId,
      mediaKind: created.mediaAsset.mediaKind,
      processingStatus: created.mediaAsset.processingStatus,
      objectKey: created.mediaAsset.objectKey,
      mimeType: created.mediaAsset.mimeType,
      visibility: created.mediaAsset.visibility,
      caption: created.mediaAsset.caption,
      altText: created.mediaAsset.altText,
      allowRemix: created.mediaAsset.allowRemix,
      carouselAssetIds,
    });

    return created;
  }

  async completeUploadSession(input: CompleteMediaUploadSessionInput): Promise<MediaAssetView | null> {
    const completedSessionAsset = await this.repository.completeUploadSessionAndGetAsset(input.uploadSessionId);
    if (!completedSessionAsset) {
      return null;
    }

    let currentAsset = completedSessionAsset;

    if (currentAsset.processingStatus === 'uploading') {
      const uploaded = await this.updateProcessingStatus({
        mediaAssetId: currentAsset.mediaAssetId,
        processingStatus: 'uploaded',
        eventSource: 'api',
      });

      if (!uploaded) {
        return null;
      }

      currentAsset = uploaded;
    }

    if (currentAsset.processingStatus === 'uploaded') {
      const processing = await this.updateProcessingStatus({
        mediaAssetId: currentAsset.mediaAssetId,
        processingStatus: 'processing',
        eventSource: input.source === 'object_storage_callback' ? 'worker' : 'api',
      });

      if (!processing) {
        return null;
      }

      currentAsset = processing;
    }

    return currentAsset;
  }

  async updateProcessingStatus(input: UpdateMediaProcessingStatusInput): Promise<MediaAssetView | null> {
    const existing = await this.repository.getMediaAssetById(input.mediaAssetId);
    if (!existing) {
      return null;
    }

    if (!isValidTransition(existing.processingStatus, input.processingStatus)) {
      throw new Error('Invalid media processing status transition');
    }

    const updated = await this.repository.setMediaProcessingStatus({
      mediaAssetId: input.mediaAssetId,
      processingStatus: input.processingStatus,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });

    if (!updated) {
      return null;
    }

    await this.metadata.upsertMediaAssetMetadata({
      mediaAssetId: updated.mediaAssetId,
      ownerUserId: updated.ownerUserId,
      mediaKind: updated.mediaKind,
      processingStatus: updated.processingStatus,
      objectKey: updated.objectKey,
      mimeType: updated.mimeType,
      visibility: updated.visibility,
      caption: updated.caption,
      altText: updated.altText,
      allowRemix: updated.allowRemix,
      carouselAssetIds: [],
    });

    if (updated.processingStatus === 'ready') {
      const processingContract = this.buildProcessingContract(updated);
      await this.metadata.upsertMediaDerivatives(processingContract);
    }

    return updated;
  }

  async createComment(input: CreateMediaCommentInput): Promise<MediaCommentView | null> {
    const mediaAsset = await this.repository.getMediaAssetById(input.mediaAssetId);
    if (!mediaAsset) {
      return null;
    }

    if (mediaAsset.processingStatus !== 'ready') {
      return null;
    }

    const bodyText = input.bodyText.trim();
    if (bodyText.length === 0) {
      throw new Error('Comment text is required');
    }

    if (bodyText.length > MAX_COMMENT_LENGTH) {
      throw new Error('Comment exceeds maximum length');
    }

    const created = await this.repository.createMediaComment({
      mediaAssetId: input.mediaAssetId,
      parentCommentId: input.parentCommentId?.trim() || null,
      authorUserId: input.actorUserId,
      bodyText,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });

    if (!created) {
      return null;
    }

    await this.metadata.recordMediaComment({
      commentId: created.commentId,
      mediaAssetId: created.mediaAssetId,
      authorUserId: created.authorUserId,
      parentCommentId: created.parentCommentId,
    });

    return created;
  }

  async listComments(mediaAssetId: string, limit?: number): Promise<MediaCommentView[]> {
    const normalizedLimit = !limit
      ? DEFAULT_COMMENT_LIMIT
      : Math.max(1, Math.min(500, Math.trunc(limit)));
    return this.repository.listMediaComments({
      mediaAssetId,
      limit: normalizedLimit,
    });
  }
}
