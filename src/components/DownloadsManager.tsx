import React, { useEffect, useState } from 'react';
import {
  Download,
  Play,
  CheckCircle2,
  Trash2,
  Smartphone,
  FileCode2,
  Info,
  Image as ImageIcon,
  Apple,
  Box,
  Pause,
  PlayCircle,
  RotateCcw,
  Clock,
  Sparkles,
  Layers,
  ArrowDownCircle,
  HardDriveDownload,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { formatBytes } from '../utils/db';
import {
  getAllDownloadTasks,
  pauseDownload,
  startOrResumeDownload,
  deleteDownloadTask,
  ResumableDownloadTask,
  triggerBrowserDownload,
} from '../utils/resumableDownloader';
import {
  getAllUploadTasks,
  pauseUpload,
  deleteUploadTask,
  ResumableUploadTask,
} from '../utils/resumableUploader';

interface DownloadsManagerProps {
  games: GameItem[];
  onPlay: (game: GameItem) => void;
  onDelete: (id: string, title: string) => void;
  onGameInstalled?: (game: GameItem) => void;
}

export const DownloadsManager: React.FC<DownloadsManagerProps> = ({
  games,
  onPlay,
  onDelete,
}) => {
  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);
  const [downloadTasks, setDownloadTasks] = useState<ResumableDownloadTask[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'library'>('tasks');

  // Load and listen for resumable download updates
  useEffect(() => {
    async function loadTasks() {
      const tasks = await getAllDownloadTasks();
      setDownloadTasks(tasks);
    }
    loadTasks();

    const handleUpdate = () => {
      loadTasks();
    };

    window.addEventListener('resumable_download_changed', handleUpdate);
    const interval = setInterval(loadTasks, 1500);

    return () => {
      window.removeEventListener('resumable_download_changed', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const downloadedItems = games.filter(
    (g) =>
      g.downloadStatus === 'ready' ||
      g.fileType === 'apk' ||
      g.fileType === 'ipa' ||
      g.fileType === 'picture' ||
      g.fileType === 'html' ||
      g.fileType === '3d'
  );

  const handlePause = async (taskId: string) => {
    await pauseDownload(taskId);
  };

  const handleResume = async (task: ResumableDownloadTask) => {
    const game = games.find((g) => g.id === task.gameId) || {
      id: task.gameId,
      title: task.title,
      filename: task.filename,
      fileType: task.fileType,
      fileSize: task.totalBytes,
      storageUrl: task.storageUrl,
      addedAt: Date.now(),
      playCount: 0,
      category: 'Custom',
      accentGradient: 'from-indigo-600 to-purple-800',
      iconName: 'Gamepad2',
      iconDataUrl: task.iconDataUrl,
      htmlContent: '',
      downloadStatus: 'downloading',
      downloadProgress: task.progress,
    };
    await startOrResumeDownload(game as GameItem);
  };

  const handleCancel = async (taskId: string) => {
    await deleteDownloadTask(taskId);
  };

  const handleStartResumableDownload = async (item: GameItem) => {
    setActiveTab('tasks');
    await startOrResumeDownload(item);
  };

  const handleDirectDownload = (item: GameItem) => {
    if (item.storageUrl && item.storageUrl.startsWith('http')) {
      const a = document.createElement('a');
      a.href = item.storageUrl;
      a.download = item.filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    window.location.href = `/api/games/${item.id}/download`;
  };

  const activeDownloadingCount = downloadTasks.filter((t) => t.status === 'downloading').length;

  return (
    <div className="space-y-4 my-2">
      {/* Top Selector Tabs */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span>Download Engine</span>
            {activeDownloadingCount > 0 && (
              <span className="px-2 py-0.2 rounded-full bg-red-500/20 text-red-300 text-[10px] animate-pulse">
                {activeDownloadingCount} Active
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-500">
            Resumable chunked downloads with pause/resume and persistent IndexedDB storage
          </p>
        </div>

        <div className="flex items-center p-0.5 rounded-xl bg-black/40 border border-red-950/60 text-xs">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Downloads ({downloadTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Installed ({downloadedItems.length})
          </button>
        </div>
      </div>

      {/* SECTION 1: Resumable Downloads Queue */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {downloadTasks.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-[#12070a] border border-red-950/60 space-y-3 shadow-lg shadow-black/40">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
                <HardDriveDownload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-300 font-bold">No active download tasks</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                  Start downloading any game or package. If you close the app or lose connection, your downloaded chunks are preserved and can be resumed anytime.
                </p>
              </div>
              {downloadedItems.length > 0 && (
                <button
                  onClick={() => setActiveTab('library')}
                  className="px-4 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-white text-xs font-semibold border border-red-800/40 cursor-pointer"
                >
                  View Installed Games
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {downloadTasks.map((task) => {
                const isDownloading = task.status === 'downloading';
                const isPaused = task.status === 'paused';
                const isCompleted = task.status === 'completed';
                const isFailed = task.status === 'failed';

                return (
                  <div
                    key={task.id}
                    className="p-4 bg-[#12070a] hover:bg-[#1c0d12] border border-red-950/60 hover:border-red-600/40 rounded-2xl space-y-3 shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {task.iconDataUrl ? (
                            <img src={task.iconDataUrl} alt={task.title} className="w-full h-full object-cover" />
                          ) : task.fileType === 'picture' ? (
                            <ImageIcon className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Smartphone className="w-5 h-5 text-red-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white truncate max-w-[170px] sm:max-w-xs">
                              {task.title}
                            </h4>

                            {/* Status badge */}
                            {isDownloading && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                                Downloading
                              </span>
                            )}
                            {isPaused && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Pause className="w-2.5 h-2.5" />
                                Paused
                              </span>
                            )}
                            {isCompleted && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Completed
                              </span>
                            )}
                            {isFailed && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                Failed
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono text-slate-300">
                              {formatBytes(task.receivedBytes)} / {formatBytes(task.totalBytes)}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400 font-mono text-[10px]">{task.speed}</span>
                            {task.totalChunks > 1 && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="text-red-400 text-[10px]">
                                  {task.completedChunks.length}/{task.totalChunks} chunks
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Pause / Resume / Cancel */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDownloading && (
                          <button
                            onClick={() => handlePause(task.id)}
                            className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="Pause download (preserves all chunks)"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Pause</span>
                          </button>
                        )}

                        {isPaused && (
                          <button
                            onClick={() => handleResume(task)}
                            className="p-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md transition-all cursor-pointer"
                            title="Resume download from where it stopped"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span className="hidden sm:inline">Resume</span>
                          </button>
                        )}

                        {isFailed && (
                          <button
                            onClick={() => handleResume(task)}
                            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="Retry download"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Retry</span>
                          </button>
                        )}

                        {isCompleted && (
                          <button
                            onClick={() => {
                              const game = games.find((g) => g.id === task.gameId);
                              if (game) onPlay(game);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>PLAY</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCancel(task.id)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Chunked Range Transfer</span>
                        <span className="font-mono text-white font-bold">{task.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isCompleted
                              ? 'bg-emerald-500'
                              : isPaused
                              ? 'bg-amber-400'
                              : isFailed
                              ? 'bg-rose-500'
                              : 'bg-gradient-to-r from-red-600 via-rose-500 to-red-400'
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Downloaded Library Files */}
      {activeTab === 'library' && (
        <div className="space-y-2">
          {downloadedItems.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#12070a] border border-red-950/60 shadow-md">
              <Download className="w-8 h-8 text-red-900/60 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">No downloaded files yet</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Upload an APK, IPA, HTML game, picture, or 3D model to see it here immediately.
              </p>
            </div>
          ) : (
            downloadedItems.map((item) => {
              const isPicture = item.fileType === 'picture';
              const isWeb = item.fileType === 'html' || (item.fileType === 'zip' && item.apkDetails?.hasEmbeddedHtml);

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-[#12070a] hover:bg-[#1c0d12] border border-red-950/60 hover:border-red-600/40 rounded-2xl transition-all flex items-center justify-between gap-3 shadow-md shadow-black/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${
                        item.accentGradient || 'from-red-600 to-rose-800'
                      } flex items-center justify-center shrink-0 shadow-md ring-1 ring-red-500/20 overflow-hidden cursor-pointer`}
                      onClick={() => onPlay(item)}
                    >
                      {(() => {
                        const coverUrl =
                          item.iconDataUrl ||
                          item.mediaUrl ||
                          (isPicture && item.storageUrl ? item.storageUrl : null);
                        if (coverUrl) {
                          return (
                            <img
                              src={coverUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          );
                        }
                        if (isPicture) return <ImageIcon className="w-5 h-5 text-emerald-300" />;
                        if (item.fileType === 'ipa') return <Apple className="w-5 h-5 text-sky-300" />;
                        if (item.fileType === '3d') return <Box className="w-5 h-5 text-cyan-300" />;
                        if (item.fileType === 'apk') return <Smartphone className="w-5 h-5 text-amber-300" />;
                        return <FileCode2 className="w-5 h-5 text-white" />;
                      })()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className="text-xs font-bold text-white truncate cursor-pointer hover:text-red-400"
                          onClick={() => onPlay(item)}
                        >
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Downloaded
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-slate-300">{formatBytes(item.fileSize)}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="truncate text-slate-400 max-w-[130px]">{item.filename}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Resumable Background Downloader Trigger */}
                    <button
                      onClick={() => handleStartResumableDownload(item)}
                      className="p-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                      title="Download with Resumable Chunk Manager"
                    >
                      <HardDriveDownload className="w-3.5 h-3.5 text-red-400" />
                    </button>

                    {/* Direct Device Save */}
                    <button
                      onClick={() => handleDirectDownload(item)}
                      className="p-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                      title={`Save ${item.filename} directly to device`}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    {/* Inspect Details */}
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Inspect File"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    {/* Play / View */}
                    <button
                      onClick={() => onPlay(item)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${
                        isPicture
                          ? 'bg-emerald-600 hover:bg-emerald-500'
                          : item.fileType === '3d'
                          ? 'bg-cyan-600 hover:bg-cyan-500'
                          : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isPicture ? 'VIEW' : 'PLAY'}</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(item.id, item.title)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Remove from Downloads"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Package / File Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#12070a] border border-red-900/60 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-red-950/60">
              <div className="flex items-center gap-2.5">
                {selectedItem.fileType === 'picture' ? (
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                ) : selectedItem.fileType === 'ipa' ? (
                  <Apple className="w-5 h-5 text-sky-400" />
                ) : selectedItem.fileType === '3d' ? (
                  <Box className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Smartphone className="w-5 h-5 text-red-400" />
                )}
                <h3 className="text-sm font-bold text-white">Installed File Details</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#090305] border border-red-950/40">
                <div className="text-[11px] text-slate-500">File Name & Identifier</div>
                <div className="text-white font-mono break-all font-semibold">
                  {selectedItem.apkDetails?.packageName || selectedItem.filename}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-[#090305] border border-red-950/40">
                  <div className="text-[11px] text-slate-500">File Type</div>
                  <div className="text-white font-semibold uppercase">
                    {selectedItem.fileType}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#090305] border border-red-950/40">
                  <div className="text-[11px] text-slate-500">File Size</div>
                  <div className="text-white font-semibold">
                    {formatBytes(selectedItem.fileSize)}
                  </div>
                </div>
              </div>

              {selectedItem.storageUrl && (
                <div className="p-2.5 rounded-xl bg-[#090305] border border-red-950/40">
                  <div className="text-[11px] text-slate-500">Supabase Storage URL</div>
                  <div className="text-emerald-400 font-mono text-[10px] truncate">
                    {selectedItem.storageUrl}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const item = selectedItem;
                  setSelectedItem(null);
                  handleDirectDownload(item);
                }}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download File</span>
              </button>

              <button
                onClick={() => {
                  const item = selectedItem;
                  setSelectedItem(null);
                  onPlay(item);
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Preview / Play</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
