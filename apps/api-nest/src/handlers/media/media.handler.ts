import type {
  CompleteMediaUploadSessionInput,
  CreateMediaCommentInput,
  CreateMediaUploadSessionInput,
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
}
