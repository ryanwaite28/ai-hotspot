import { MongoClient, type Collection, type Document } from 'mongodb';

import type { MediaMetadataPort } from '../../service/media/media.service';

interface MediaAssetMetadataDocument extends Document {
  media_asset_id: string;
  owner_user_id: string;
  media_kind: 'photo' | 'video';
  processing_status: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
  object_key: string;
  mime_type: string;
  visibility: 'public' | 'followers' | 'private';
  caption: string | null;
  alt_text: string | null;
  allow_remix: boolean;
  carousel_asset_ids: string[];
  updated_at: string;
  created_at?: string;
}

interface MediaCommentMetadataDocument extends Document {
  comment_id: string;
  media_asset_id: string;
  author_user_id: string;
  parent_comment_id: string | null;
  created_at: string;
}

interface MediaDerivativeMetadataDocument extends Document {
  media_asset_id: string;
  processing_status: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
  immutable_key_version: string;
  derivatives: Array<{
    derivative_id: string;
    derivative_type: 'thumbnail' | 'transcode';
    object_key: string;
    mime_type: string;
    cache_control: string;
    immutable: boolean;
  }>;
  updated_at: string;
  created_at?: string;
}

interface MongoCollections {
  assets: Collection<MediaAssetMetadataDocument>;
  comments: Collection<MediaCommentMetadataDocument>;
  derivatives: Collection<MediaDerivativeMetadataDocument>;
}

export class MongoMediaMetadataRepository implements MediaMetadataPort {
  private mongoClient: MongoClient | null = null;

  private mongoCollectionsPromise: Promise<MongoCollections> | null = null;

  constructor(
    private readonly mongoUrl: string,
    private readonly databaseName: string,
  ) {}

  private async getCollections(): Promise<MongoCollections> {
    if (this.mongoCollectionsPromise) {
      return this.mongoCollectionsPromise;
    }

    this.mongoCollectionsPromise = (async () => {
      this.mongoClient = new MongoClient(this.mongoUrl);
      await this.mongoClient.connect();
      const db = this.mongoClient.db(this.databaseName);

      return {
        assets: db.collection<MediaAssetMetadataDocument>('media_assets'),
        comments: db.collection<MediaCommentMetadataDocument>('media_comments'),
        derivatives: db.collection<MediaDerivativeMetadataDocument>('media_derivatives'),
      };
    })();

    return this.mongoCollectionsPromise;
  }

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
    const collections = await this.getCollections();
    const nowIso = new Date().toISOString();

    await collections.assets.updateOne(
      { media_asset_id: input.mediaAssetId },
      {
        $set: {
          owner_user_id: input.ownerUserId,
          media_kind: input.mediaKind,
          processing_status: input.processingStatus,
          object_key: input.objectKey,
          mime_type: input.mimeType,
          visibility: input.visibility,
          caption: input.caption,
          alt_text: input.altText,
          allow_remix: input.allowRemix,
          carousel_asset_ids: input.carouselAssetIds,
          updated_at: nowIso,
        },
        $setOnInsert: {
          media_asset_id: input.mediaAssetId,
          created_at: nowIso,
        },
      },
      { upsert: true },
    );
  }

  async recordMediaComment(input: {
    commentId: string;
    mediaAssetId: string;
    authorUserId: string;
    parentCommentId: string | null;
  }): Promise<void> {
    const collections = await this.getCollections();

    await collections.comments.updateOne(
      { comment_id: input.commentId },
      {
        $set: {
          media_asset_id: input.mediaAssetId,
          author_user_id: input.authorUserId,
          parent_comment_id: input.parentCommentId,
        },
        $setOnInsert: {
          comment_id: input.commentId,
          created_at: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
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
    const collections = await this.getCollections();
    const nowIso = new Date().toISOString();

    await collections.derivatives.updateOne(
      { media_asset_id: input.mediaAssetId },
      {
        $set: {
          processing_status: input.processingStatus,
          immutable_key_version: input.immutableKeyVersion,
          derivatives: input.derivatives.map((derivative) => ({
            derivative_id: derivative.derivativeId,
            derivative_type: derivative.derivativeType,
            object_key: derivative.objectKey,
            mime_type: derivative.mimeType,
            cache_control: derivative.cacheControl,
            immutable: derivative.immutable,
          })),
          updated_at: nowIso,
        },
        $setOnInsert: {
          media_asset_id: input.mediaAssetId,
          created_at: nowIso,
        },
      },
      { upsert: true },
    );
  }

  async close(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
      this.mongoCollectionsPromise = null;
    }
  }
}
