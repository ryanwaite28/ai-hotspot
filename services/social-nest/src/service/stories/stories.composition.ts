import { MongoStoryViewsRepository, type StoryViewsPort } from '../../db/mongo/story-views.repository';
import type { QueryExecutor } from '../../db/queries/stories.queries';
import { PostgresStoriesRepository } from './postgres-stories.repository';
import { StoriesService } from './stories.service';

class InMemoryStoryViewsRepository implements StoryViewsPort {
  private readonly records = new Map<string, {
    storyId: string;
    ownerUserId: string;
    viewerUserId: string;
    firstViewedAt: string;
    lastViewedAt: string;
    viewCount: number;
  }>();

  private key(storyId: string, ownerUserId: string, viewerUserId: string): string {
    return `${storyId}:${ownerUserId}:${viewerUserId}`;
  }

  async recordStoryView(input: {
    storyId: string;
    ownerUserId: string;
    viewerUserId: string;
  }): Promise<void> {
    const key = this.key(input.storyId, input.ownerUserId, input.viewerUserId);
    const nowIso = new Date().toISOString();
    const existing = this.records.get(key);

    if (!existing) {
      this.records.set(key, {
        storyId: input.storyId,
        ownerUserId: input.ownerUserId,
        viewerUserId: input.viewerUserId,
        firstViewedAt: nowIso,
        lastViewedAt: nowIso,
        viewCount: 1,
      });
      return;
    }

    this.records.set(key, {
      ...existing,
      lastViewedAt: nowIso,
      viewCount: existing.viewCount + 1,
    });
  }

  async listStoryViewers(input: {
    storyId: string;
    ownerUserId: string;
    limit: number;
  }): Promise<Array<{
    viewerUserId: string;
    firstViewedAt: string;
    lastViewedAt: string;
    viewCount: number;
  }>> {
    const records = Array.from(this.records.values())
      .filter((record) => record.storyId === input.storyId && record.ownerUserId === input.ownerUserId)
      .sort((a, b) => b.lastViewedAt.localeCompare(a.lastViewedAt))
      .slice(0, input.limit)
      .map((record) => ({
        viewerUserId: record.viewerUserId,
        firstViewedAt: record.firstViewedAt,
        lastViewedAt: record.lastViewedAt,
        viewCount: record.viewCount,
      }));

    return records;
  }

  async getStoryViewCount(input: {
    storyId: string;
    ownerUserId: string;
  }): Promise<number> {
    return Array.from(this.records.values())
      .filter((record) => record.storyId === input.storyId && record.ownerUserId === input.ownerUserId)
      .reduce((sum, record) => sum + record.viewCount, 0);
  }
}

function createStoryViewsPort(): StoryViewsPort {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl || mongoUrl.trim().length === 0) {
    return new InMemoryStoryViewsRepository();
  }

  const databaseName = process.env.MONGODB_DB_NAME && process.env.MONGODB_DB_NAME.trim().length > 0
    ? process.env.MONGODB_DB_NAME
    : 'hotspot';

  return new MongoStoryViewsRepository(mongoUrl, databaseName);
}

export interface StoriesComposition {
  service: StoriesService;
  repository: PostgresStoriesRepository;
}

export function buildStoriesComposition(db: QueryExecutor): StoriesComposition {
  const repository = new PostgresStoriesRepository(db);
  const storyViews = createStoryViewsPort();
  const service = new StoriesService(repository, storyViews);

  return { service, repository };
}
