// Worker thread: plays a list of games and returns CSV rows + card aggregates.

import { parentPort } from 'node:worker_threads';
import { playChunk, type ChunkTask } from './chunk';

parentPort!.on('message', (task: ChunkTask) => {
  try {
    parentPort!.postMessage({ ok: true, id: task.id, result: playChunk(task) });
  } catch (e) {
    parentPort!.postMessage({ ok: false, id: task.id, error: (e as Error).stack ?? String(e) });
  }
});
