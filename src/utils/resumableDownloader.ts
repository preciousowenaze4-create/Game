/**
 * Resumable & Persistent File Downloader Engine
 * 
 * Uses IndexedDB to store downloaded chunks and download task states.
 * Supports:
 * - Chunked Range requests (Range: bytes=start-end)
 * - Pause and Resume without losing downloaded data
 * - Persistence across tab minimize, reload, or device lock
 * - Real-time progress, speed, and chunk assembly
 */

import { GameFileType, GameItem } from '../types/game';

export interface ResumableDownloadTask {
  id: string;
  gameId: string;
  title: string;
  filename: string;
  fileType: GameFileType;
  iconDataUrl?: string;
  storageUrl: string;
  totalBytes: number;
  receivedBytes: number;
  progress: number; // 0 to 100
  status: 'downloading' | 'paused' | 'completed' | 'failed';
  totalChunks: number;
  completedChunks: number[];
  chunkSize: number;
  speed: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

const DB_NAME = 'ResumableDownloadsDB';
const DB_VERSION = 1;
const STORE_TASKS = 'tasks';
const STORE_CHUNKS = 'chunks';
const DEFAULT_CHUNK_SIZE = 512 * 1024; // 512 KB per chunk for robust pausing/resuming

// In-memory active abort controllers
const activeControllers = new Map<string, AbortController>();

function openDownloadDB(): Promise<IDBDatabase> {
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
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        // Compound key: [taskId, chunkIndex]
        db.createObjectStore(STORE_CHUNKS, { keyPath: ['taskId', 'chunkIndex'] });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function broadcastUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('resumable_download_changed'));
  }
}

/**
 * Save or update a download task metadata in IndexedDB
 */
export async function saveDownloadTask(task: ResumableDownloadTask): Promise<void> {
  try {
    const db = await openDownloadDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TASKS, 'readwrite');
      tx.objectStore(STORE_TASKS).put(task);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    broadcastUpdate();
  } catch (err) {
    console.warn('Failed to save download task:', err);
  }
}

/**
 * Get all download tasks from IndexedDB
 */
