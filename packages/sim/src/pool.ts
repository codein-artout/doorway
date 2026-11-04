// A small worker_threads pool. Workers run TypeScript through tsx's loader.

import { Worker } from 'node:worker_threads';
import os from 'node:os';
import type { ChunkResult, ChunkTask } from './chunk';
import { playChunk } from './chunk';

type Pending = { task: ChunkTask; resolve: (r: ChunkResult) => void; reject: (e: Error) => void };

export class Pool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Pending[] = [];
  private busy = new Map<Worker, Pending>();

  constructor(readonly size: number) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { execArgv: ['--import', 'tsx'] });
      w.on('message', (msg: { ok: boolean; id: string; result?: ChunkResult; error?: string }) => {
        const p = this.busy.get(w)!;
        this.busy.delete(w);
        if (msg.ok) p.resolve(msg.result!);
        else p.reject(new Error(msg.error));
        this.idle.push(w);
        this.pump();
      });
      w.on('error', (e) => {
        const p = this.busy.get(w);
        if (p) p.reject(e);
      });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  run(task: ChunkTask): Promise<ChunkResult> {
    if (this.size === 0) return Promise.resolve().then(() => playChunk(task));
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const p = this.queue.shift()!;
      this.busy.set(w, p);
      w.postMessage(p.task);
    }
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}

export const defaultWorkers = () => Math.max(1, Math.min(4, os.availableParallelism?.() ?? os.cpus().length));
