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
  Wifi,
  ExternalLink,
} from 'lucide-react';
import { AirPlayDevice } from '../types/airplay';
import { airPlayService } from '../services/airplayService';
import { GameItem } from '../types/game';

interface AirPlayRemoteControllerProps {
  device?: AirPlayDevice | null;
  currentGame: GameItem | null;
  onDisconnect: () => void;
}

export const AirPlayRemoteController: React.FC<AirPlayRemoteControllerProps> = ({
  device,
  currentGame,
  onDisconnect,
}) => {
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [activeGesture, setActiveGesture] = useState<string>('Ready');
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const trackpadRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Trigger brief haptic vibration if supported on device
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  };

  // Dispatch key to TV receiver
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
    setActiveGesture('Touching');
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

    // Send touch movement vector to TV
    airPlayService.sendCommand({
      type: 'TOUCH_MOVE',
      deltaX: Math.round(dx),
      deltaY: Math.round(dy),
    });

    // Send directional steering keys if movement is significant
    if (Math.abs(dx) > 30) {
      if (dx > 0) {
        sendKey('ArrowRight', 'ArrowRight', true, 39);
        sendKey('ArrowLeft', 'ArrowLeft', false, 37);
      } else {
        sendKey('ArrowLeft', 'ArrowLeft', true, 37);
        sendKey('ArrowRight', 'ArrowRight', false, 39);
      }
    } else {
      sendKey('ArrowRight', 'ArrowRight', false, 39);
      sendKey('ArrowLeft', 'ArrowLeft', false, 37);
    }

    if (Math.abs(dy) > 30) {
      if (dy > 0) {
        sendKey('ArrowDown', 'ArrowDown', true, 40);
        sendKey('ArrowUp', 'ArrowUp', false, 38);
      } else {
        sendKey('ArrowUp', 'ArrowUp', true, 38);
        sendKey('ArrowDown', 'ArrowDown', false, 40);
      }
    } else {
      sendKey('ArrowUp', 'ArrowUp', false, 38);
      sendKey('ArrowDown', 'ArrowDown', false, 40);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchPos(null);
    if (!touchStartRef.current) return;

    const duration = Date.now() - touchStartRef.current.time;
    const touch = e.changedTouches[0];
    const dx = touch ? touch.clientX - touchStartRef.current.x : 0;
    const dy = touch ? touch.clientY - touchStartRef.current.y : 0;

    // Release any directional keys held during move
    sendKey('ArrowRight', 'ArrowRight', false, 39);
    sendKey('ArrowLeft', 'ArrowLeft', false, 37);
    sendKey('ArrowUp', 'ArrowUp', false, 38);
    sendKey('ArrowDown', 'ArrowDown', false, 40);

    // Tap detection (< 250ms and < 15px movement)
    if (duration < 250 && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
      triggerHaptic(25);
      setActiveGesture('Tap (Select)');
      airPlayService.sendCommand({
        type: 'TOUCH_TAP',
        gesture: 'tap',
      });
      // Also send Space / Enter tap
      sendKey('Space', ' ', true, 32);
      setTimeout(() => sendKey('Space', ' ', false, 32), 120);
    } else if (Math.abs(dx) > 40 || Math.abs(dy) > 40) {
      // Swipe gestures
      if (Math.abs(dx) > Math.abs(dy)) {
        const gesture = dx > 0 ? 'swipe-right' : 'swipe-left';
        setActiveGesture(gesture);
        airPlayService.sendCommand({ type: 'GESTURE', gesture });
      } else {
        const gesture = dy > 0 ? 'swipe-down' : 'swipe-up';
        setActiveGesture(gesture);
        airPlayService.sendCommand({ type: 'GESTURE', gesture });
      }
    }

    touchStartRef.current = null;
    setTimeout(() => setActiveGesture('Ready'), 1500);
  };

  // Device orientation / Gyro tilt control
  useEffect(() => {
    if (!tiltEnabled || typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma || 0; // Left-to-right tilt [-90, 90]
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
  }, [tiltEnabled]);

  const tvReceiverUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tv?game=${encodeURIComponent(currentGame?.webUrl || currentGame?.gameUrl || '')}`
    : '#';

  return (
    <div className="fixed inset-0 z-50 bg-[#f8fafc] text-slate-900 flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden font-sans">
      {/* 
        1. TOP BAR:
        Clean status badge, game title, and prominent "Disconnect AirPlay" button
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
                AirPlay Active
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate max-w-[170px]">
              {currentGame?.title || 'AirPlay Screen Mirroring'}
            </div>
          </div>
        </div>

        {/* Clean Disconnect AirPlay Button */}
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Power className="w-3.5 h-3.5" />
          <span>Disconnect</span>
        </button>
      </div>

      {/* 
        2. TOUCH-SENSITIVE TRACKPAD / GESTURE ZONE:
        Transforms the iPhone into a tactile wireless surface
      */}
      <div className="flex-1 my-3 flex flex-col">
        <div
          ref={trackpadRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 w-full bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col items-center justify-center overflow-hidden cursor-crosshair touch-none"
        >
          {/* Subtle Trackpad Texture Grid */}
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Touch Reticle Follower */}
          {touchPos && (
            <div
              className="absolute w-16 h-16 -ml-8 -mt-8 rounded-full bg-indigo-500/15 border-2 border-indigo-500 pointer-events-none transition-transform duration-75 flex items-center justify-center"
              style={{
                left: `${touchPos.x}px`,
                top: `${touchPos.y}px`,
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
            </div>
          )}

          {/* Trackpad Center Hint */}
          <div className="pointer-events-none text-center space-y-2 z-10">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
              <Compass className="w-6 h-6 text-indigo-500 animate-pulse" />
            </div>
            <div className="text-xs font-bold text-slate-700 tracking-wide">
              Wireless Touchpad &amp; Gesture Zone
            </div>
            <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
              Swipe to steer / look • Tap to select / accelerate
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-mono text-slate-600 font-semibold border border-slate-200">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Gesture: {activeGesture}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 
        3. PRECISION D-PAD & GAME ACTION BUTTONS:
        Gives full tactile gamepad control for any racing, arcade, or action game
      */}
      <div className="bg-white p-3.5 rounded-3xl border border-slate-200/90 shadow-md space-y-3">
        <div className="grid grid-cols-2 gap-3 items-center">
          {/* Left: Directional D-Pad */}
          <div className="flex flex-col items-center gap-1">
            <button
              onPointerDown={() => sendKey('ArrowUp', 'ArrowUp', true, 38)}
              onPointerUp={() => sendKey('ArrowUp', 'ArrowUp', false, 38)}
              onPointerLeave={() => sendKey('ArrowUp', 'ArrowUp', false, 38)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold transition-all active:scale-90 ${
                activeKeys.has('ArrowUp')
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ArrowUp className="w-5 h-5" />
            </button>
            <div className="flex gap-1">
              <button
                onPointerDown={() => sendKey('ArrowLeft', 'ArrowLeft', true, 37)}
                onPointerUp={() => sendKey('ArrowLeft', 'ArrowLeft', false, 37)}
                onPointerLeave={() => sendKey('ArrowLeft', 'ArrowLeft', false, 37)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold transition-all active:scale-90 ${
                  activeKeys.has('ArrowLeft')
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onPointerDown={() => sendKey('ArrowDown', 'ArrowDown', true, 40)}
                onPointerUp={() => sendKey('ArrowDown', 'ArrowDown', false, 40)}
                onPointerLeave={() => sendKey('ArrowDown', 'ArrowDown', false, 40)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold transition-all active:scale-90 ${
                  activeKeys.has('ArrowDown')
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                onPointerDown={() => sendKey('ArrowRight', 'ArrowRight', true, 39)}
                onPointerUp={() => sendKey('ArrowRight', 'ArrowRight', false, 39)}
                onPointerLeave={() => sendKey('ArrowRight', 'ArrowRight', false, 39)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold transition-all active:scale-90 ${
                  activeKeys.has('ArrowRight')
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right: Action Buttons (A, B, Handbrake, Nitro) */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onPointerDown={() => sendKey('Space', ' ', true, 32)}
              onPointerUp={() => sendKey('Space', ' ', false, 32)}
              onPointerLeave={() => sendKey('Space', ' ', false, 32)}
              className={`py-3 rounded-2xl flex flex-col items-center justify-center border font-bold transition-all active:scale-90 ${
                activeKeys.has('Space')
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className="text-sm font-black">A</span>
              <span className="text-[9px] font-semibold opacity-75">Gas / Jump</span>
            </button>

            <button
              onPointerDown={() => sendKey('KeyX', 'x', true, 88)}
              onPointerUp={() => sendKey('KeyX', 'x', false, 88)}
              onPointerLeave={() => sendKey('KeyX', 'x', false, 88)}
              className={`py-3 rounded-2xl flex flex-col items-center justify-center border font-bold transition-all active:scale-90 ${
                activeKeys.has('KeyX')
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="text-sm font-black">B</span>
              <span className="text-[9px] font-semibold opacity-75">Brake / Rev</span>
            </button>

            <button
              onPointerDown={() => sendKey('ShiftLeft', 'Shift', true, 16)}
              onPointerUp={() => sendKey('ShiftLeft', 'Shift', false, 16)}
              onPointerLeave={() => sendKey('ShiftLeft', 'Shift', false, 16)}
              className="py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 active:scale-95"
            >
              Gear Up
            </button>

            <button
              onPointerDown={() => sendKey('ControlLeft', 'Control', true, 17)}
              onPointerUp={() => sendKey('ControlLeft', 'Control', false, 17)}
              onPointerLeave={() => sendKey('ControlLeft', 'Control', false, 17)}
              className="py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 active:scale-95"
            >
              Handbrake
            </button>
          </div>
        </div>

        {/* Bottom Aux Row: Tilt Steering, Sound, TV Screen Direct Link */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-600">
          <button
            onClick={() => setTiltEnabled(!tiltEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer ${
              tiltEnabled
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Tilt: {tiltEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => {
              setIsMuted(!isMuted);
              airPlayService.sendCommand({
                type: 'KEY_DOWN',
                code: 'KeyM',
                key: 'm',
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-semibold cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'Muted' : 'Audio ON'}</span>
          </button>

          {/* Open TV Receiver URL link */}
          <a
            href={tvReceiverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-100"
            title="Open direct TV screen view in a new window or browser"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>TV Screen</span>
          </a>
        </div>
      </div>
    </div>
  );
};
