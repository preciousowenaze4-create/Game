/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Gamepad2,
  Download,
  PlusCircle,
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
import { GamePlayer } from './components/GamePlayer';
import { DownloadsManager } from './components/DownloadsManager';
import { EditGameModal } from './components/EditGameModal';
import { TransferProgressTracker } from './components/TransferProgressTracker';
import { BossGameCatalog } from './components/BossGameCatalog';
import { AirPlayRemoteController } from './components/AirPlayRemoteController';
import { TvDisplayScreen } from './components/TvDisplayScreen';
import { IPhoneControllerScreen } from './components/IPhoneControllerScreen';
import { airPlayService } from './services/airplayService';
import { OFFICIAL_UNITY_CAR_SIM } from './utils/sampleGames';

type DashboardTab = 'arcade' | 'library' | 'downloads' | 'install';
type AppMode = 'dashboard' | 'tv' | 'controller';

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode') || params.get('role');
      if (modeParam === 'tv' || window.location.pathname.startsWith('/tv')) return 'tv';
      if (modeParam === 'controller' || window.location.pathname.startsWith('/controller')) return 'controller';
    }
    return 'dashboard';
  });

  const urlRoomCode = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('room') || '';
    }
    return '';
  }, []);

  const [games, setGames] = useState<GameItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('arcade');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activePlayingGame, setActivePlayingGame] = useState<GameItem | null>(null);
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

  // Load real games from IndexedDB on startup
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

  // Play Game Handler (launches official Unity game or uploaded file)
  const handlePlayGame = async (game: GameItem) => {
    const gameToPlay: GameItem = {
      ...game,
      storageUrl: game.storageUrl || game.webUrl || OFFICIAL_UNITY_CAR_SIM.webUrl,
      webUrl: game.webUrl || OFFICIAL_UNITY_CAR_SIM.webUrl,
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

  // =========================================================================
  // ROUTE 1: DEDICATED TV DISPLAY SCREEN
  // =========================================================================
  if (currentMode === 'tv') {
    return <TvDisplayScreen onExit={() => setCurrentMode('dashboard')} />;
  }

  // =========================================================================
  // ROUTE 2: DEDICATED IPHONE CONTROLLER SCREEN
  // =========================================================================
  if (currentMode === 'controller') {
    return (
      <IPhoneControllerScreen
        initialRoomCode={urlRoomCode}
        onExit={() => setCurrentMode('dashboard')}
      />
    );
  }

  // =========================================================================
  // MAIN DASHBOARD VIEW
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#080305] text-red-50 flex flex-col items-center justify-start overflow-x-hidden selection:bg-red-600/40 selection:text-white">
      {/* Wireless Remote Controller for AirPlay */}
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

      {/* Full-Screen Game Player Overlay when active */}
      {activePlayingGame && !isAirPlayCasting && (
        <GamePlayer
          game={activePlayingGame}
          onExit={() => setActivePlayingGame(null)}
          onOpenAirPlay={handleTriggerAirPlay}
        />
      )}

      {/* Main App Container */}
      <div className="w-full max-w-2xl px-4 py-3 sm:px-6 min-h-screen">
        <div className="flex flex-col pt-2 pb-16">
          {/* Header with TV Screen & iPhone Controller Buttons */}
          <Header
            stats={stats}
            onOpenAirPlayModal={handleTriggerAirPlay}
            onOpenTvScreen={() => setCurrentMode('tv')}
            onOpenController={() => setCurrentMode('controller')}
          />

          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1.5 my-3 bg-[#13070b] rounded-2xl border border-red-950/80 shadow-xl shadow-black/80">
            <button
              onClick={() => setActiveTab('arcade')}
              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'arcade'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/40'
                  : 'text-red-200/70 hover:text-white hover:bg-red-950/40'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Unity Sim</span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/40'
                  : 'text-red-200/70 hover:text-white hover:bg-red-950/40'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>My Files</span>
              <span className="text-[10px] opacity-75 tabular-nums">({games.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('downloads')}
              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'downloads'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/40'
                  : 'text-red-200/70 hover:text-white hover:bg-red-950/40'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Downloads</span>
              {stats.apkCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500/25 text-red-300 font-bold">
                  {stats.apkCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('install')}
              className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'install'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/40'
                  : 'text-red-200/70 hover:text-white hover:bg-red-950/40'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
          </div>

          {/* Tab 0: Boss Gaming Platform (Official Unity WebGL Car Sim) */}
          {activeTab === 'arcade' && (
            <BossGameCatalog
              onPlayGame={handlePlayGame}
              onOpenTvScreen={() => setCurrentMode('tv')}
              onOpenController={() => setCurrentMode('controller')}
            />
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
              <div className="grid grid-cols-4 gap-2 p-3 bg-[#13070b] rounded-2xl border border-red-950/80 text-center">
                <div>
                  <div className="text-[10px] font-medium text-red-300/60">Total Files</div>
                  <div className="text-sm font-bold text-white tabular-nums">
                    {stats.totalGames}
                  </div>
                </div>
                <div className="border-l border-red-950/80">
                  <div className="text-[10px] font-medium text-red-300/60">APKs</div>
                  <div className="text-sm font-bold text-red-400 tabular-nums">
                    {stats.apkCount}
                  </div>
                </div>
                <div className="border-l border-red-950/80">
                  <div className="text-[10px] font-medium text-red-300/60">Pictures</div>
                  <div className="text-sm font-bold text-rose-400 tabular-nums">
                    {stats.pictureCount}
                  </div>
                </div>
                <div className="border-l border-red-950/80">
                  <div className="text-[10px] font-medium text-red-300/60">Storage</div>
                  <div className="text-xs font-mono font-bold text-amber-300 truncate mt-0.5">
                    {formatBytes(stats.totalBytes)}
                  </div>
                </div>
              </div>

              {games.length === 0 ? (
                <div className="py-12 text-center text-red-300/60 bg-[#13070b] rounded-2xl border border-red-950/80 p-6">
                  <p className="text-xs">No files uploaded yet. Upload an APK or play the Unity Car Sim.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {games.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 bg-[#13070b] border border-red-950/80 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{g.title}</div>
                        <div className="text-[10px] text-red-300/60">{formatBytes(g.fileSize)}</div>
                      </div>
                      <button
                        onClick={() => handlePlayGame(g)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white cursor-pointer"
                      >
                        Play
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Game Modal */}
      {editingGame && (
        <EditGameModal
          isOpen={true}
          gameId={editingGame.id}
          initialTitle={editingGame.title}
          onSave={(_id, newTitle) => {
            handleSaveRename(editingGame.id, newTitle);
            setEditingGame(null);
          }}
          onClose={() => setEditingGame(null)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-950/95 border border-red-700/80 text-white text-xs font-bold rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
