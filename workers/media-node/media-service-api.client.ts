import type { UpdateMediaProcessingStatusInput } from '../../packages/contracts/src';

export interface MediaServiceApiClientConfig {
  baseUrl: string;
  authToken?: string;
  processingStatusPathTemplate?: string;
}

export class MediaServiceApiClient {
  private readonly baseUrl: string;

  private readonly authToken: string | null;

  private readonly processingStatusPathTemplate: string;

  constructor(config: MediaServiceApiClientConfig) {
    if (!config.baseUrl || config.baseUrl.trim().length === 0) {
      throw new Error('MediaServiceApiClient baseUrl is required');
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.authToken = config.authToken && config.authToken.trim().length > 0 ? config.authToken : null;
    this.processingStatusPathTemplate = config.processingStatusPathTemplate ?? '/internal/v1/media/{mediaAssetId}/processing-status';
  }

  private buildProcessingStatusUrl(mediaAssetId: string): string {
    const path = this.processingStatusPathTemplate.replace('{mediaAssetId}', encodeURIComponent(mediaAssetId));
    return `${this.baseUrl}${path}`;
  }

  async updateProcessingStatus(input: UpdateMediaProcessingStatusInput): Promise<void> {
    const requestBody = {
      processingStatus: input.processingStatus,
      eventSource: input.eventSource,
    };

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (this.authToken) {
      headers.authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(this.buildProcessingStatusUrl(input.mediaAssetId), {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Media API updateProcessingStatus failed with ${response.status}: ${responseText}`);
    }
  }
}
