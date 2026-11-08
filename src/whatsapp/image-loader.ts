import type { EvolutionClient } from "./evolution-client";

const MAX_CACHED = 150;

/**
 * Downloads chat images one at a time and keeps them in memory only (never in the vault,
 * so nothing reaches LiveSync). Oldest entries are dropped past MAX_CACHED.
 */
export class ImageLoader {
  private readonly cache = new Map<string, string>();
  private readonly pending = new Map<string, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly evolution: EvolutionClient) {}

  cached(messageId: string): string | undefined {
    return this.cache.get(messageId);
  }

  /** Data URL of the image; concurrent calls for the same message share one download. */
  load(messageId: string): Promise<string> {
    const hit = this.cache.get(messageId);
    if (hit) return Promise.resolve(hit);
    const running = this.pending.get(messageId);
    if (running) return running;

    const task = this.queue.then(async () => {
      const { base64, mimetype } = await this.evolution.mediaBase64(messageId);
      const url = base64.startsWith("data:") ? base64 : `data:${mimetype};base64,${base64}`;
      this.remember(messageId, url);
      return url;
    });
    this.queue = task.catch(() => undefined);
    this.pending.set(messageId, task);
    void task.finally(() => this.pending.delete(messageId)).catch(() => undefined);
    return task;
  }

  private remember(id: string, url: string): void {
    this.cache.set(id, url);
    while (this.cache.size > MAX_CACHED) this.cache.delete(this.cache.keys().next().value!);
  }
}
