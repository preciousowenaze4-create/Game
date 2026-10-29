import React, { useEffect, useRef, useState } from 'react';
import {
  Tv,
  Smartphone,
  Wifi,
  Sparkles,
  Maximize2,
  Minimize2,
  LogOut,
  Car,
  Compass,
  Zap,
  Gauge,
  Flame,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { realtimePairing } from '../services/realtimePairing';
import { ControllerInputState } from '../types/realtime';

export const OFFICIAL_UNITY_CAR_SIM_URL =
  'https://play.unity.com/en/games/b8915ae5-7634-4424-93ad-73778832a84b/car-sim-test';

interface TvDisplayScreenProps {
  onExit?: () => void;
}

export const TvDisplayScreen: React.FC<TvDisplayScreenProps> = ({ onExit }) => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [lastInput, setLastInput] = useState<ControllerInputState>({
    steering: 0,
    gas: 0,
    brake: 0,
    drift: false,
    boost: false,
    reset: false,
    timestamp: Date.now(),
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());

  // Initialize room session on startup
  useEffect(() => {
    const code = realtimePairing.startTvSession();
    setRoomCode(code);

    const unsub = realtimePairing.subscribe({
      onPaired: (info) => {
        setIsPaired(true);
        setConnectedDevice(info.deviceName || 'iPhone Controller');
      },
      onInput: (input, keyEvents) => {
        setLastInput(input);
        handleIncomingInput(input, keyEvents);
      },
      onDisconnect: () => {
        setIsPaired(false);
        setConnectedDevice('');
      },
      onLatencyUpdate: (ms) => {
        setLatencyMs(ms);
      },
    });

    return () => {
      unsub();
      realtimePairing.disconnect();
    };
  }, []);

  // Dispatch synthetic keyboard events into window, document, and iframe
  const dispatchKey = (code: string, key: string, isDown: boolean, keyCode = 0) => {
    const isCurrentlyDown = activeKeysRef.current.has(code);
    if (isDown === isCurrentlyDown) return; // avoid duplicate spam

    if (isDown) {
      activeKeysRef.current.add(code);
    } else {
      activeKeysRef.current.delete(code);
    }

    const eventType = isDown ? 'keydown' : 'keyup';
    const ev = new KeyboardEvent(eventType, {
      code,
      key,
      keyCode: keyCode || (code.startsWith('Key') ? code.charCodeAt(3) : 0),
      bubbles: true,
      cancelable: true,
      composed: true,
    });

    try {
      window.dispatchEvent(ev);
      document.dispatchEvent(ev);
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'VIRTUAL_KEY',
            code,
            key,
            keyCode,
            action: isDown ? 'down' : 'up',
          },
          '*'
        );
      }
    } catch {}
  };

  // Process controller inputs (Steering, Gas, Brake, Drift, Boost)
  const handleIncomingInput = (
    input: ControllerInputState,
    keyEvents?: Array<{ code: string; key: string; action: 'down' | 'up'; keyCode?: number }>
  ) => {
    // 1. Direct keyEvents if supplied
    if (keyEvents && keyEvents.length > 0) {
      for (const k of keyEvents) {
        dispatchKey(k.code, k.key, k.action === 'down', k.keyCode);
      }
    }

    // 2. Throttle / Gas (W & ArrowUp)
    const isGas = input.gas > 0.15;
    dispatchKey('KeyW', 'w', isGas, 87);
    dispatchKey('ArrowUp', 'ArrowUp', isGas, 38);

    // 3. Brake / Reverse (S & ArrowDown)
    const isBrake = input.brake > 0.15;
    dispatchKey('KeyS', 's', isBrake, 83);
    dispatchKey('ArrowDown', 'ArrowDown', isBrake, 40);

    // 4. Steering Left (A & ArrowLeft)
    const isLeft = input.steering < -0.15;
    dispatchKey('KeyA', 'a', isLeft, 65);
    dispatchKey('ArrowLeft', 'ArrowLeft', isLeft, 37);

    // 5. Steering Right (D & ArrowRight)
    const isRight = input.steering > 0.15;
    dispatchKey('KeyD', 'd', isRight, 68);
    dispatchKey('ArrowRight', 'ArrowRight', isRight, 39);

    // 6. Drift / Handbrake (Space)
    dispatchKey('Space', ' ', Boolean(input.drift), 32);

    // 7. Boost / Nitro (ShiftLeft)
    dispatchKey('ShiftLeft', 'Shift', Boolean(input.boost), 16);

    // 8. Respawn / Reset (KeyR)
    if (input.reset) {
      dispatchKey('KeyR', 'r', true, 82);
      setTimeout(() => dispatchKey('KeyR', 'r', false, 82), 200);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const controllerUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?mode=controller&room=${encodeURIComponent(roomCode)}`
      : '';

  const copyControllerLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(controllerUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const openMobileControllerDemo = () => {
    window.open(controllerUrl, 'IPhoneController', 'width=390,height=844,menubar=no,status=no');
  };

  // =========================================================================
  // VIEW 1: PAIRING CODE SCREEN (Before iPhone connects)
  // =========================================================================
  if (!isPaired) {
    return (
      <div
        ref={containerRef}
        className="min-h-screen w-full bg-[#070305] text-red-50 flex flex-col items-center justify-between p-6 sm:p-10 select-none relative overflow-hidden"
      >
        {/* Ambient Dark Crimson Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-rose-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Top Header */}
        <header className="w-full max-w-6xl flex items-center justify-between z-10 border-b border-red-950/70 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-800 flex items-center justify-center shadow-xl shadow-red-600/40 ring-1 ring-red-400/40">
              <Tv className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  TV DISPLAY <span className="text-red-500">SCREEN</span>
                </h1>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Supabase Realtime Ready
                </span>
              </div>
              <p className="text-sm text-red-200/60 mt-1">
                Unity WebGL 3D Car Simulation · Wireless Smartphone Gamepad Host
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="px-4 py-2 text-xs font-bold text-red-200 bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <Maximize2 className="w-4 h-4 text-red-400" />
              <span>Fullscreen</span>
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="px-4 py-2 text-xs font-bold text-red-300 hover:text-white bg-black/40 hover:bg-red-950/60 border border-red-900/40 rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Exit TV Mode</span>
              </button>
            )}
          </div>
        </header>

        {/* Central Pairing Code Stage */}
        <main className="w-full max-w-4xl flex flex-col items-center justify-center text-center my-auto z-10 py-8">
          {/* Target Game Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/80 border border-red-700/50 shadow-inner text-xs font-semibold text-red-300 mb-6">
            <Car className="w-4 h-4 text-red-400" />
            <span>Target Game: Unity WebGL Car Simulation (3D Car Sim Test)</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Connect Your iPhone Controller
          </h2>
          <p className="text-sm sm:text-base text-red-200/70 max-w-xl mb-8">
            Open the controller screen on your iPhone, enter the room code below, and your phone will
            automatically transform into a zero-lag virtual touch steering wheel and pedals.
          </p>

          {/* Large Crimson Room Code Card */}
          <div className="relative group p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-[#18080c] to-[#0c0406] border-2 border-red-600/50 shadow-2xl shadow-red-950/80 ring-1 ring-red-500/20 flex flex-col items-center max-w-lg w-full mb-8">
            <span className="text-xs uppercase tracking-widest text-red-400 font-bold mb-2">
              TV Room Pairing Code
            </span>
            <div className="text-5xl sm:text-6xl font-black font-mono tracking-wider text-white drop-shadow-[0_0_25px_rgba(239,68,68,0.7)] my-2">
              {roomCode || 'CAR-SIM'}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => {
                  const newCode = realtimePairing.startTvSession();
                  setRoomCode(newCode);
                }}
                className="px-3 py-1.5 text-xs text-red-300 hover:text-white bg-red-950/80 hover:bg-red-900 border border-red-800/60 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                title="Generate New Room Code"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New Code</span>
              </button>
              <button
                onClick={copyControllerLink}
                className="px-3 py-1.5 text-xs text-red-200 hover:text-white bg-red-950/80 hover:bg-red-900 border border-red-800/60 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Waiting Radar Pulse */}
            <div className="mt-8 flex items-center gap-3 text-sm text-red-400/90 font-medium">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span>Waiting for iPhone Controller connection...</span>
            </div>
          </div>

          {/* Quick Dual-Screen Testing & Direct Play Action */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={openMobileControllerDemo}
              className="px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 rounded-xl shadow-lg shadow-red-600/30 border border-red-400/40 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Open iPhone Controller Popout</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            <button
              onClick={() => {
                setIsPaired(true);
                setConnectedDevice('Local Keyboard Control');
              }}
              className="px-5 py-3 text-sm font-bold text-red-200 hover:text-white bg-red-950/70 hover:bg-red-900/80 border border-red-800/60 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <Car className="w-4 h-4 text-red-400" />
              <span>Launch Unity Game Directly</span>
            </button>
          </div>
        </main>

        {/* Footer Features */}
        <footer className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 z-10 border-t border-red-950/60 pt-6 text-center sm:text-left">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-red-950/30 border border-red-900/30">
            <Wifi className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Supabase Realtime</div>
              <div className="text-[11px] text-red-300/60">Instant low-latency pairing broadcast</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-red-950/30 border border-red-900/30">
            <Gauge className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Zero-Lag Telemetry</div>
              <div className="text-[11px] text-red-300/60">Steering, throttle, brake & handbrake</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-red-950/30 border border-red-900/30">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">High Quality 3D Graphics</div>
              <div className="text-[11px] text-red-300/60">Full-screen official Unity WebGL build</div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: FULL-SCREEN OFFICIAL UNITY WEBGL GAMEPLAY ON TV
  // =========================================================================
  const steeringDegrees = Math.round(lastInput.steering * 45);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 w-screen h-screen bg-black overflow-hidden flex flex-col select-none"
    >
      {/* Floating Real-Time Controller Telemetry HUD */}
      <header className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Device & Pairing Status */}
        <div className="flex items-center gap-3 pointer-events-auto bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-red-800/60 shadow-2xl shadow-red-950/60">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500" />
          <div>
            <div className="text-xs font-extrabold text-white flex items-center gap-2">
              <span>{connectedDevice || 'iPhone Controller'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800/50">
                {roomCode}
              </span>
            </div>
            <div className="text-[10px] text-red-300/70 font-mono">
              Latency: {latencyMs ? `${latencyMs}ms` : '< 5ms'} · Zero Lag
            </div>
          </div>
        </div>

        {/* Center: Live Realtime Driving Visualizer */}
        <div className="hidden md:flex items-center gap-5 pointer-events-auto bg-black/80 backdrop-blur-md px-6 py-2 rounded-2xl border border-red-800/60 shadow-2xl shadow-red-950/60">
          {/* Steering Wheel Angle */}
          <div className="flex items-center gap-2">
            <Compass
              className="w-5 h-5 text-red-400 transition-transform duration-75"
              style={{ transform: `rotate(${steeringDegrees}deg)` }}
            />
            <div className="text-[11px] font-mono text-white">
              Steer: <span className="text-red-400 font-bold">{steeringDegrees}°</span>
            </div>
          </div>

          {/* Gas Throttle Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-red-300">GAS</span>
            <div className="w-16 h-2 rounded-full bg-red-950 overflow-hidden border border-red-800/50">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-emerald-400 transition-all duration-75"
                style={{ width: `${Math.round(lastInput.gas * 100)}%` }}
              />
            </div>
          </div>

          {/* Brake Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-red-400">BRAKE</span>
            <div className="w-16 h-2 rounded-full bg-red-950 overflow-hidden border border-red-800/50">
              <div
                className="h-full bg-red-500 transition-all duration-75 shadow-sm shadow-red-500"
                style={{ width: `${Math.round(lastInput.brake * 100)}%` }}
              />
            </div>
          </div>

          {/* Drift Flare Badge */}
          {lastInput.drift && (
            <div className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse shadow-lg shadow-red-600">
              DRIFT
            </div>
          )}

          {/* Boost Badge */}
          {lastInput.boost && (
            <div className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider animate-bounce shadow-lg shadow-amber-500">
              NITRO
            </div>
          )}
        </div>

        {/* Right: Fullscreen & Disconnect Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-black/80 hover:bg-red-950/80 border border-red-800/60 text-white shadow-xl transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              realtimePairing.disconnect();
              setIsPaired(false);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-700/60 text-white text-xs font-bold shadow-xl transition-all cursor-pointer"
            title="Disconnect Controller & Return to Room Code"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Pairing Screen</span>
          </button>
        </div>
      </header>

      {/* Full-Screen Unity WebGL Game Iframe */}
      <iframe
        ref={iframeRef}
        src={OFFICIAL_UNITY_CAR_SIM_URL}
        title="Unity WebGL Car Simulation Test"
        className="w-full h-full border-0 bg-black"
        allow="autoplay; fullscreen; gamepad; xr-spatial-tracking; clipboard-read; clipboard-write; encrypted-media"
        allowFullScreen
      />
    </div>
  );
};
