import React, { useEffect, useState } from 'react';
import {
  UploadCloud,
  DownloadCloud,
  Pause,
  Play,
  X,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getAllUploadTasks,
  pauseUpload,
  startOrResumeUpload,
  deleteUploadTask,
  ResumableUploadTask,
} from '../utils/resumableUploader';
import {
  getAllDownloadTasks,
  pauseDownload,
  startOrResumeDownload,
  deleteDownloadTask,
  ResumableDownloadTask,
} from '../utils/resumableDownloader';
import { formatBytes } from '../utils/db';
import { GameItem } from '../types/game';

export const TransferProgressTracker: React.FC = () => {
  const [uploadTasks, setUploadTasks] = useState<ResumableUploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<ResumableDownloadTask[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const refreshTasks = async () => {
    try {
      const [uploads, downloads] = await Promise.all([
        getAllUploadTasks(),
        getAllDownloadTasks(),
      ]);
      setUploadTasks(uploads);
      setDownloadTasks(downloads);
    } catch (e) {
      console.warn('Error refreshing transfer tasks:', e);
    }
  };

  useEffect(() => {
    refreshTasks();

    const handleUploadChange = () => refreshTasks();
    const handleDownloadChange = () => refreshTasks();
    const handleOnline = () => {
      setIsOnline(true);
      refreshTasks();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshTasks();
    };

    window.addEventListener('resumable_upload_changed', handleUploadChange);
    window.addEventListener('resumable_download_changed', handleDownloadChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll every 1 second when active
    const interval = setInterval(refreshTasks, 1000);

    return () => {
      window.removeEventListener('resumable_upload_changed', handleUploadChange);
      window.removeEventListener('resumable_download_changed', handleDownloadChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Filter tasks that need attention or are active
  const activeUploads = uploadTasks.filter(
    (t) => t.status === 'uploading' || t.status === 'paused' || t.status === 'retrying'
  );
  const activeDownloads = downloadTasks.filter(
    (t) => t.status === 'downloading' || t.status === 'paused' || t.status === 'failed'
  );

  const totalActive = activeUploads.length + activeDownloads.length;

  if (totalActive === 0) {
    return null;
  }

  const primaryUpload = activeUploads[0];
  const primaryDownload = activeDownloads[0];
  const primaryTask = primaryUpload || primaryDownload;
  const isUpload = Boolean(primaryUpload);

  const handlePauseUpload = async (id: string) => {
    await pauseUpload(id);
    refreshTasks();
  };

  const handleCancelUpload = async (id: string) => {
    await deleteUploadTask(id);
    refreshTasks();
  };

  const handlePauseDownload = async (id: string) => {
    await pauseDownload(id);
    refreshTasks();
  };

  const handleResumeDownload = async (task: ResumableDownloadTask) => {
    const dummyGame: GameItem = {
      id: task.gameId,
      title: task.title,
      filename: task.filename,
      fileType: task.fileType,
      fileSize: task.totalBytes,
      storageUrl: task.storageUrl,
      addedAt: task.startedAt,
      playCount: 0,
      category: 'Custom',
      accentGradient: 'from-indigo-600 to-purple-800',
      iconName: 'Gamepad2',
      iconDataUrl: task.iconDataUrl,
      htmlContent: '',
      downloadStatus: 'downloading',
      downloadProgress: task.progress,
    };
    await startOrResumeDownload(dummyGame);
    refreshTasks();
  };

  const handleCancelDownload = async (id: string) => {
    await deleteDownloadTask(id);
    refreshTasks();
  };

  return (
    <aside
      aria-label="Active File Transfers"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-[#111422]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 transition-all"
    >
      {/* Network Alert Strip if Offline */}
      {!isOnline && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-amber-300 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline: Transfers safely paused</span>
          </div>
          <span className="text-[10px] text-amber-200/80">Auto-resumes on reconnect</span>
        </div>
      )}

      {/* Main Header / Minimized Bar */}
      <div className="p-3 flex items-center justify-between gap-3 bg-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isUpload
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isUpload ? (
              <UploadCloud className="w-4 h-4 animate-bounce" />
            ) : (
              <DownloadCloud className="w-4 h-4 animate-bounce" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{isUpload ? 'Supabase Upload' : 'Supabase Download'}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[9px] text-slate-300 font-mono">
                {totalActive} {totalActive === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {primaryTask.title || primaryTask.filename}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
          {/* Active Uploads */}
          {activeUploads.map((task) => (
            <div
              key={task.id}
              className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="font-semibold text-white truncate max-w-[200px] flex items-center gap-1.5">
                  <span className="truncate">{task.title}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 uppercase">
                    {task.fileType}
                  </span>
                </div>
                <div className="font-mono text-indigo-400 font-bold text-xs">
                  {task.progress}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    task.status === 'paused'
                      ? 'bg-amber-400'
                      : task.status === 'retrying'
                      ? 'bg-orange-500 animate-pulse'
                      : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                  }`}
                  style={{ width: `${Math.max(4, task.progress)}%` }}
                />
              </div>

              {/* Meta & Status */}
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>{formatBytes(task.fileSize)}</span>
                  <span>·</span>
                  <span className="font-mono text-indigo-300">{task.speed}</span>
                </div>
                <div className="flex items-center gap-1">
                  {task.status === 'paused' ? (
                    <span className="text-amber-400 font-medium">Paused</span>
                  ) : task.status === 'retrying' ? (
                    <span className="text-orange-400 font-medium">Reconnecting...</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Uploading</span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/5">
                {task.status === 'uploading' ? (
                  <button
                    onClick={() => handlePauseUpload(task.id)}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    disabled={!isOnline}
                    className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>{isOnline ? 'Auto-resuming' : 'Waiting for connection'}</span>
                  </button>
                )}
                <button
                  onClick={() => handleCancelUpload(task.id)}
                  className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          ))}

          {/* Active Downloads */}
          {activeDownloads.map((task) => (
            <div
              key={task.id}
              className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="font-semibold text-white truncate max-w-[200px] flex items-center gap-1.5">
                  <span className="truncate">{task.title}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                    {task.fileType}
                  </span>
                </div>
                <div className="font-mono text-emerald-400 font-bold text-xs">
                  {task.progress}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    task.status === 'paused'
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${Math.max(4, task.progress)}%` }}
                />
              </div>

              {/* Meta & Status */}
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>
                    {formatBytes(task.receivedBytes)} / {formatBytes(task.totalBytes)}
                  </span>
                  <span>·</span>
                  <span className="font-mono text-emerald-300">{task.speed}</span>
                </div>
                <div className="flex items-center gap-1">
                  {task.status === 'paused' ? (
                    <span className="text-amber-400 font-medium">Paused</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Downloading</span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/5">
                {task.status === 'downloading' ? (
                  <button
                    onClick={() => handlePauseDownload(task.id)}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleResumeDownload(task)}
                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Resume</span>
                  </button>
                )}
                <button
                  onClick={() => handleCancelDownload(task.id)}
                  className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
