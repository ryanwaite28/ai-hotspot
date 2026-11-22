import { MongoClient, type Collection, type Document } from 'mongodb';

interface StoryViewDocument extends Document {
  story_id: string;
  owner_user_id: string;
  viewer_user_id: string;
  first_viewed_at: string;
  last_viewed_at: string;
  view_count: number;
}

interface StoryViewCollections {
  storyViews: Collection<StoryViewDocument>;
}

export interface StoryViewsPort {
  recordStoryView(input: {
    storyId: string;
    ownerUserId: string;
    viewerUserId: string;
  }): Promise<void>;
  listStoryViewers(input: {
    storyId: string;
    ownerUserId: string;
    limit: number;
  }): Promise<Array<{
    viewerUserId: string;
    firstViewedAt: string;
    lastViewedAt: string;
    viewCount: number;
  }>>;
  getStoryViewCount(input: {
    storyId: string;
    ownerUserId: string;
  }): Promise<number>;
}

export class MongoStoryViewsRepository implements StoryViewsPort {
  private mongoClient: MongoClient | null = null;

  private mongoCollectionsPromise: Promise<StoryViewCollections> | null = null;

  constructor(
    private readonly mongoUrl: string,
    private readonly databaseName: string,
  ) {}

  private async getCollections(): Promise<StoryViewCollections> {
    if (this.mongoCollectionsPromise) {
      return this.mongoCollectionsPromise;
    }

    this.mongoCollectionsPromise = (async () => {
      this.mongoClient = new MongoClient(this.mongoUrl);
      await this.mongoClient.connect();
      const db = this.mongoClient.db(this.databaseName);

      return {
        storyViews: db.collection<StoryViewDocument>('story_views'),
      };
    })();

    return this.mongoCollectionsPromise;
  }

  async recordStoryView(input: {
    storyId: string;
    ownerUserId: string;
    viewerUserId: string;
  }): Promise<void> {
    const collections = await this.getCollections();
    const nowIso = new Date().toISOString();

    await collections.storyViews.updateOne(
      {
        story_id: input.storyId,
        owner_user_id: input.ownerUserId,
        viewer_user_id: input.viewerUserId,
      },
      {
        $set: {
          last_viewed_at: nowIso,
        },
        $setOnInsert: {
          first_viewed_at: nowIso,
          view_count: 0,
        },
        $inc: {
          view_count: 1,
        },
      },
      { upsert: true },
    );
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
    const collections = await this.getCollections();

    const docs = await collections.storyViews
      .find({
        story_id: input.storyId,
        owner_user_id: input.ownerUserId,
      })
      .sort({ last_viewed_at: -1 })
      .limit(input.limit)
      .toArray();

    return docs.map((doc) => ({
      viewerUserId: doc.viewer_user_id,
      firstViewedAt: doc.first_viewed_at,
      lastViewedAt: doc.last_viewed_at,
      viewCount: doc.view_count,
    }));
  }

  async getStoryViewCount(input: {
    storyId: string;
    ownerUserId: string;
  }): Promise<number> {
    const collections = await this.getCollections();

    const aggregate = await collections.storyViews.aggregate<{ total: number }>([
      {
        $match: {
          story_id: input.storyId,
          owner_user_id: input.ownerUserId,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$view_count' },
        },
      },
    ]).toArray();

    if (aggregate.length === 0) {
      return 0;
    }

    return aggregate[0].total;
  }

  async close(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
      this.mongoCollectionsPromise = null;
    }
  }
}
