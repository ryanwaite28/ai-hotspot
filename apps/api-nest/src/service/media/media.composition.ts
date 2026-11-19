import { MediaHandler } from '../../handlers/media/media.handler';
import { MongoMediaMetadataRepository } from '../../db/mongo/media-metadata.repository';
import type { QueryExecutor } from '../../db/queries/media.queries';
import { MediaService, type MediaMetadataPort, type MediaStoragePort } from './media.service';
import { PostgresMediaRepository } from './postgres-media.repository';

class LocalObjectStorageAdapter implements MediaStoragePort {
  async createResumableUploadSession(input: {
    objectKey: string;
    mimeType: string;
    fileSizeBytes: number;
    expiresInSeconds: number;
  }): Promise<{
    provider: string;
    uploadUrl: string;
    expiresAtEpochSeconds: number;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const encodedObjectKey = encodeURIComponent(input.objectKey);

    return {
      provider: 'minio',
      uploadUrl: `http://minio:9000/hotspot-media/${encodedObjectKey}?resumable=1`,
      expiresAtEpochSeconds: now + input.expiresInSeconds,
    };
  }
}

class InMemoryMediaMetadataRepository implements MediaMetadataPort {
  private readonly assets = new Map<string, {
    mediaAssetId: string;
    ownerUserId: string;
    mediaKind: 'photo' | 'video';
    processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
    objectKey: string;
    mimeType: string;
    visibility: 'public' | 'followers' | 'private';
    caption: string | null;
    altText: string | null;
    allowRemix: boolean;
    carouselAssetIds: string[];
  }>();

  private readonly comments = new Map<string, {
    commentId: string;
    mediaAssetId: string;
    authorUserId: string;
    parentCommentId: string | null;
  }>();

  private readonly derivatives = new Map<string, {
    mediaAssetId: string;
    processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
    immutableKeyVersion: string;
    derivatives: Array<{
      derivativeId: string;
      derivativeType: 'thumbnail' | 'transcode';
      objectKey: string;
      mimeType: string;
      cacheControl: string;
      immutable: boolean;
    }>;
  }>();

  async upsertMediaAssetMetadata(input: {
    mediaAssetId: string;
    ownerUserId: string;
    mediaKind: 'photo' | 'video';
    processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
    objectKey: string;
    mimeType: string;
    visibility: 'public' | 'followers' | 'private';
    caption: string | null;
    altText: string | null;
    allowRemix: boolean;
    carouselAssetIds: string[];
  }): Promise<void> {
    this.assets.set(input.mediaAssetId, {
      mediaAssetId: input.mediaAssetId,
      ownerUserId: input.ownerUserId,
      mediaKind: input.mediaKind,
      processingStatus: input.processingStatus,
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      visibility: input.visibility,
      caption: input.caption,
      altText: input.altText,
      allowRemix: input.allowRemix,
      carouselAssetIds: input.carouselAssetIds,
    });
  }

  async recordMediaComment(input: {
    commentId: string;
    mediaAssetId: string;
    authorUserId: string;
    parentCommentId: string | null;
  }): Promise<void> {
    this.comments.set(input.commentId, {
      commentId: input.commentId,
      mediaAssetId: input.mediaAssetId,
      authorUserId: input.authorUserId,
      parentCommentId: input.parentCommentId,
    });
  }

  async upsertMediaDerivatives(input: {
    mediaAssetId: string;
    processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
    immutableKeyVersion: string;
    derivatives: Array<{
      derivativeId: string;
      derivativeType: 'thumbnail' | 'transcode';
      objectKey: string;
      mimeType: string;
      cacheControl: string;
      immutable: boolean;
    }>;
  }): Promise<void> {
    this.derivatives.set(input.mediaAssetId, {
      mediaAssetId: input.mediaAssetId,
      processingStatus: input.processingStatus,
      immutableKeyVersion: input.immutableKeyVersion,
      derivatives: input.derivatives,
    });
  }
}

export interface MediaComposition {
  handler: MediaHandler;
  service: MediaService;
  repository: PostgresMediaRepository;
}

export interface BuildMediaCompositionOptions {
  metadataPort?: MediaMetadataPort;
}

function createMetadataPort(options?: BuildMediaCompositionOptions): MediaMetadataPort {
  if (options?.metadataPort) {
    return options.metadataPort;
  }

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl || mongoUrl.trim().length === 0) {
    return new InMemoryMediaMetadataRepository();
  }

  const databaseName = process.env.MONGODB_DB_NAME && process.env.MONGODB_DB_NAME.trim().length > 0
    ? process.env.MONGODB_DB_NAME
    : 'hotspot';

  return new MongoMediaMetadataRepository(mongoUrl, databaseName);
}

export function buildMediaComposition(db: QueryExecutor, options?: BuildMediaCompositionOptions): MediaComposition {
  const repository = new PostgresMediaRepository(db);
  const storage = new LocalObjectStorageAdapter();
  const metadata = createMetadataPort(options);
  const service = new MediaService(repository, storage, metadata);
  const handler = new MediaHandler(service);

  return {
    handler,
    service,
    repository,
  };
}
