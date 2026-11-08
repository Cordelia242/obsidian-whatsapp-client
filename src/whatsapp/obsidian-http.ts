import { requestUrl } from "obsidian";
import type { HttpPort, HttpRequest, HttpResponse } from "./http-port";

/** HttpPort over Obsidian's `requestUrl`, which bypasses browser CORS on desktop and mobile. */
export class ObsidianHttp implements HttpPort {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const response = await requestUrl({
      url: req.url,
      method: req.method,
      headers: { ...req.headers, ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      throw: false,
    });
    let json: unknown = null;
    try {
      json = response.json;
    } catch {
      json = { message: response.text };
    }
    return { status: response.status, json };
  }
}
