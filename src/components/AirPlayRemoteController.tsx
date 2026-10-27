import React, { useRef, useState, useEffect } from 'react';
import {
  Tv,
  Power,
  Volume2,
  VolumeX,
  RotateCcw,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Play,
  Grid,
  CheckCircle2,
  Flame,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { airPlayService } from '../services/airplayService';
import { GameItem } from '../types/game';
import { TVSharedState } from '../types/airplay';

interface AirPlayRemoteControllerProps {
  currentGame: GameItem | null;
  onDisconnect: () => void;
}

export const AirPlayRemoteController: React.FC<AirPlayRemoteControllerProps> = ({
  currentGame,
  onDisconnect,
}) => {
  const [tvState, setTvState] = useState<TVSharedState>(airPlayService.getTVState());
  const [games, setGames] = useState<GameItem[]>([]);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [activeGesture, setActiveGesture] = useState<string>('Ready');
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const trackpadRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Load games list to display live preview of what is focused on TV
  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.games)) {
          setGames(data.games);
        }
      })
      .catch(() => {});
  }, []);

  // Subscribe to live TV state updates (mode: 'catalog' | 'playing', focused index, etc.)
  useEffect(() => {
    const unsub = airPlayService.subscribeTVState((state) => {
      setTvState({ ...state });
    });
    return unsub;
  }, []);

  // Determine currently focused game on TV
  const currentFocusedGame = React.useMemo(() => {
    if (games.length === 0) return null;
    const filtered =
      tvState.category === 'All'
        ? games
        : games.filter((g) =>
            g.category.toLowerCase().includes(tvState.category.toLowerCase())
          );
    if (filtered.length === 0) return games[0];
    const idx = Math.max(0, Math.min(tvState.focusedIndex, filtered.length - 1));
    return filtered[idx];
  }, [games, tvState.focusedIndex, tvState.category]);

  // Haptic feedback
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  };

  // Send navigation commands for TV catalog selection
  const handleNav = (dir: 'up' | 'down' | 'left' | 'right') => {
    triggerHaptic(20);
    setActiveGesture(`Nav ${dir.toUpperCase()}`);
    airPlayService.navigate(dir);
    setTimeout(() => setActiveGesture('Ready'), 600);
  };

  // Launch highlighted game on TV
  const handleSelectGame = () => {
    triggerHaptic(40);
    setActiveGesture('Select (Play)');
    airPlayService.selectGame(currentFocusedGame?.id);
  };

  // Exit game on TV back to game catalog
  const handleExitToCatalog = () => {
    triggerHaptic(25);
    setActiveGesture('Return to Catalog');
    airPlayService.exitGameToCatalog();
  };

  // Send gamepad keyboard event for gameplay
  const sendKey = (code: string, key: string, isDown: boolean, keyCode = 0) => {
    triggerHaptic(isDown ? 20 : 10);
    setActiveKeys((prev) => {
      const next = new Set(prev);
      if (isDown) next.add(code);
      else next.delete(code);
      return next;
    });

    airPlayService.sendCommand({
      type: isDown ? 'KEY_DOWN' : 'KEY_UP',
      code,
      key,
      keyCode,
    });
  };

  // Trackpad Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = trackpadRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setTouchPos({ x, y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0 || !touchStartRef.current) return;
    const touch = e.touches[0];
    const rect = trackpadRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    setTouchPos({ x, y });

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (tvState.mode === 'playing') {
      airPlayService.sendCommand({
        type: 'TOUCH_MOVE',
        deltaX: Math.round(dx),
        deltaY: Math.round(dy),
      });

      // Directional keys if moving significantly
      if (Math.abs(dx) > 30) {
        if (dx > 0) {
          sendKey('ArrowRight', 'ArrowRight', true, 39);
          sendKey('ArrowLeft', 'ArrowLeft', false, 37);
        } else {
          sendKey('ArrowLeft', 'ArrowLeft', true, 37);
          sendKey('ArrowRight', 'ArrowRight', false, 39);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchPos(null);
    if (!touchStartRef.current) return;

    const duration = Date.now() - touchStartRef.current.time;
    const touch = e.changedTouches[0];
    const dx = touch ? touch.clientX - touchStartRef.current.x : 0;
    const dy = touch ? touch.clientY - touchStartRef.current.y : 0;

    // Release steering
    if (tvState.mode === 'playing') {
      sendKey('ArrowRight', 'ArrowRight', false, 39);
      sendKey('ArrowLeft', 'ArrowLeft', false, 37);
      sendKey('ArrowUp', 'ArrowUp', false, 38);
      sendKey('ArrowDown', 'ArrowDown', false, 40);
    }

    // Tap detection (< 250ms and small movement)
    if (duration < 250 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      triggerHaptic(25);
      if (tvState.mode === 'catalog') {
        handleSelectGame();
      } else {
        sendKey('Space', ' ', true, 32);
        setTimeout(() => sendKey('Space', ' ', false, 32), 120);
      }
    } else if (Math.abs(dx) > 35 || Math.abs(dy) > 35) {
      // Swipes navigate games on TV
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) handleNav('right');
        else handleNav('left');
      } else {
        if (dy > 0) handleNav('down');
        else handleNav('up');
      }
    }

    touchStartRef.current = null;
  };

  // Gyroscope tilt steering for playing mode
  useEffect(() => {
    if (!tiltEnabled || tvState.mode !== 'playing' || typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma || 0;
      if (gamma > 15) {
        sendKey('ArrowRight', 'ArrowRight', true, 39);
        sendKey('ArrowLeft', 'ArrowLeft', false, 37);
      } else if (gamma < -15) {
        sendKey('ArrowLeft', 'ArrowLeft', true, 37);
        sendKey('ArrowRight', 'ArrowRight', false, 39);
      } else {
        sendKey('ArrowRight', 'ArrowRight', false, 39);
        sendKey('ArrowLeft', 'ArrowLeft', false, 37);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [tiltEnabled, tvState.mode]);

  const tvReceiverUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tv?session=airplay-session`
    : '#';

  return (
    <div className="fixed inset-0 z-50 bg-[#f8fafc] text-slate-900 flex flex-col justify-between p-3.5 sm:p-5 select-none overflow-hidden font-sans">
      {/* 
        1. TOP BAR:
        Status, current mode, and Disconnect TV button
      */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-indigo-600">
            <Tv className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-800">
                Connected to TV
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                AirPlay Live
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              {tvState.mode === 'catalog' ? 'Selecting Game on TV' : 'Game Playing on TV'}
            </div>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        <div className="flex items-center gap-2">
          {tvState.mode === 'playing' && (
            <button
              onClick={handleExitToCatalog}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-xs font-bold transition-all cursor-pointer"
              title="Return to TV game selection"
            >
              Menu
            </button>
          )}

          <button
            onClick={onDisconnect}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* 
        2. DYNAMIC TV CONTROLLER SCREEN:
        MODE A: Game Selector Pad (browse and pick game on TV)
        MODE B: Tactical Gamepad (drive, jump, steer game on TV)
      */}
      {tvState.mode === 'catalog' ? (
        /* MODE A: TV GAME SELECTOR PAD */
        <div className="flex-1 my-2.5 flex flex-col justify-between space-y-2.5 overflow-hidden">
          {/* Live Focused Game Preview Box */}
          {currentFocusedGame && (
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <img
                src={currentFocusedGame.thumbnailUrl || currentFocusedGame.iconDataUrl}
                alt={currentFocusedGame.title}
                className="w-14 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                  Highlighted on TV
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {currentFocusedGame.title}
                </div>
                <div className="text-[10px] text-slate-500">
                  {currentFocusedGame.category} • ⭐ {currentFocusedGame.rating || 4.9}
                </div>
              </div>

              {/* Instant Play Tap */}
              <button
                onClick={handleSelectGame}
                className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-600/30 active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play</span>
              </button>
            </div>
          )}

          {/* Touch-Sensitive Trackpad / Swipe Surface for TV Navigation */}
          <div
            ref={trackpadRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative flex-1 w-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center overflow-hidden cursor-pointer touch-none"
          >
            {/* Texture */}
            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}
            />

            {touchPos && (
              <div
                className="absolute w-14 h-14 -ml-7 -mt-7 rounded-full bg-indigo-500/15 border-2 border-indigo-500 pointer-events-none"
                style={{ left: `${touchPos.x}px`, top: `${touchPos.y}px` }}
              />
            )}

            <div className="pointer-events-none text-center space-y-1.5 z-10 px-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-indigo-600 shadow-sm">
                <Compass className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-xs font-bold text-slate-800">
                Touchpad &amp; Swipe Zone
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Swipe Left / Right / Up / Down to change game on TV
              </p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono text-slate-600 font-semibold border border-slate-200">
                {activeGesture}
              </span>
            </div>
          </div>

          {/* D-Pad Navigation + Big (A) Select Game Button */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            {/* Cross D-Pad */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => handleNav('up')}
                className="w-10 h-10 rounded-xl bg-slate-100 active:bg-indigo-600 active:text-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-sm"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => handleNav('left')}
                  className="w-10 h-10 rounded-xl bg-slate-100 active:bg-indigo-600 active:text-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleNav('down')}
                  className="w-10 h-10 rounded-xl bg-slate-100 active:bg-indigo-600 active:text-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-sm"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleNav('right')}
                  className="w-10 h-10 rounded-xl bg-slate-100 active:bg-indigo-600 active:text-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Giant (A) Select / Play Button */}
            <button
              onClick={handleSelectGame}
              className="flex-1 h-24 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm flex flex-col items-center justify-center shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer border border-emerald-400"
            >
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg font-black mb-1">
                A
              </div>
              <span>PLAY ON TV</span>
              <span className="text-[10px] font-normal opacity-80">Launch Game</span>
            </button>
          </div>
        </div>
      ) : (
        /* MODE B: TACTICAL GAMEPLAY PAD */
        <div className="flex-1 my-2.5 flex flex-col justify-between space-y-2.5 overflow-hidden">
          {/* Steering / Trackpad Area */}
          <div
            ref={trackpadRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative flex-1 w-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center overflow-hidden cursor-crosshair touch-none"
          >
            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />

            {touchPos && (
              <div
                className="absolute w-16 h-16 -ml-8 -mt-8 rounded-full bg-indigo-500/15 border-2 border-indigo-500 pointer-events-none"
                style={{ left: `${touchPos.x}px`, top: `${touchPos.y}px` }}
              />
            )}

            <div className="pointer-events-none text-center space-y-1 z-10">
              <div className="text-xs font-bold text-slate-800">
                Steering &amp; Action Touchpad
              </div>
              <p className="text-[11px] text-slate-400">
                Drag to steer • Tap to accelerate
              </p>
            </div>
          </div>

          {/* D-Pad + A/B Action Cluster */}
          <div className="bg-white p-3.5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              {/* D-Pad */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onPointerDown={() => sendKey('ArrowUp', 'ArrowUp', true, 38)}
                  onPointerUp={() => sendKey('ArrowUp', 'ArrowUp', false, 38)}
                  onPointerLeave={() => sendKey('ArrowUp', 'ArrowUp', false, 38)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold ${
                    activeKeys.has('ArrowUp')
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
                <div className="flex gap-1">
                  <button
                    onPointerDown={() => sendKey('ArrowLeft', 'ArrowLeft', true, 37)}
                    onPointerUp={() => sendKey('ArrowLeft', 'ArrowLeft', false, 37)}
                    onPointerLeave={() => sendKey('ArrowLeft', 'ArrowLeft', false, 37)}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold ${
                      activeKeys.has('ArrowLeft')
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onPointerDown={() => sendKey('ArrowDown', 'ArrowDown', true, 40)}
                    onPointerUp={() => sendKey('ArrowDown', 'ArrowDown', false, 40)}
                    onPointerLeave={() => sendKey('ArrowDown', 'ArrowDown', false, 40)}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold ${
                      activeKeys.has('ArrowDown')
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <ArrowDown className="w-5 h-5" />
                  </button>
                  <button
                    onPointerDown={() => sendKey('ArrowRight', 'ArrowRight', true, 39)}
                    onPointerUp={() => sendKey('ArrowRight', 'ArrowRight', false, 39)}
                    onPointerLeave={() => sendKey('ArrowRight', 'ArrowRight', false, 39)}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold ${
                      activeKeys.has('ArrowRight')
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onPointerDown={() => sendKey('Space', ' ', true, 32)}
                  onPointerUp={() => sendKey('Space', ' ', false, 32)}
                  onPointerLeave={() => sendKey('Space', ' ', false, 32)}
                  className={`py-3 rounded-2xl flex flex-col items-center justify-center border font-bold ${
                    activeKeys.has('Space')
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  <span className="text-sm font-black">A</span>
                  <span className="text-[9px] font-semibold opacity-75">Gas / Jump</span>
                </button>

                <button
                  onPointerDown={() => sendKey('KeyX', 'x', true, 88)}
                  onPointerUp={() => sendKey('KeyX', 'x', false, 88)}
                  onPointerLeave={() => sendKey('KeyX', 'x', false, 88)}
                  className={`py-3 rounded-2xl flex flex-col items-center justify-center border font-bold ${
                    activeKeys.has('KeyX')
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <span className="text-sm font-black">B</span>
                  <span className="text-[9px] font-semibold opacity-75">Brake / Rev</span>
                </button>

                <button
                  onPointerDown={() => sendKey('ShiftLeft', 'Shift', true, 16)}
                  onPointerUp={() => sendKey('ShiftLeft', 'Shift', false, 16)}
                  onPointerLeave={() => sendKey('ShiftLeft', 'Shift', false, 16)}
                  className="py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  Nitro / Shift
                </button>

                <button
                  onPointerDown={() => sendKey('ControlLeft', 'Control', true, 17)}
                  onPointerUp={() => sendKey('ControlLeft', 'Control', false, 17)}
                  onPointerLeave={() => sendKey('ControlLeft', 'Control', false, 17)}
                  className="py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  Handbrake
                </button>
              </div>
            </div>

            {/* Aux Row */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-600">
              <button
                onClick={() => setTiltEnabled(!tiltEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold ${
                  tiltEnabled
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Tilt: {tiltEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={handleExitToCatalog}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Change Game</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        3. BOTTOM BAR:
        Direct TV Display Link & Quick Tips
      */}
      <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-slate-500">
        <span>Dual-Screen TV &amp; Remote Pad</span>
        <a
          href={tvReceiverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold"
        >
          <span>Open TV Display</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
