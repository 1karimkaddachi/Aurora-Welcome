import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import { renderWelcomeImage } from './render-canvas.js';

const uploadsDir = workerData?.uploadsDir || path.join(process.cwd(), 'data', 'uploads');
const UPLOAD_PATH = /^uploads\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,140}$/;

function resolveBackground(relative) {
  if (!relative || !UPLOAD_PATH.test(relative)) return null;
  const relativeToUploads = relative.split('/').slice(1).join(path.sep);
  const absolute = path.resolve(uploadsDir, relativeToUploads);
  if (!absolute.startsWith(path.resolve(uploadsDir))) return null;
  return absolute;
}

parentPort.on('message', async (message) => {
  const { id, job } = message;
  try {
    const buffer = await renderWelcomeImage({
      ...job,
      data: {
        ...job.data,
        backgroundPath: resolveBackground(job.data?.backgroundPath),
      },
    });
    const bytes = new Uint8Array(buffer);
    parentPort.postMessage({ id, ok: true, buffer: bytes }, [bytes.buffer]);
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: error.message });
  }
});