export async function getAllDownloadTasks(): Promise<ResumableDownloadTask[]> {
  try {
    const db = await openDownloadDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TASKS, 'readonly');
      const req = tx.objectStore(STORE_TASKS).getAll();
      req.onsuccess = () => {
        const tasks = (req.result as ResumableDownloadTask[]) || [];
        resolve(tasks.sort((a, b) => b.updatedAt - a.updatedAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load download tasks:', err);
    return [];
  }
}

/**
 * Save an individual chunk to IndexedDB
 */
async function saveChunk(taskId: string, chunkIndex: number, data: ArrayBuffer): Promise<void> {
  const db = await openDownloadDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    tx.objectStore(STORE_CHUNKS).put({ taskId, chunkIndex, data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all chunks for a task
 */
async function getAllChunksForTask(taskId: string): Promise<{ chunkIndex: number; data: ArrayBuffer }[]> {
  const db = await openDownloadDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, 'readonly');
    const store = tx.objectStore(STORE_CHUNKS);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as { taskId: string; chunkIndex: number; data: ArrayBuffer }[];
      const filtered = all
        .filter((c) => c.taskId === taskId)
        .sort((a, b) => a.chunkIndex - b.chunkIndex);
      resolve(filtered);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete all chunks and task record for a task
 */
export async function deleteDownloadTask(taskId: string): Promise<void> {
  // Abort running controller if any
  const controller = activeControllers.get(taskId);
  if (controller) {
    controller.abort();
    activeControllers.delete(taskId);
  }

  try {
    const db = await openDownloadDB();
    const tx = db.transaction([STORE_TASKS, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_TASKS).delete(taskId);

    // Delete chunks
    const chunksStore = tx.objectStore(STORE_CHUNKS);
    const req = chunksStore.getAll();
    req.onsuccess = () => {
      const all = req.result as { taskId: string; chunkIndex: number }[];
      all.filter((c) => c.taskId === taskId).forEach((c) => chunksStore.delete([taskId, c.chunkIndex]));
    };

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    broadcastUpdate();
  } catch (err) {
    console.warn('Failed to delete download task:', err);
  }
}

/**
 * Pause an active download
 */
export async function pauseDownload(taskId: string): Promise<void> {
  const controller = activeControllers.get(taskId);
  if (controller) {
    controller.abort();
    activeControllers.delete(taskId);
  }

  const tasks = await getAllDownloadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (task && task.status === 'downloading') {
    task.status = 'paused';
    task.speed = 'Paused';
    task.updatedAt = Date.now();
    await saveDownloadTask(task);
  }
}

/**
 * Start or resume a persistent download
 */
export async function startOrResumeDownload(
  game: GameItem,
  onComplete?: (blobUrl: string, filename: string) => void
): Promise<void> {
  const taskId = `dl-${game.id}`;
  const tasks = await getAllDownloadTasks();
  let task = tasks.find((t) => t.id === taskId);

  // If already downloading, ignore
  if (task && task.status === 'downloading' && activeControllers.has(taskId)) {
    return;
  }

  const targetUrl = game.storageUrl?.startsWith('http')
    ? `/api/games/${game.id}/download?proxy=true`
    : `/api/games/${game.id}/download`;

  let totalBytes = game.fileSize || 0;
  let chunkSize = DEFAULT_CHUNK_SIZE;

  // If new task or never initialized, probe file size
  if (!task || task.totalBytes === 0) {
    try {
      const headRes = await fetch(targetUrl, { method: 'HEAD' });
      const lenHeader = headRes.headers.get('content-length');
      if (lenHeader) {
        totalBytes = parseInt(lenHeader, 10);
      }
    } catch {
      // Keep game.fileSize fallback
    }

    if (totalBytes <= 0) {
      totalBytes = 2 * 1024 * 1024; // Fallback estimate
    }

    const totalChunks = Math.max(1, Math.ceil(totalBytes / chunkSize));

    task = {
      id: taskId,
      gameId: game.id,
      title: game.title,
      filename: game.filename,
      fileType: game.fileType,
      iconDataUrl: game.iconDataUrl,
      storageUrl: game.storageUrl || targetUrl,
      totalBytes,
      receivedBytes: 0,
      progress: 0,
      status: 'downloading',
      totalChunks,
      completedChunks: [],
      chunkSize,
      speed: 'Starting...',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  } else {
    // Resume existing task
    task.status = 'downloading';
    task.speed = 'Resuming...';
    task.updatedAt = Date.now();
  }

  await saveDownloadTask(task);

  const controller = new AbortController();
  activeControllers.set(taskId, controller);

  // Run chunk downloader in background
  runChunkDownloader(task, targetUrl, controller, onComplete);
}

/**
 * Core chunk loop: requests each pending chunk with Range headers,
 * stores it to IndexedDB, and monitors speed/progress.
 */
async function runChunkDownloader(
  task: ResumableDownloadTask,
  targetUrl: string,
  controller: AbortController,
  onComplete?: (blobUrl: string, filename: string) => void
) {
  const taskId = task.id;
  let lastBytes = task.receivedBytes;
  let lastTime = Date.now();

  try {
    const existingChunks = await getAllChunksForTask(taskId);
    const completedSet = new Set(existingChunks.map((c) => c.chunkIndex));
    task.completedChunks = Array.from(completedSet);
    task.receivedBytes = existingChunks.reduce((acc, c) => acc + c.data.byteLength, 0);
    task.progress = Math.min(99, Math.round((task.receivedBytes / task.totalBytes) * 100));
    await saveDownloadTask(task);

    // Download missing chunks one by one
    for (let i = 0; i < task.totalChunks; i++) {
      if (completedSet.has(i)) {
        continue;
      }

      if (controller.signal.aborted) {
        return;
      }

      const start = i * task.chunkSize;
      const end = Math.min(task.totalBytes - 1, (i + 1) * task.chunkSize - 1);

      // Fetch chunk using Range header with retry
      let chunkBuffer: ArrayBuffer | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (controller.signal.aborted) return;

        // If offline, pause safely
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          task.status = 'paused';
          task.speed = 'Offline (Paused)';
          task.updatedAt = Date.now();
          await saveDownloadTask(task);
          return;
        }

        try {
          const response = await fetch(targetUrl, {
            headers: {
              Range: `bytes=${start}-${end}`,
            },
            signal: controller.signal,
          });

          if (!response.ok && response.status !== 206) {
            if (response.status === 200 && i === 0) {
              const fullBuffer = await response.arrayBuffer();
              await saveChunk(taskId, 0, fullBuffer);
              task.totalChunks = 1;
              task.completedChunks = [0];
              task.receivedBytes = fullBuffer.byteLength;
              task.totalBytes = fullBuffer.byteLength;
              chunkBuffer = fullBuffer;
              break;
            }
            throw new Error(`HTTP ${response.status}`);
          }

          chunkBuffer = await response.arrayBuffer();
          break;
        } catch (fetchErr: any) {
          if (controller.signal.aborted) return;
          if (attempt === 3) throw fetchErr;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      if (!chunkBuffer) {
        throw new Error(`Chunk ${i} failed after 3 attempts`);
      }

      await saveChunk(taskId, i, chunkBuffer);

      completedSet.add(i);
      task.completedChunks = Array.from(completedSet);
      task.receivedBytes += chunkBuffer.byteLength;
      task.progress = Math.min(100, Math.round((task.receivedBytes / task.totalBytes) * 100));

      // Calculate speed
      const now = Date.now();
      const elapsedSec = (now - lastTime) / 1000;
      if (elapsedSec >= 0.6) {
        const diffBytes = task.receivedBytes - lastBytes;
        const bytesPerSec = diffBytes / elapsedSec;
        if (bytesPerSec > 1024 * 1024) {
          task.speed = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
        } else {
          task.speed = `${Math.round(bytesPerSec / 1024)} KB/s`;
        }
        lastBytes = task.receivedBytes;
        lastTime = now;
      }

      task.updatedAt = now;
      await saveDownloadTask(task);
    }

    // All chunks downloaded! Assemble final blob
    const allChunks = await getAllChunksForTask(taskId);
    const blobParts = allChunks.map((c) => c.data);
    const finalBlob = new Blob(blobParts, { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(finalBlob);

    task.status = 'completed';
    task.progress = 100;
    task.speed = 'Done';
    task.updatedAt = Date.now();
    await saveDownloadTask(task);
    activeControllers.delete(taskId);

    // Trigger auto-download or callback
    if (onComplete) {
      onComplete(blobUrl, task.filename);
    } else {
      triggerBrowserDownload(blobUrl, task.filename);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log(`[Resumable Download] Paused task ${taskId}`);
      return;
    }
    console.error(`[Resumable Download] Error on task ${taskId}:`, err);
    task.status = 'failed';
    task.error = err?.message || 'Download error. Please resume.';
    task.speed = 'Paused';
    task.updatedAt = Date.now();
    await saveDownloadTask(task);
    activeControllers.delete(taskId);
  }
}

/**
 * Triggers a browser file download anchor
 */
export function triggerBrowserDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Global Network & Visibility Watcher for Downloads
if (typeof window !== 'undefined') {
  // Auto-resume paused downloads on reconnect
  window.addEventListener('online', async () => {
    console.log('[ResumableDownloader] Network back online. Auto-resuming active downloads...');
    const tasks = await getAllDownloadTasks();
    for (const t of tasks) {
      if (t.status === 'paused' || t.status === 'failed') {
        const dummyGame: GameItem = {
          id: t.gameId,
          title: t.title,
          filename: t.filename,
          fileType: t.fileType,
          fileSize: t.totalBytes,
          storageUrl: t.storageUrl,
          addedAt: t.startedAt,
          playCount: 0,
          category: 'Custom',
          accentGradient: 'from-indigo-600 to-purple-800',
          iconName: 'Gamepad2',
          iconDataUrl: t.iconDataUrl,
          htmlContent: '',
          downloadStatus: 'downloading',
          downloadProgress: t.progress,
        };
        startOrResumeDownload(dummyGame);
      }
    }
  });

  // Safe pause on offline
  window.addEventListener('offline', async () => {
    console.log('[ResumableDownloader] Network offline. Pausing downloads safely...');
    for (const [taskId] of activeControllers) {
      pauseDownload(taskId);
    }
  });

  // App minimized or phone locked handler
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const tasks = await getAllDownloadTasks();
      for (const t of tasks) {
        if (t.status === 'downloading' && !activeControllers.has(t.id)) {
          const dummyGame: GameItem = {
            id: t.gameId,
            title: t.title,
            filename: t.filename,
            fileType: t.fileType,
            fileSize: t.totalBytes,
            storageUrl: t.storageUrl,
            addedAt: t.startedAt,
            playCount: 0,
            category: 'Custom',
            accentGradient: 'from-indigo-600 to-purple-800',
            iconName: 'Gamepad2',
            iconDataUrl: t.iconDataUrl,
            htmlContent: '',
            downloadStatus: 'downloading',
            downloadProgress: t.progress,
          };
          startOrResumeDownload(dummyGame);
        }
      }
    }
  });
}

