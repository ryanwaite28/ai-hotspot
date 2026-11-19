import { Client } from 'pg';

import { buildMediaComposition } from './media.composition';

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

export interface RuntimeMediaHarness {
  dbClient: Client;
  handler: ReturnType<typeof buildMediaComposition>['handler'];
  service: ReturnType<typeof buildMediaComposition>['service'];
  repository: ReturnType<typeof buildMediaComposition>['repository'];
  createActiveUser(input: {
    handle: string;
    email: string;
    displayName: string;
  }): Promise<{ id: string; handle: string; email: string }>;
  listOutboxEventTypesForMedia(mediaAssetId: string): Promise<string[]>;
}

export async function createRuntimeMediaHarness(): Promise<RuntimeMediaHarness> {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is required for runtime integration harness');
  }

  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  const composition = buildMediaComposition(createQueryExecutor(client));

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
    async listOutboxEventTypesForMedia(mediaAssetId: string) {
      const rows = await client.query<{ event_type: string }>(
        `SELECT event_type
         FROM domain_event_outbox
         WHERE aggregate_type = 'media_asset' AND aggregate_id = $1
         ORDER BY created_at ASC`,
        [mediaAssetId],
      );

      return rows.rows.map((row: { event_type: string }) => row.event_type);
    },
  };
}

export async function destroyRuntimeMediaHarness(harness: RuntimeMediaHarness): Promise<void> {
  await harness.dbClient.end();
}
