import type {
  CompleteMediaUploadSessionInput,
  CreateMediaCommentInput,
  CreateMediaDerivativeInput,
  CreateMediaUploadSessionInput,
  UpdateMediaDerivativeStatusInput,
  UpdateMediaProcessingStatusInput,
} from '../../../../../packages/contracts/src/index';
import type { MediaService } from '../../service/media/media.service';

export class MediaHandler {
  constructor(private readonly mediaService: MediaService) {}

  async createUploadSession(
    actorUserId: string,
    body: Omit<CreateMediaUploadSessionInput, 'actorUserId'>,
  ) {
    return this.mediaService.createUploadSession({
      actorUserId,
      ...body,
    });
  }

  async updateProcessingStatus(body: UpdateMediaProcessingStatusInput) {
    return this.mediaService.updateProcessingStatus(body);
  }

  async completeUploadSession(body: CompleteMediaUploadSessionInput) {
    return this.mediaService.completeUploadSession(body);
  }

  async createComment(actorUserId: string, body: Omit<CreateMediaCommentInput, 'actorUserId'>) {
    return this.mediaService.createComment({
      actorUserId,
      ...body,
    });
  }

  async listComments(params: {
    mediaAssetId: string;
    limit?: number;
  }) {
    return this.mediaService.listComments(params.mediaAssetId, params.limit);
  }

  async createDerivative(
    actorUserId: string,
    body: Omit<CreateMediaDerivativeInput, 'actorUserId'>,
  ) {
    return this.mediaService.createDerivative({
      actorUserId,
      ...body,
    });
  }

  async updateDerivativeStatus(body: UpdateMediaDerivativeStatusInput) {
    return this.mediaService.updateDerivativeStatus(body);
  }

  async takeDownDerivativesFromSource(
    actorUserId: string,
    params: {
      sourceMediaAssetId: string;
      takedownReason: string;
    },
  ) {
    return this.mediaService.takeDownDerivativesFromSource({
      actorUserId,
      ...params,
    });
  }
}
