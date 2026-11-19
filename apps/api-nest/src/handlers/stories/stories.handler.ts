import type {
  CreateStoryReplyInput,
  CreateStoryInput,
  ExpireStoriesInput,
  ListStoryViewersInput,
  ViewStoryInput,
} from '../../../../../packages/contracts/src';
import type { StoriesService } from '../../service/stories/stories.service';

export class StoriesHandler {
  constructor(private readonly storiesService: StoriesService) {}

  async createStory(
    actorUserId: string,
    body: Omit<CreateStoryInput, 'actorUserId'>,
  ) {
    return this.storiesService.createStory({
      actorUserId,
      ...body,
    });
  }

  async listActiveStoriesByAuthor(params: {
    authorUserId: string;
    limit?: number;
  }) {
    return this.storiesService.listActiveStoriesByAuthor({
      authorUserId: params.authorUserId,
      limit: params.limit,
    });
  }

  async expireStories(body: ExpireStoriesInput) {
    return this.storiesService.expireStories(body);
  }

  async viewStory(body: ViewStoryInput) {
    return this.storiesService.viewStory(body);
  }

  async listStoryViewers(body: ListStoryViewersInput) {
    return this.storiesService.listStoryViewers(body);
  }

  async createStoryReply(
    actorUserId: string,
    body: Omit<CreateStoryReplyInput, 'actorUserId'>,
  ) {
    return this.storiesService.createStoryReply({
      actorUserId,
      ...body,
    });
  }
}
