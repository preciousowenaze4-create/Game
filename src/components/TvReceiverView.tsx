import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Tv,
  Gamepad2,
  Sparkles,
  Star,
  Flame,
  ArrowRight,
  Layers,
  ChevronRight,
  ChevronLeft,
  Play,
  RotateCcw,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { SAMPLE_GAMES } from '../utils/sampleGames';
import { REAL_CATALOG_GAMES } from '../utils/supabaseSeed';
import { resolvePlayableGameUrl } from '../utils/gameUrlHelper';
import { airPlayService } from '../services/airplayService';
import { RemoteControllerCommand, TVSharedState } from '../types/airplay';

export const TvReceiverView: React.FC = () => {
  const [games, setGames] = useState<GameItem[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isPlayingGame, setIsPlayingGame] = useState<boolean>(false);
  const [currentGame, setCurrentGame] = useState<GameItem | null>(null);
  const [controllerConnected, setControllerConnected] = useState<boolean>(true);
  const [lastActionHint, setLastActionHint] = useState<string>('Ready');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // Load complete games catalog
  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.games) && data.games.length > 0) {
          setGames(data.games);
        } else {
          setGames(SAMPLE_GAMES);
        }
      })
      .catch(() => {
        setGames(SAMPLE_GAMES);
      });
  }, []);

  const categories = [
    'All',
    'Car & Driving',
    'Action & Stunts',
    'Multiplayer .io',
    'Shooting',
    'Sports & Bike',
    'Mind & Puzzles',
  ];

  const filteredGames = useMemo(() => {
    if (activeCategory === 'All') return games;
    const catLow = activeCategory.toLowerCase();
    return games.filter(
      (g) =>
        g.category.toLowerCase().includes(catLow) ||
        (g.genre && g.genre.toLowerCase().includes(catLow))
    );
  }, [games, activeCategory]);

  const focusedGame = useMemo(() => {
    if (filteredGames.length === 0) return null;
    const safeIndex = Math.max(0, Math.min(focusedIndex, filteredGames.length - 1));
    return filteredGames[safeIndex];
  }, [filteredGames, focusedIndex]);

  // Sync state to iPhone Controller
  const broadcastTVState = (
    mode: 'catalog' | 'playing',
    game: GameItem | null = currentGame,
    index = focusedIndex,
    cat = activeCategory
  ) => {
    const newState: TVSharedState = {
      mode,
      activeGameId: game?.id || null,
      activeGameTitle: game?.title || null,
      focusedIndex: index,
      category: cat,
      totalGames: filteredGames.length,
    };
    airPlayService.updateTVState(newState);
  };

  // Broadcast state changes whenever active game or focus updates
  useEffect(() => {
    broadcastTVState(isPlayingGame ? 'playing' : 'catalog', focusedGame, focusedIndex, activeCategory);
  }, [isPlayingGame, focusedIndex, activeCategory, focusedGame]);

  // Handle incoming remote controller commands
  useEffect(() => {
    let broadcast: BroadcastChannel | null = null;
    try {
      broadcast = new BroadcastChannel('airplay_game_channel');
      broadcast.onmessage = (e) => {
        handleRemoteCommand(e.data);
      };
    } catch (e) {}

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/airplay?session=airplay-session&role=receiver`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setControllerConnected(true);
        broadcastTVState(isPlayingGame ? 'playing' : 'catalog');
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRemoteCommand(data);
        } catch (e) {}
      };
      ws.onclose = () => {
        setControllerConnected(false);
      };
    } catch (err) {}

    return () => {
      if (broadcast) broadcast.close();
      if (ws) ws.close();
    };
  }, [isPlayingGame, focusedIndex, activeCategory, filteredGames]);

  // Smoothly scroll focused game card into view
  useEffect(() => {
    if (cardsContainerRef.current) {
      const activeElement = cardsContainerRef.current.querySelector(
        `[data-game-index="${focusedIndex}"]`
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [focusedIndex]);

  const handleRemoteCommand = (data: RemoteControllerCommand) => {
    if (!data) return;
    setControllerConnected(true);

    // 1. Navigation when browsing games on TV
    if (data.type === 'NAVIGATE') {
      const dir = data.direction;
      setLastActionHint(`Navigate ${dir?.toUpperCase()}`);
      setTimeout(() => setLastActionHint('Ready'), 1000);

      const COLS = 4;
      if (dir === 'right') {
        setFocusedIndex((prev) => Math.min(filteredGames.length - 1, prev + 1));
      } else if (dir === 'left') {
        setFocusedIndex((prev) => Math.max(0, prev - 1));
      } else if (dir === 'down') {
        setFocusedIndex((prev) => Math.min(filteredGames.length - 1, prev + COLS));
      } else if (dir === 'up') {
        setFocusedIndex((prev) => Math.max(0, prev - COLS));
      }
    } else if (data.type === 'SELECT_GAME') {
      // User tapped Play / Select on phone controller!
      const gameToPlay = data.gameId
        ? games.find((g) => g.id === data.gameId) || focusedGame
        : focusedGame;

      if (gameToPlay) {
        setLastActionHint(`Playing ${gameToPlay.title}`);
        setCurrentGame(gameToPlay);
        setIsPlayingGame(true);
      }
    } else if (data.type === 'EXIT_GAME') {
      // Exit from game back to TV catalog
      setLastActionHint('Returned to Game Catalog');
      setIsPlayingGame(false);
    } else if (data.type === 'SET_CATEGORY' && data.category) {
      setActiveCategory(data.category);
      setFocusedIndex(0);
    } else if (data.type === 'REQUEST_SYNC') {
      broadcastTVState(isPlayingGame ? 'playing' : 'catalog');
    }

    // 2. Real-time controller keys & touch for actively playing game
    if (data.type === 'KEY_DOWN') {
      dispatchKeyEvent(data.code || 'Space', data.key || ' ', true, data.keyCode || 32);
    } else if (data.type === 'KEY_UP') {
      dispatchKeyEvent(data.code || 'Space', data.key || ' ', false, data.keyCode || 32);
    } else if (data.type === 'GESTURE') {
      if (data.gesture === 'swipe-up') dispatchKey('ArrowUp', 38);
      else if (data.gesture === 'swipe-down') dispatchKey('ArrowDown', 40);
      else if (data.gesture === 'swipe-left') dispatchKey('ArrowLeft', 37);
      else if (data.gesture === 'swipe-right') dispatchKey('ArrowRight', 39);
      else if (data.gesture === 'tap') dispatchKey('Space', 32);
    } else if (data.type === 'TOUCH_TAP') {
      dispatchKey('Space', 32);
    }
  };

  const dispatchKey = (code: string, keyCode: number) => {
    dispatchKeyEvent(code, code, true, keyCode);
    setTimeout(() => dispatchKeyEvent(code, code, false, keyCode), 120);
  };

  const dispatchKeyEvent = (code: string, key: string, isDown: boolean, keyCode: number) => {
    const eventType = isDown ? 'keydown' : 'keyup';
    const ev = new KeyboardEvent(eventType, {
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
    });

    window.dispatchEvent(ev);
    document.dispatchEvent(ev);

    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage(
          {
            type: 'VIRTUAL_KEY',
            action: isDown ? 'down' : 'up',
            code,
            key,
            keyCode,
          },
          '*'
        );
      } catch (e) {}
    }
  };

  const playableUrl = useMemo(() => {
    if (!currentGame) return '';
    const raw = currentGame.webUrl || currentGame.gameUrl || currentGame.storageUrl || '';
    return resolvePlayableGameUrl(raw);
  }, [currentGame]);

  return (
    <div className="fixed inset-0 z-50 bg-[#06070e] text-white flex flex-col w-screen h-screen overflow-hidden select-none font-sans">
      {/* 
        CASE 1: TV ACTIVE GAME PLAY SCREEN
        Full widescreen 4K/1080p game runner with discreet status indicator
      */}
      {isPlayingGame && currentGame ? (
        <div className="relative w-full h-full bg-black">
          {/* Subtle Top TV HUD */}
          <div className="absolute top-4 left-6 right-6 z-40 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl">
              <Tv className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-black tracking-wide">{currentGame.title}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-950/80 backdrop-blur-xl border border-indigo-500/30 text-xs font-semibold text-indigo-200 shadow-2xl">
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              <span>iPhone Controller Active</span>
              <span className="text-slate-400 font-normal ml-1">• Tap Menu on Phone to Exit</span>
            </div>
          </div>

          <iframe
            ref={iframeRef}
            src={playableUrl}
            title={currentGame.title}
            className="w-full h-full border-none bg-black block"
            allow="autoplay; fullscreen; accelerometer; gyroscope; gamepad; cross-origin-isolated; pointer-lock"
          />
        </div>
      ) : (
        /* 
          CASE 2: CINEMATIC TV GAME CATALOG & SELECTION SCREEN
          The games display on the big screen, ready to be selected with the iPhone remote pad!
        */
        <div className="flex-1 flex flex-col p-8 lg:p-12 space-y-6 overflow-hidden bg-gradient-to-b from-[#0a0d1d] via-[#070913] to-[#04050a]">
          {/* Top TV Bar: Branding, Category chips & Controller Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-600/40 border border-white/20">
                <Tv className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Apple TV AirPlay Gaming</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    4K Ultra HD
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Select any game using the wireless pad on your phone
                </p>
              </div>
            </div>

            {/* Controller Connection Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-medium">
                <Gamepad2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-white font-bold">iPhone Remote Pad:</span>
                <span className="text-emerald-400 font-mono">CONNECTED</span>
              </div>
              <div className="text-[11px] font-mono text-indigo-300 px-3 py-2 rounded-2xl bg-indigo-950/60 border border-indigo-500/30">
                {lastActionHint}
              </div>
            </div>
          </div>

          {/* 
            SPOTLIGHT BANNER: Currently focused game on TV
            Displays high-res artwork, description, rating, and (A) Play hint
          */}
          {focusedGame && (
            <div className="relative rounded-3xl overflow-hidden border border-white/15 bg-[#121528] shadow-2xl p-6 lg:p-8 flex items-center justify-between min-h-[220px]">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-md"
                style={{
                  backgroundImage: `url(${focusedGame.thumbnailUrl || focusedGame.iconDataUrl})`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d1022] via-[#0d1022]/90 to-transparent" />

              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-extrabold text-[11px] tracking-wider uppercase">
                    {focusedGame.category}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-300" />
                    <span>{focusedGame.rating || 4.9}</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {Number(focusedGame.totalPlays || 150000).toLocaleString()} Plays
                  </span>
                </div>

                <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                  {focusedGame.title}
                </h2>

                <p className="text-xs lg:text-sm text-slate-300 leading-relaxed line-clamp-2 max-w-xl">
                  {focusedGame.description || focusedGame.notes || 'High-speed HTML5 action game optimized for big-screen play.'}
                </p>

                {/* Big Button Prompt */}
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 ring-2 ring-emerald-300 animate-bounce">
                    <div className="w-5 h-5 rounded-full bg-slate-950 text-white flex items-center justify-center text-xs font-black">
                      A
                    </div>
                    <span>PRESS (A) ON IPHONE PAD TO PLAY</span>
                  </div>

                  <span className="text-xs text-slate-400">
                    or Swipe on Phone Pad to browse ({focusedIndex + 1} of {filteredGames.length})
                  </span>
                </div>
              </div>

              {/* Game Artwork Preview */}
              <div className="relative z-10 hidden md:block w-56 h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500/50">
                <img
                  src={focusedGame.thumbnailUrl || focusedGame.iconDataUrl}
                  alt={focusedGame.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* 
            GAMES GRID / SHELF:
            Scrollable gallery of game cards on the TV screen
          */}
          <div className="space-y-3 flex-1 flex flex-col justify-end">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <span>Game Library ({filteredGames.length} titles available)</span>
              <span>Use D-Pad or Swipe on Phone to Navigate</span>
            </div>

            <div
              ref={cardsContainerRef}
              className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 overflow-hidden py-2"
            >
              {filteredGames.slice(0, 18).map((game, idx) => {
                const isFocused = idx === focusedIndex;
                return (
                  <div
                    key={game.id}
                    data-game-index={idx}
                    className={`relative rounded-2xl overflow-hidden transition-all duration-200 flex flex-col bg-[#14182e] ${
                      isFocused
                        ? 'ring-4 ring-indigo-500 scale-105 shadow-2xl shadow-indigo-500/50 z-20 -translate-y-1'
                        : 'border border-white/10 opacity-75'
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full bg-[#1a1f3c] overflow-hidden">
                      <img
                        src={game.thumbnailUrl || game.iconDataUrl}
                        alt={game.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#14182e] via-transparent to-transparent" />
                      {isFocused && (
                        <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/30 backdrop-blur-[1px]">
                          <div className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xl">
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>SELECT</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-bold text-white truncate">{game.title}</div>
                      <div className="text-[10px] text-slate-400 truncate">{game.category}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
