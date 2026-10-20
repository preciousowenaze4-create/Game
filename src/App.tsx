/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Gamepad2,
  Sparkles,
  Download,
  PlusCircle,
  Trash2,
  Image as ImageIcon,
  Flame,
  FolderArchive,
} from 'lucide-react';
import { GameItem, StorageStats } from './types/game';
import {
  getAllGames,
  saveGame,
  deleteGame,
  incrementPlayCount,
  updateGameTitle,
  clearAllGames,
  formatBytes,
} from './utils/db';
import { Header } from './components/Header';
import { GameUploader } from './components/GameUploader';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { DownloadsManager } from './components/DownloadsManager';
import { StandaloneExportModal } from './components/StandaloneExportModal';
import { EditGameModal } from './components/EditGameModal';
import { GoogleLoginModal } from './components/GoogleLoginModal';
import { TransferProgressTracker } from './components/TransferProgressTracker';
import { BossGameCatalog } from './components/BossGameCatalog';
import { AirPlayRemoteController } from './components/AirPlayRemoteController';
import { TvReceiverView } from './components/TvReceiverView';
import { airPlayService } from './services/airplayService';

type DashboardTab = 'arcade' | 'library' | 'downloads' | 'install';

export default function App() {
  // If user opens the TV Receiver URL directly on Apple TV / TV Screen browser:
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv')) {
    return <TvReceiverView />;
  }

  const [games, setGames] = useState<GameItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('arcade');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activePlayingGame, setActivePlayingGame] = useState<GameItem | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isAirPlayCasting, setIsAirPlayCasting] = useState<boolean>(false);
  const [editingGame, setEditingGame] = useState<{ id: string; title: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to native iOS AirPlay wireless session state
  useEffect(() => {
    const unsub = airPlayService.subscribe((isCasting) => {
      setIsAirPlayCasting(isCasting);
    });
    return unsub;
  }, []);

  // Trigger real native iOS system AirPlay route picker (AVRoutePickerView)
  const handleTriggerAirPlay = () => {
    airPlayService.triggerNativeAirPlayPicker();
  };

  // Load real games from IndexedDB on startup (starts empty until user uploads)
  useEffect(() => {
    async function load() {
      try {
        const loaded = await getAllGames();
        setGames(loaded);
      } catch (err) {
        console.error('Failed to load games:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Listen for download requests from APK dashboard iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'DOWNLOAD_ORIGINAL' && activePlayingGame) {
        const blob = new Blob([activePlayingGame.htmlContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activePlayingGame.filename || `${activePlayingGame.title}.apk`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Downloading "${activePlayingGame.filename}"`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activePlayingGame]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  // Add Game / Media Handler (stores real uploaded file)
  const handleGameAdded = async (newGame: GameItem) => {
    try {
      await saveGame(newGame);
      const updated = await getAllGames();
      setGames(updated);
      showToast(`Installed "${newGame.title}" into Downloads`);
      setActiveTab('downloads');
    } catch (err) {
      console.error(err);
      showToast('Error saving file');
    }
  };

  // Delete Game Handler
  const handleDeleteGame = async (id: string, title: string) => {
    if (window.confirm(`Delete "${title}" from your library?`)) {
      try {
        await deleteGame(id);
        const updated = await getAllGames();
        setGames(updated);
        showToast(`Deleted "${title}"`);
      } catch (err) {
        console.error(err);
        showToast('Error deleting item');
      }
    }
  };

  // Clear All Games
  const handleClearAll = async () => {
    if (window.confirm('Clear all installed files from storage?')) {
      try {
        await clearAllGames();
        setGames([]);
        showToast('Library cleared');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Rename Game Handler
  const handleSaveRename = async (id: string, newTitle: string) => {
    try {
      await updateGameTitle(id, newTitle);
      const updated = await getAllGames();
      setGames(updated);
      showToast('Renamed successfully');
    } catch (err) {
      console.error(err);
      showToast('Error renaming');
    }
  };

  // Play / Open Game Handler (launches real file in in-app web arcade player with Supabase URL)
  const handlePlayGame = async (game: GameItem) => {
    const gameToPlay: GameItem = {
      ...game,
      storageUrl: game.storageUrl || `/api/games/${game.id}/download`,
    };
    setActivePlayingGame(gameToPlay);
    try {
      await incrementPlayCount(game.id);
      const updated = await getAllGames();
      setGames(updated);
    } catch (err) {
      console.warn(err);
    }
  };

  // Compute storage and play stats
  const stats: StorageStats = useMemo(() => {
    return {
      totalGames: games.length,
      totalBytes: games.reduce((acc, g) => acc + (g.fileSize || 0), 0),
      totalPlays: games.reduce((acc, g) => acc + (g.playCount || 0), 0),
      apkCount: games.filter((g) => g.fileType === 'apk').length,
      pictureCount: games.filter((g) => g.fileType === 'picture').length,
    };
  }, [games]);

  // Filter games based on search and category
  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      const matchSearch =
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.apkDetails?.packageName &&
          g.apkDetails.packageName.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchCategory = true;
      if (activeCategory === 'Android APK') {
        matchCategory = g.fileType === 'apk';
      } else if (activeCategory === 'iOS IPA') {
        matchCategory = g.fileType === 'ipa';
      } else if (activeCategory === 'HTML5') {
        matchCategory = g.fileType === 'html';
      } else if (activeCategory === 'Pictures') {
        matchCategory = g.fileType === 'picture';
      } else if (activeCategory === '3D Models') {
        matchCategory = g.fileType === '3d';
      } else if (activeCategory !== 'All') {
        matchCategory = g.category === activeCategory;
      }

      return matchSearch && matchCategory;
    });
  }, [games, searchQuery, activeCategory]);

  const categories = ['All', 'Android APK', 'iOS IPA', 'HTML5', 'Pictures', '3D Models'];

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex flex-col items-center justify-start overflow-x-hidden selection:bg-indigo-500/30 selection:text-white">
      {/* 
        AIRPLAY WIRELESS REMOTE CONTROLLER:
        The moment the native iOS AirPlay session becomes active, the app interface on the iPhone 
        automatically transforms into a clean white touch-sensitive remote control / trackpad dashboard.
      */}
      {isAirPlayCasting && (
        <AirPlayRemoteController
          currentGame={activePlayingGame}
          onDisconnect={() => {
            airPlayService.disconnect();
            setIsAirPlayCasting(false);
            showToast('Disconnected from AirPlay');
          }}
        />
      )}

      {/* Full-Screen Game / Media Player Overlay when active */}
      {activePlayingGame && !isAirPlayCasting && (
        <GamePlayer
          game={activePlayingGame}
          onExit={() => setActivePlayingGame(null)}
          onOpenAirPlay={handleTriggerAirPlay}
        />
      )}

      {/* Main App Container */}
      <div className="w-full max-w-2xl px-4 py-3 sm:px-6 min-h-screen">
        {/* Content Body */}
        <div className="flex flex-col pt-2 pb-16">
          {/* Header */}
          <Header
            stats={stats}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onOpenAirPlayModal={handleTriggerAirPlay}
          />

          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 my-3 bg-[#111420] rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('arcade')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'arcade'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Arcade</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-indigo-500/30 text-indigo-200 font-bold">
                Live
              </span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>My Files</span>
              <span className="text-[10px] opacity-75 tabular-nums">({games.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('downloads')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'downloads'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Downloads</span>
              {stats.apkCount > 0 && (
                <span className="text-[10px] px-1 py-0.2 rounded-full bg-amber-500/25 text-amber-300 font-bold">
                  {stats.apkCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('install')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'install'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
          </div>

          {/* Tab 0: Boss Gaming Platform (Dynamic Supabase Integration) */}
          {activeTab === 'arcade' && (
            <BossGameCatalog onPlayGame={handlePlayGame} />
          )}

          {/* Tab 1: Install / Upload Real File */}
          {activeTab === 'install' && (
            <div className="space-y-4 animate-in fade-in">
              <GameUploader onGameAdded={handleGameAdded} />
            </div>
          )}

          {/* Tab 2: Downloads Manager */}
          {activeTab === 'downloads' && (
            <div className="animate-in fade-in">
              <DownloadsManager
                games={games}
                onPlay={handlePlayGame}
                onDelete={handleDeleteGame}
              />
            </div>
          )}

          {/* Tab 3: Main Game Library */}
          {activeTab === 'library' && (
            <div className="space-y-3 animate-in fade-in">
              {/* Metrics Strip */}
              <div className="grid grid-cols-4 gap-2 p-3 bg-[#111420] rounded-2xl border border-white/5 text-center">
                <div>
                  <div className="text-[10px] font-medium text-slate-400">Total Files</div>
                  <div className="text-sm font-bold text-white tabular-nums">
                    {stats.totalGames}
                  </div>
                </div>
                <div className="border-l border-white/5">
                  <div className="text-[10px] font-medium text-slate-400">APKs</div>
                  <div className="text-sm font-bold text-amber-400 tabular-nums">
                    {stats.apkCount}
                  </div>
                </div>
                <div className="border-l border-white/5">
                  <div className="text-[10px] font-medium text-slate-400">Media</div>
                  <div className="text-sm font-bold text-emerald-400 tabular-nums">
                    {stats.pictureCount}
                  </div>
                </div>
                <div className="border-l border-white/5">
                  <div className="text-[10px] font-medium text-slate-400">Storage</div>
                  <div className="text-sm font-bold text-indigo-400 tabular-nums">
                    {formatBytes(stats.totalBytes)}
                  </div>
                </div>
              </div>

              {/* Category Pills & Search Box if files exist */}
              {games.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-all cursor-pointer ${
                          activeCategory === cat
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search installed files..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111420] border border-white/5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Files / Games List Container */}
              <div className="space-y-2 pt-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading Game Center...</span>
                  </div>
                ) : filteredGames.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-[#111420]/60 border border-white/5">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 mb-3">
                      <Gamepad2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-200 mb-1">
                      No files installed
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs mb-5">
                      Your library is currently empty. Tap below to upload a real game, APK, or picture file from your phone.
                    </p>
                    <button
                      onClick={() => setActiveTab('install')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Upload Real File</span>
                    </button>
                  </div>
                ) : (
                  filteredGames.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onPlay={handlePlayGame}
                      onDelete={handleDeleteGame}
                      onRename={(id, title) => setEditingGame({ id, title })}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Storage & Clear Engine */}
          {games.length > 0 && (
            <div className="mt-8 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
              <span>IndexedDB Offline Storage Active</span>
              <button
                onClick={handleClearAll}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/95 text-white border border-white/15 text-xs font-medium shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Standalone Export Modal */}
      <StandaloneExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Firebase Google Login Modal */}
      <GoogleLoginModal />

      {/* Rename Modal */}
      {editingGame && (
        <EditGameModal
          isOpen={true}
          initialTitle={editingGame.title}
          gameId={editingGame.id}
          onSave={handleSaveRename}
          onClose={() => setEditingGame(null)}
        />
      )}

      {/* Persistent Progress Tracker for Resumable Uploads & Downloads */}
      <TransferProgressTracker />
    </div>
  );
}
