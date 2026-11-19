export type MediaKind = 'photo' | 'video';

export type MediaVisibility = 'public' | 'followers' | 'private';

export type MediaUploadSessionStatus = 'created' | 'completed' | 'expired';

export type MediaProcessingStatus = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';

export interface MediaDerivative {
  derivativeId: string;
  derivativeType: 'thumbnail' | 'transcode';
  objectKey: string;
  mimeType: string;
  cacheControl: string;
  immutable: boolean;
}

export interface MediaProcessingContract {
  mediaAssetId: string;
  processingStatus: MediaProcessingStatus;
  immutableKeyVersion: string;
  derivatives: MediaDerivative[];
}

export interface MediaAssetView {
  mediaAssetId: string;
  ownerUserId: string;
  mediaKind: MediaKind;
  mimeType: string;
  objectKey: string;
  processingStatus: MediaProcessingStatus;
  visibility: MediaVisibility;
  caption: string | null;
  altText: string | null;
  allowRemix: boolean;
  sourceMediaAssetId: string | null;
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaUploadSessionView {
  uploadSessionId: string;
  mediaAssetId: string;
  provider: string;
  uploadUrl: string;
  objectKey: string;
  mimeType: string;
  fileSizeBytes: number;
  chunkSizeBytes: number;
  status: MediaUploadSessionStatus;
  expiresAt: string;
  createdAt: string;
}

export interface CreateMediaUploadSessionInput {
  actorUserId: string;
  mediaKind: MediaKind;
  mimeType: string;
  fileSizeBytes: number;
  visibility?: MediaVisibility;
  caption?: string;
  altText?: string;
  allowRemix?: boolean;
  carouselAssetIds?: string[];
}

export interface CreateMediaUploadSessionResult {
  uploadSession: MediaUploadSessionView;
  mediaAsset: MediaAssetView;
}

export interface CompleteMediaUploadSessionInput {
  uploadSessionId: string;
  source: 'object_storage_callback' | 'api';
}

export interface UpdateMediaProcessingStatusInput {
  mediaAssetId: string;
  processingStatus: MediaProcessingStatus;
  eventSource: 'api' | 'worker';
}

export interface MediaCommentView {
  commentId: string;
  mediaAssetId: string;
  parentCommentId: string | null;
  authorUserId: string;
  bodyText: string;
  status: 'published' | 'deleted';
  createdAt: string;
  deletedAt: string | null;
}

export interface CreateMediaCommentInput {
  actorUserId: string;
  mediaAssetId: string;
  bodyText: string;
  parentCommentId?: string;
}

export type MediaDerivativeType = 'stitch' | 'duet';

export interface StitchTimelineAssembly {
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  destinationStartSeconds: number;
  destinationEndSeconds: number;
}

export interface DuetLayoutAssembly {
  sourceLayout: 'left' | 'right';
  destinationLayout: 'right' | 'left';
}

export type MediaDerivativeAssembly = StitchTimelineAssembly | DuetLayoutAssembly;

export interface CreateMediaDerivativeInput {
  actorUserId: string;
  sourceMediaAssetId: string;
  destinationMediaAssetId: string;
  derivativeType: MediaDerivativeType;
  assembly: MediaDerivativeAssembly;
}

export interface MediaDerivativeAttribution {
  sourceOwnerUserId: string;
  destinationOwnerUserId: string;
  sourceMediaAssetId: string;
  destinationMediaAssetId: string;
  createdByUserId: string;
}

export interface MediaDerivativeRelationshipView {
  relationshipId: string;
  sourceMediaAssetId: string;
  destinationMediaAssetId: string;
  derivativeType: MediaDerivativeType;
  assembly: MediaDerivativeAssembly;
  ownerUserId: string;
  attribution: MediaDerivativeAttribution;
  status: 'created' | 'processing' | 'ready' | 'rejected' | 'takedown';
  takedownReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMediaDerivativeStatusInput {
  relationshipId: string;
  status: 'processing' | 'ready' | 'rejected' | 'takedown';
  takedownReason?: string;
}
