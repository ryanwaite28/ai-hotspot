export interface HotSpotApiConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
}

export class HotSpotApiClient {
  constructor(private readonly config: HotSpotApiConfig) {}

  private headers(): Record<string, string> {
    const token = this.config.getAccessToken();
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`HotSpot API GET ${path} failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HotSpot API POST ${path} failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}
