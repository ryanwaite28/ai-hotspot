import { Client } from 'pg';

import { buildPostsComposition } from './posts.composition';

interface QueryExecutor {
  query<T>(sql: string, params: Array<string | number | boolean | null>): Promise<{ rows: T[] }>;
}

function createQueryExecutor(dbClient: Client): QueryExecutor {
  return {
    async query<T>(sql: string, params: Array<string | number | boolean | null>): Promise<{ rows: T[] }> {
      const result = await dbClient.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}

export interface RuntimePostsHarness {
  dbClient: Client;
  repository: ReturnType<typeof buildPostsComposition>['repository'];
  service: ReturnType<typeof buildPostsComposition>['service'];
  createActiveUser(input: {
    handle: string;
    email: string;
    displayName: string;
  }): Promise<{ id: string; handle: string; email: string }>;
  setFollowAccepted(input: {
    followerId: string;
    followingId: string;
  }): Promise<void>;
  setBlock(input: {
    blockerId: string;
    blockedId: string;
  }): Promise<void>;
  listOutboxEventTypesForPost(postId: string): Promise<string[]>;
}

export async function createRuntimePostsHarness(): Promise<RuntimePostsHarness> {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is required for runtime integration harness');
  }

  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  const composition = buildPostsComposition(createQueryExecutor(client));

  return {
    dbClient: client,
    ...composition,
    async createActiveUser(input: { handle: string; email: string; displayName: string }) {
      const result = await client.query<{
        id: string;
        handle: string;
        email: string;
      }>(
        `INSERT INTO users (handle, display_name, email, password_hash, status, role)
         VALUES ($1, $2, $3, $4, 'active', 'user')
         RETURNING id, handle, email`,
        [input.handle, input.displayName, input.email, 'runtime-hash'],
      );

      if (result.rows.length !== 1) {
        throw new Error('Failed to create runtime user');
      }

      return result.rows[0];
    },
    async setFollowAccepted(input: { followerId: string; followingId: string }) {
      await client.query(
        `INSERT INTO follows (follower_id, following_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (follower_id, following_id) DO UPDATE
         SET status = EXCLUDED.status, updated_at = NOW()`,
        [input.followerId, input.followingId],
      );
    },
    async setBlock(input: { blockerId: string; blockedId: string }) {
      await client.query(
        `INSERT INTO blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [input.blockerId, input.blockedId],
      );
    },
    async listOutboxEventTypesForPost(postId: string) {
      const rows = await client.query<{ event_type: string }>(
        `SELECT event_type
         FROM domain_event_outbox
         WHERE aggregate_type = 'post' AND aggregate_id = $1
         ORDER BY created_at ASC`,
        [postId],
      );

      return rows.rows.map((row: { event_type: string }) => row.event_type);
    },
  };
}

export async function destroyRuntimePostsHarness(harness: RuntimePostsHarness): Promise<void> {
  await harness.dbClient.end();
}
