/**
 * Resumable & Network-Resilient File Uploader Engine
 *
 * Slices large files (APK, IPA, HTML, Images, 3D Models) into chunks (512 KB).
 * Features:
 * - Chunked resumable uploading to backend & Supabase Storage
 * - Survives tab minimize, phone lock, and network disconnects
 * - Auto-pauses safely when offline without cancelling or failing
 * - Auto-resumes from exact chunk when internet reconnects
 * - Exponential backoff retry on transient network glitches
 * - IndexedDB / state persistence for queue and progress
 */

import { GameFileType, GameItem } from '../types/game';

export interface ResumableUploadTask {
  id: string;
  filename: string;
  fileSize: number;
  fileType: GameFileType;
  title: string;
  iconDataUrl?: string;
  totalChunks: number;
  uploadedChunks: number[];
  progress: number; // 0 to 100
  status: 'uploading' | 'paused' | 'retrying' | 'completed' | 'failed';
  statusText: string;
  speed: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
  targetBucket: string;
  storageUrl?: string;
}

const CHUNK_SIZE = 512 * 1024; // 512 KB chunks for smooth progress & high reliability
const DB_NAME = 'ResumableUploadsDB';
const DB_VERSION = 1;
const STORE_TASKS = 'upload_tasks';

// In-memory active controllers & files for running tasks
const activeAbortControllers = new Map<string, AbortController>();
const activeFiles = new Map<string, File>();
const activeTasks = new Map<string, ResumableUploadTask>();

function openUploadDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function broadcastUploadUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('resumable_upload_changed'));
  }
}

/**
 * Save upload task state to IndexedDB
 */
export async function saveUploadTask(task: ResumableUploadTask): Promise<void> {
  activeTasks.set(task.id, task);
  try {
    const db = await openUploadDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TASKS, 'readwrite');
      tx.objectStore(STORE_TASKS).put(task);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save upload task in DB:', e);
  }
  broadcastUploadUpdate();
}

/**
 * Get all active or paused upload tasks
 */
