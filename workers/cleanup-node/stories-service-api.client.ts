import type { ExpireStoriesResult } from '../../packages/contracts/src';

export interface StoriesServiceApiClientConfig {
  baseUrl: string;
  authToken?: string;
  expirePath?: string;
}

export interface ExpireStoriesByWorkerInput {
  limit?: number;
}

export class StoriesServiceApiClient {
  private readonly baseUrl: string;

  private readonly authToken: string | null;

  private readonly expirePath: string;

  constructor(config: StoriesServiceApiClientConfig) {
    if (!config.baseUrl || config.baseUrl.trim().length === 0) {
      throw new Error('StoriesServiceApiClient baseUrl is required');
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.authToken = config.authToken && config.authToken.trim().length > 0 ? config.authToken : null;
    this.expirePath = config.expirePath ?? '/internal/v1/stories/expire';
  }

  async expireStoriesByWorker(input: ExpireStoriesByWorkerInput = {}): Promise<ExpireStoriesResult> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (this.authToken) {
      headers.authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${this.expirePath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        eventSource: 'worker',
        limit: input.limit,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Stories API expireStories failed with ${response.status}: ${responseText}`);
    }

    const data = await response.json() as ExpireStoriesResult;
    return {
      expiredCount: data.expiredCount,
      storyIds: data.storyIds,
    };
  }
}
