import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { renderWelcomeImage } from './render-canvas.js';

const log = createLogger('image');
const UPLOAD_PATH = /^uploads\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,140}$/;
const JOB_TIMEOUT_MS = 20000;

class ImagePool {
  constructor(size) {
    this.size = size;
    this.workers = [];
    this.queue = [];
    this.pending = new Map();
    this.sequence = 0;
    this.closed = false;
  }

  spawn() {
    const worker = new Worker(new URL('./image-worker.js', import.meta.url), {
      workerData: { uploadsDir: config.uploadsDir },
    });
    const handle = { worker, busy: false, current: null, dead: false };
    worker.on('message', (message) => this.onMessage(handle, message));
    worker.on('error', (error) => this.onWorkerFailure(handle, error));
    worker.on('exit', (code) => {
      if (code !== 0 && !this.closed) this.onWorkerFailure(handle, new Error(`Image worker exited with ${code}`));
    });
    this.workers.push(handle);
    return handle;
  }

  onMessage(handle, message) {
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    clearTimeout(entry.timer);
    handle.busy = false;
    handle.current = null;
    if (message.ok) entry.resolve(Buffer.from(message.buffer));
    else entry.reject(new Error(message.error || 'Image rendering failed.'));
    this.dispatch();
  }

  onWorkerFailure(handle, error) {
    if (handle.dead) return;
    handle.dead = true;
    this.workers = this.workers.filter((item) => item !== handle);
    if (handle.current) {
      const entry = this.pending.get(handle.current);
      if (entry) {
        this.pending.delete(handle.current);
        clearTimeout(entry.timer);
        entry.reject(error);
      }
    }
    handle.busy = false;
    try {
      handle.worker.terminate();
    } catch {
      /* ignore */
    }
    this.dispatch();
  }

  dispatch() {
    if (this.closed) return;
    while (this.queue.length) {
      let handle = this.workers.find((item) => !item.busy && !item.dead);
      if (!handle && this.workers.length < this.size) handle = this.spawn();
      if (!handle) return;
      const job = this.queue.shift();
      if (!job) return;
      this.run(handle, job);
    }
  }

  run(handle, job) {
    const id = ++this.sequence;
    handle.busy = true;
    handle.current = id;
    const timer = setTimeout(() => {
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      entry.reject(new Error('Image generation timed out.'));
      handle.worker.terminate();
    }, JOB_TIMEOUT_MS);
    this.pending.set(id, { ...job, timer });
    handle.worker.postMessage({ id, job: job.job });
  }

  generate(job) {
    if (this.closed) return Promise.reject(new Error('Image pool is closed.'));
    if (this.queue.length >= config.limits.imageQueue) {
      return Promise.reject(new Error('Image generation queue is full. Try again in a moment.'));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.dispatch();
    });
  }

  async close() {
    this.closed = true;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Image pool closed.'));
    }
    this.pending.clear();
    await Promise.all(this.workers.map((handle) => handle.worker.terminate()));
    this.workers = [];
  }
}

let pool = null;

function getPool() {
  if (!pool) pool = new ImagePool(config.imageWorkerCount);
  return pool;
}

export async function generateWelcomeImage(job) {
  try {
    return await getPool().generate(job);
  } catch (error) {
    log.warn('Falling back to in-process image rendering', { error: error.message });
    const data = { ...job.data };
    if (data.backgroundPath && UPLOAD_PATH.test(data.backgroundPath)) {
      data.backgroundPath = path.resolve(
        config.uploadsDir,
        data.backgroundPath.split('/').slice(1).join(path.sep),
      );
    } else {
      data.backgroundPath = null;
    }
    return renderWelcomeImage({ ...job, data });
  }
}

export async function shutdownImagePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