export async function getAllUploadTasks(): Promise<ResumableUploadTask[]> {
  try {
    const db = await openUploadDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TASKS, 'readonly');
      const req = tx.objectStore(STORE_TASKS).getAll();
      req.onsuccess = () => {
        const tasks = (req.result as ResumableUploadTask[]) || [];
        // Merge with in-memory active tasks
        for (const t of tasks) {
          if (activeTasks.has(t.id)) {
            const memoryTask = activeTasks.get(t.id)!;
            Object.assign(t, memoryTask);
          }
        }
        resolve(tasks.sort((a, b) => b.updatedAt - a.updatedAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(activeTasks.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

/**
 * Delete an upload task
 */
export async function deleteUploadTask(taskId: string): Promise<void> {
  const ctrl = activeAbortControllers.get(taskId);
  if (ctrl) {
    ctrl.abort();
    activeAbortControllers.delete(taskId);
  }
  activeFiles.delete(taskId);
  activeTasks.delete(taskId);

  try {
    const db = await openUploadDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TASKS, 'readwrite');
      tx.objectStore(STORE_TASKS).delete(taskId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
  broadcastUploadUpdate();
}

/**
 * Pause an in-flight upload task safely
 */
export async function pauseUpload(taskId: string): Promise<void> {
  const ctrl = activeAbortControllers.get(taskId);
  if (ctrl) {
    ctrl.abort();
    activeAbortControllers.delete(taskId);
  }
  const task = activeTasks.get(taskId);
  if (task && task.status !== 'completed') {
    task.status = 'paused';
    task.statusText = 'Upload paused by user';
    task.speed = '0 KB/s';
    task.updatedAt = Date.now();
    await saveUploadTask(task);
  }
}

/**
 * Helper to upload a single chunk with automatic retry
 */
async function uploadChunkWithRetry(
  uploadId: string,
  chunkIndex: number,
  chunkBlob: Blob,
  signal: AbortSignal,
  maxRetries = 4
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal.aborted) return false;

    try {
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('chunk', chunkBlob, `chunk_${chunkIndex}.bin`);

      const res = await fetch('/api/upload/chunk', {
        method: 'POST',
        body: formData,
        signal,
      });

      if (res.ok) {
        return true;
      }
      throw new Error(`HTTP error ${res.status}`);
    } catch (err: any) {
      if (signal.aborted) return false;
      console.warn(`Chunk ${chunkIndex} upload attempt ${attempt} failed:`, err?.message);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1200));
      }
    }
  }
  return false;
}

/**
 * Start or resume a chunked upload
 */
export async function startOrResumeUpload(
  file: File,
  meta: {
    id: string;
    title: string;
    fileType: GameFileType;
    iconDataUrl?: string;
    htmlContent?: string;
    packageName?: string;
    versionName?: string;
  },
  onComplete?: (game: GameItem) => void,
  onError?: (err: Error) => void
): Promise<ResumableUploadTask> {
  const taskId = meta.id;
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  activeFiles.set(taskId, file);

  let task = activeTasks.get(taskId);
  if (!task) {
    task = {
      id: taskId,
      filename: file.name,
      fileSize: file.size,
      fileType: meta.fileType,
      title: meta.title,
      iconDataUrl: meta.iconDataUrl,
      totalChunks,
      uploadedChunks: [],
      progress: 0,
      status: 'uploading',
      statusText: 'Initializing upload to Supabase...',
      speed: '0 KB/s',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      targetBucket: 'game-files',
    };
  } else {
    task.status = 'uploading';
    task.statusText = 'Resuming upload...';
    task.error = undefined;
    task.updatedAt = Date.now();
  }

  await saveUploadTask(task);

  const abortCtrl = new AbortController();
  activeAbortControllers.set(taskId, abortCtrl);

  (async () => {
    try {
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: taskId,
          filename: file.name,
          fileSize: file.size,
          fileType: meta.fileType,
          totalChunks,
          title: meta.title,
          iconDataUrl: meta.iconDataUrl,
          htmlContent: meta.htmlContent,
          packageName: meta.packageName,
          versionName: meta.versionName,
        }),
        signal: abortCtrl.signal,
      });

      if (!initRes.ok) {
        throw new Error('Failed to initialize upload session on server');
      }

      const initData = await initRes.json();
      const alreadyUploaded = new Set<number>(initData.receivedChunks || task.uploadedChunks || []);
      task.uploadedChunks = Array.from(alreadyUploaded);

      let bytesUploaded = task.uploadedChunks.length * CHUNK_SIZE;
      let lastTime = Date.now();
      let lastBytes = bytesUploaded;

      for (let i = 0; i < totalChunks; i++) {
        if (abortCtrl.signal.aborted) {
          return;
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          task.status = 'paused';
          task.statusText = 'Waiting for network connection... (Paused safely)';
          task.speed = '0 KB/s';
          task.updatedAt = Date.now();
          await saveUploadTask(task);
          return;
        }

        if (alreadyUploaded.has(i)) {
          continue;
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        task.status = 'uploading';
        task.statusText = `Uploading chunk ${i + 1}/${totalChunks} to Supabase...`;
        await saveUploadTask(task);

        const success = await uploadChunkWithRetry(taskId, i, chunkBlob, abortCtrl.signal);

        if (!success) {
          if (abortCtrl.signal.aborted) return;

          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            task.status = 'paused';
            task.statusText = 'Connection dropped. Waiting to reconnect...';
            task.speed = '0 KB/s';
            task.updatedAt = Date.now();
            await saveUploadTask(task);
            return;
          }

          task.status = 'retrying';
          task.statusText = `Chunk ${i + 1} retrying... connection unstable`;
          await saveUploadTask(task);
          await new Promise((r) => setTimeout(r, 2000));
          const retryOk = await uploadChunkWithRetry(taskId, i, chunkBlob, abortCtrl.signal);
          if (!retryOk) {
            throw new Error(`Upload stalled at chunk ${i + 1}. You can tap Resume.`);
          }
        }

        alreadyUploaded.add(i);
        task.uploadedChunks = Array.from(alreadyUploaded);
        bytesUploaded = Math.min(file.size, alreadyUploaded.size * CHUNK_SIZE);

        const now = Date.now();
        const elapsedSec = (now - lastTime) / 1000;
        if (elapsedSec >= 0.8) {
          const deltaBytes = bytesUploaded - lastBytes;
          const bytesPerSec = deltaBytes / elapsedSec;
          if (bytesPerSec > 1024 * 1024) {
            task.speed = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
          } else {
            task.speed = `${Math.round(bytesPerSec / 1024)} KB/s`;
          }
          lastTime = now;
          lastBytes = bytesUploaded;
        }

        task.progress = Math.min(99, Math.round((alreadyUploaded.size / totalChunks) * 100));
        task.updatedAt = Date.now();
        await saveUploadTask(task);
      }

      task.statusText = 'Finalizing & saving to Supabase Storage...';
      task.progress = 99;
      await saveUploadTask(task);

      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: taskId }),
        signal: abortCtrl.signal,
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to finalize Supabase upload');
      }

      const completeData = await completeRes.json();
      const storageUrl = completeData.game?.storageUrl || `/api/games/${taskId}/download`;

      task.status = 'completed';
      task.statusText = 'Upload completed & stored in Supabase!';
      task.progress = 100;
      task.speed = 'Done';
      task.storageUrl = storageUrl;
      task.updatedAt = Date.now();
      await saveUploadTask(task);

      activeAbortControllers.delete(taskId);

      if (completeData.game) {
        onComplete?.(completeData.game);
      }
    } catch (err: any) {
      if (abortCtrl.signal.aborted) return;
      console.error('Resumable upload error:', err);
      task.status = 'failed';
      task.error = err?.message || 'Transfer interrupted';
      task.statusText = `Interrupted: ${task.error}. Tap Resume to continue.`;
      task.speed = '0 KB/s';
      task.updatedAt = Date.now();
      await saveUploadTask(task);
      onError?.(err);
    }
  })();

  return task;
}

// Global Network & Visibility Watcher
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[ResumableTransfer] Online event fired. Auto-resuming paused uploads...');
    const tasks = await getAllUploadTasks();
    for (const t of tasks) {
      if (t.status === 'paused' || t.status === 'retrying' || (t.status === 'failed' && t.uploadedChunks.length > 0)) {
        const file = activeFiles.get(t.id);
        if (file) {
          startOrResumeUpload(file, {
            id: t.id,
            title: t.title,
            fileType: t.fileType,
            iconDataUrl: t.iconDataUrl,
          });
        }
      }
    }
  });

  window.addEventListener('offline', async () => {
    console.log('[ResumableTransfer] Offline event detected. Pausing active uploads safely...');
    for (const [taskId] of activeAbortControllers) {
      const task = activeTasks.get(taskId);
      if (task && task.status === 'uploading') {
        pauseUpload(taskId);
      }
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const tasks = await getAllUploadTasks();
      for (const t of tasks) {
        if (t.status === 'uploading' && !activeAbortControllers.has(t.id)) {
          const file = activeFiles.get(t.id);
          if (file) {
            startOrResumeUpload(file, {
              id: t.id,
              title: t.title,
              fileType: t.fileType,
              iconDataUrl: t.iconDataUrl,
            });
          }
        }
      }
    }
  });
}
