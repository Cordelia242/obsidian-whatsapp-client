export interface HttpRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  json: unknown;
}

/** Port for HTTP calls. In Obsidian it is backed by `requestUrl`, which avoids CORS. */
export interface HttpPort {
  /** Must resolve for every HTTP status; only network failures reject. */
  request(req: HttpRequest): Promise<HttpResponse>;
}
