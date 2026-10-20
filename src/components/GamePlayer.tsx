import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  RotateCcw,
  RotateCw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Download,
  Tv,
  ExternalLink,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { formatBytes } from '../utils/db';
import { recordGamePlay } from '../utils/supabaseCatalog';
import { resolvePlayableGameUrl } from '../utils/gameUrlHelper';

interface GamePlayerProps {
  game: GameItem;
  onExit: () => void;
  onOpenAirPlay?: () => void;
}

export const GamePlayer: React.FC<GamePlayerProps> = ({ game, onExit, onOpenAirPlay }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadKey, setLoadKey] = useState<number>(0);
  const [isIframeLoaded, setIsIframeLoaded] = useState<boolean>(false);
  const [isLandscapeForced, setIsLandscapeForced] = useState<boolean>(false);

  // Picture viewer controls
  const [picScale, setPicScale] = useState<number>(1);
  const [picRotation, setPicRotation] = useState<number>(0);

  // Determine actual file nature
  const isPicture =
    game.fileType === 'picture' ||
    /\.(png|jpe?g|webp|gif|svg|bmp|ico|heic|heif|avif|tiff)$/i.test(game.filename || '');

  const isWebGame =
    !isPicture &&
    (Boolean(game.webUrl || game.gameUrl || game.storageUrl) ||
      game.fileType === 'html' ||
      Boolean(game.htmlContent));

  const coverUrl =
    game.thumbnailUrl ||
    game.iconDataUrl ||
    game.mediaUrl ||
    (isPicture && game.storageUrl ? game.storageUrl : null);

  const directFileUrl = game.storageUrl || `/api/games/${game.id}/download`;

  // Record play count dynamically
  useEffect(() => {
    if (game.id) {
      recordGamePlay(game.id);
    }
  }, [game.id]);

  // Auto-trigger FULL-SCREEN LANDSCAPE mode when opening game
  useEffect(() => {
    if (!isPicture) {
      // 1. Attempt Native Fullscreen
      const docEl = document.documentElement;
      if (!document.fullscreenElement && docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      }

      // 2. Lock device orientation to Full-Screen Landscape if supported
      try {
        const orientation =
          (screen as any).orientation ||
          (screen as any).mozOrientation ||
          (screen as any).msOrientation;
        if (orientation && orientation.lock) {
          orientation
            .lock('landscape')
            .catch(() => orientation.lock('landscape-primary').catch(() => {}));
        }
      } catch (err) {
        console.warn('[Orientation lock notice]:', err);
      }
    }

    // On unmount / exit: return device orientation back to portrait mode and exit fullscreen
    return () => {
      try {
        const orientation =
          (screen as any).orientation ||
          (screen as any).mozOrientation ||
          (screen as any).msOrientation;
        if (orientation && orientation.unlock) {
          orientation.unlock();
        }
        if (orientation && orientation.lock) {
          orientation.lock('portrait').catch(() => {});
        }
      } catch (err) {
        console.warn('[Orientation unlock notice]:', err);
      }

      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isPicture]);

  // Hide loading spinner after 4 seconds max to ensure player never hangs
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsIframeLoaded(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [loadKey]);

  // Clean exit handler (Returns back to Portrait)
  const handleExit = () => {
    try {
      const orientation =
        (screen as any).orientation ||
        (screen as any).mozOrientation ||
        (screen as any).msOrientation;
      if (orientation && orientation.unlock) {
        orientation.unlock();
      }
      if (orientation && orientation.lock) {
        orientation.lock('portrait').catch(() => {});
      }
    } catch (e) {}

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    onExit();
  };

  // Safe reload
  const handleReload = () => {
    setIsIframeLoaded(false);
    setPicScale(1);
    setPicRotation(0);
    setLoadKey((prev) => prev + 1);
  };

  // Direct download file to device
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = directFileUrl;
    a.download = game.filename || `${game.title}.bin`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Determine webview source URL: Always resolve to clean unblocked direct HTML5 runner
  const webViewSrc = useMemo(() => {
    const rawUrl = game.webUrl || game.gameUrl || game.storageUrl;
    if (rawUrl) {
      return resolvePlayableGameUrl(rawUrl);
    }
    return undefined;
  }, [game.webUrl, game.gameUrl, game.storageUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col w-screen h-screen overflow-hidden select-none">
      {/* CASE 1: REAL IMAGE VIEWER (Standing Upright, Real picture preview) */}
      {isPicture ? (
        <div className="w-full h-full flex flex-col relative bg-[#07080f]">
          {/* Top Bar for Pictures */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0d0f1b]/95 backdrop-blur-xl border-b border-white/10 z-20">
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Exit Viewer</span>
            </button>
            <div className="text-xs font-bold text-white truncate max-w-xs">{game.title}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPicScale((s) => Math.min(4, s + 0.25))}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPicScale((s) => Math.max(0.4, s - 0.25))}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPicRotation((r) => (r + 90) % 360)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
            <img
              src={coverUrl || directFileUrl}
              alt={game.title}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl transition-transform duration-200"
              style={{
                transform: `scale(${picScale}) rotate(${picRotation}deg)`,
              }}
            />
          </div>
        </div>
      ) : isWebGame ? (
        /* CASE 2: SEAMLESS FULL-VIEWPORT IN-APP GAME PLAYER (WEBVIEW) */
        <div
          className="relative w-full h-full bg-black overflow-hidden transition-all duration-300"
          style={
            isLandscapeForced
              ? {
                  transform: 'rotate(90deg)',
                  transformOrigin: 'top left',
                  width: '100vh',
                  height: '100vw',
                  position: 'absolute',
                  top: 0,
                  left: '100vw',
                }
              : {}
          }
        >
          {/* Smooth, minimal "Exit Game" floating button at top-corner */}
          <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
            <button
              onClick={handleExit}
              className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/80 hover:bg-black/95 text-white/90 hover:text-white border border-white/20 hover:border-white/40 backdrop-blur-xl shadow-2xl transition-all active:scale-95 cursor-pointer"
              title="Exit Game and return to Portrait view"
            >
              <X className="w-4 h-4 text-rose-400 group-hover:rotate-90 transition-transform" />
              <span className="text-xs font-extrabold tracking-wide">Exit Game</span>
            </button>

            {/* Quick Reload in case user wants to restart */}
            <button
              onClick={handleReload}
              className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border border-white/15 backdrop-blur-xl transition-all cursor-pointer"
              title="Restart Game"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Force Landscape Orientation Toggle (Essential for iOS Safari where native orientation lock is restricted) */}
            <button
              onClick={() => setIsLandscapeForced((prev) => !prev)}
              className={`p-2 rounded-full border backdrop-blur-xl transition-all cursor-pointer flex items-center gap-1.5 px-3 text-xs font-bold ${
                isLandscapeForced
                  ? 'bg-indigo-600/90 text-white border-indigo-400'
                  : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border-white/15'
              }`}
              title="Toggle Full-Screen Landscape View"
            >
              <RotateCw className="w-3.5 h-3.5 text-indigo-300" />
              <span>{isLandscapeForced ? 'Portrait' : 'Landscape'}</span>
            </button>

            {/* AirPlay Screen Mirroring & TV Cast button */}
            {onOpenAirPlay && (
              <button
                onClick={onOpenAirPlay}
                className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border border-white/15 backdrop-blur-xl transition-all cursor-pointer flex items-center gap-1.5 px-3 text-xs font-bold"
                title="Cast Game to Apple TV via AirPlay"
              >
                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                <span>AirPlay</span>
              </button>
            )}
          </div>

          {/* Loading Indicator */}
          {!isIframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#06070e] z-20">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="logo"
                  className="w-20 h-20 rounded-2xl object-cover shadow-2xl animate-pulse ring-2 ring-indigo-500/40"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl animate-pulse">
                  🎮
                </div>
              )}
              <div className="text-lg font-black text-white tracking-wide">{game.title}</div>
              <div className="text-xs text-indigo-400 flex items-center gap-2 font-medium">
                <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span>Launching into Full-Screen Landscape...</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Native HTML5 touch &amp; joystick controls enabled
              </div>
            </div>
          )}

          {/* 
            Full-Viewport In-App WebView.
            NO custom injected overlay controls — allows the web game to use its OWN built-in native touch/virtual controls.
            Loads direct unblocked HTML5 runner URL without proxy loops or container restarts.
          */}
          <iframe
            key={`${game.id}-${loadKey}`}
            ref={iframeRef}
            src={webViewSrc}
            srcDoc={!webViewSrc && game.htmlContent ? game.htmlContent : undefined}
            title={game.title}
            onLoad={() => setIsIframeLoaded(true)}
            className="w-full h-full border-none bg-black block touch-auto"
            allow="autoplay; fullscreen; accelerometer; gyroscope; gamepad; cross-origin-isolated; pointer-lock"
          />
        </div>
      ) : (
        /* CASE 3: NATIVE APK/IPA DOWNLOAD VIEW */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#090b14]">
          <div className="max-w-md w-full p-6 bg-[#111422] border border-white/10 rounded-3xl text-center space-y-4 shadow-2xl">
            {coverUrl && (
              <img src={coverUrl} alt="icon" className="w-20 h-20 mx-auto rounded-2xl object-cover" />
            )}
            <h3 className="text-lg font-bold text-white">{game.title}</h3>
            <p className="text-xs text-slate-400 font-mono">{game.filename}</p>
            <button
              onClick={handleDownload}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" />
              <span>Download File ({formatBytes(game.fileSize)})</span>
            </button>
            <button
              onClick={handleExit}
              className="w-full py-2.5 text-xs text-slate-400 hover:text-white"
            >
              Back to Catalog
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
