import React, { useEffect, useRef, useState } from 'react';
import {
  Smartphone,
  Tv,
  Wifi,
  Sparkles,
  RotateCcw,
  Compass,
  ArrowLeft,
  ArrowRight,
  Flame,
  Zap,
  Volume2,
  VolumeX,
  Maximize2,
  CheckCircle2,
  LogOut,
  Car,
} from 'lucide-react';
import { realtimePairing } from '../services/realtimePairing';
import { ControllerInputState } from '../types/realtime';

interface IPhoneControllerScreenProps {
  onExit?: () => void;
  initialRoomCode?: string;
}

export const IPhoneControllerScreen: React.FC<IPhoneControllerScreenProps> = ({
  onExit,
  initialRoomCode,
}) => {
  const [roomInput, setRoomInput] = useState<string>(initialRoomCode || '');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeRoom, setActiveRoom] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [tiltSteering, setTiltSteering] = useState<boolean>(false);

  // Active Controller Input State
  const [steering, setSteering] = useState<number>(0);
  const [isGas, setIsGas] = useState<boolean>(false);
  const [isBrake, setIsBrake] = useState<boolean>(false);
  const [isDrift, setIsDrift] = useState<boolean>(false);
  const [isBoost, setIsBoost] = useState<boolean>(false);

  // Touch tracking for steering wheel
  const wheelRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Auto-connect if initialRoomCode provided in URL
  useEffect(() => {
    if (initialRoomCode && initialRoomCode.trim()) {
      handleConnect(initialRoomCode.trim());
    }
  }, [initialRoomCode]);

  // Subscribe to realtime pairing events
  useEffect(() => {
    const unsub = realtimePairing.subscribe({
      onPaired: (info) => {
        setIsConnected(true);
        setIsConnecting(false);
        setActiveRoom(info.roomCode);
        triggerHaptic(40);
      },
      onDisconnect: () => {
        setIsConnected(false);
        setIsConnecting(false);
        triggerHaptic(20);
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

  // Haptic feedback helper
  const triggerHaptic = (ms = 15) => {
    if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  // Connect to TV Room via Supabase Realtime
  const handleConnect = (codeToConnect = roomInput) => {
    const cleanCode = codeToConnect.toUpperCase().trim();
    if (!cleanCode) return;

    setIsConnecting(true);
    realtimePairing.connectController(cleanCode, 'iPhone 15 Pro');
  };

  // Broadcast input packet whenever driving controls change
  useEffect(() => {
    if (!isConnected) return;

    const inputState: ControllerInputState = {
      steering,
      gas: isGas ? 1 : 0,
      brake: isBrake ? 1 : 0,
      drift: isDrift,
      boost: isBoost,
      reset: false,
      timestamp: Date.now(),
    };

    realtimePairing.sendControllerInput(inputState);
  }, [steering, isGas, isBrake, isDrift, isBoost, isConnected]);

  // Motion Gyroscope / Tilt Steering handler
  useEffect(() => {
    if (!tiltSteering || !isConnected) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma || 0; // left/right tilt (-90 to 90)
      const clamped = Math.max(-45, Math.min(45, gamma));
      const normalized = clamped / 45; // -1 to +1
      setSteering(parseFloat(normalized.toFixed(2)));
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [tiltSteering, isConnected]);

  // Steering Wheel Touch Handlers
  const handleWheelTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    triggerHaptic(10);
  };

  const handleWheelTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0 || !touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    // Maximum drag distance 100px = full steer
    const normalized = Math.max(-1, Math.min(1, dx / 80));
    setSteering(parseFloat(normalized.toFixed(2)));
  };

  const handleWheelTouchEnd = () => {
    touchStartRef.current = null;
    // Spring back smoothly to center
    setSteering(0);
    triggerHaptic(10);
  };

  // Disconnect handler
  const handleDisconnect = () => {
    realtimePairing.disconnect();
    setIsConnected(false);
    setIsConnecting(false);
  };

  // =========================================================================
  // SCREEN 1: ROOM CODE INPUT (Connect to TV)
  // =========================================================================
  if (!isConnected) {
    return (
      <div className="min-h-screen w-full bg-[#080305] text-red-50 flex flex-col items-center justify-between p-6 select-none relative overflow-hidden">
        {/* Ambient Dark Crimson Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-red-600/15 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Header */}
        <header className="w-full max-w-md flex items-center justify-between z-10 border-b border-red-950/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-600/40">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white leading-tight">
                iPhone <span className="text-red-500">Controller</span>
              </h1>
              <p className="text-[11px] text-red-300/60">Unity WebGL 3D Car Gamepad</p>
            </div>
          </div>

          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 text-xs border border-red-800/50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </header>

        {/* Room Code Form */}
        <main className="w-full max-w-sm flex flex-col items-center justify-center text-center my-auto z-10 py-6">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-700/60 flex items-center justify-center mb-4 shadow-xl shadow-red-950/80">
            <Tv className="w-8 h-8 text-red-500" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight mb-1">Pair with TV Screen</h2>
          <p className="text-xs text-red-200/70 mb-6">
            Enter the 6-character room code displayed on your TV screen to transform this phone into a
            zero-lag gamepad.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnect();
            }}
            className="w-full flex flex-col gap-4"
          >
            <div className="relative">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="CAR-784"
                maxLength={10}
                required
                className="w-full py-4 px-6 text-center text-2xl font-mono font-black tracking-widest text-white bg-black/60 border-2 border-red-800/80 focus:border-red-500 rounded-2xl outline-none shadow-inner transition-all placeholder:text-red-900/40"
              />
            </div>

            <button
              type="submit"
              disabled={isConnecting || !roomInput.trim()}
              className="w-full py-4 text-base font-extrabold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 active:scale-95 disabled:opacity-50 rounded-2xl shadow-xl shadow-red-600/40 border border-red-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting to Supabase...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  <span>Connect to TV</span>
                </>
              )}
            </button>
          </form>

          {/* Feature highlights */}
          <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-red-300/60">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Lag Realtime</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />
              <span>Haptic Feedback</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Tilt Steering</span>
            </span>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full max-w-sm text-center text-[11px] text-red-400/50 z-10 border-t border-red-950/60 pt-4">
          Target Game: Unity WebGL Car Simulation
        </footer>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: TOUCH VIRTUAL GAMEPAD LAYOUT (Steering, Gas, Brake, Drift)
  // =========================================================================
  const steeringDegrees = Math.round(steering * 45);

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-[#070305] text-red-50 flex flex-col justify-between p-3 select-none touch-none overflow-hidden">
      {/* Top Controller Status Bar */}
      <header className="flex items-center justify-between bg-black/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-red-800/60 shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-white font-mono">TV: {activeRoom}</span>
          <span className="text-[10px] text-red-300/70 font-mono">
            {latencyMs ? `${latencyMs}ms` : '< 5ms'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Gyro Tilt Toggle */}
          <button
            onClick={() => {
              triggerHaptic(20);
              setTiltSteering(!tiltSteering);
            }}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              tiltSteering
                ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/40'
                : 'bg-red-950/60 text-red-300 border-red-800/50'
            }`}
          >
            {tiltSteering ? 'Tilt: ON' : 'Tilt: OFF'}
          </button>

          {/* Haptic Toggle */}
          <button
            onClick={() => setHapticsEnabled(!hapticsEnabled)}
            className="p-1.5 rounded-lg bg-red-950/60 text-red-300 border border-red-800/50"
            title="Toggle Haptics"
          >
            {hapticsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-200 cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* Main Touch Gamepad Controls Area */}
      <main className="flex-1 w-full grid grid-cols-2 gap-3 my-2 min-h-0">
        {/* ================================================================= */}
        {/* LEFT ZONE: STEERING (Wheel / Analog Thumbstick + Touch Paddles)   */}
        {/* ================================================================= */}
        <div className="flex flex-col items-center justify-between p-3 rounded-3xl bg-gradient-to-b from-red-950/20 to-black/60 border border-red-900/40 relative">
          <div className="text-[11px] font-bold uppercase tracking-wider text-red-400">
            Steering: <span className="font-mono text-white">{steeringDegrees}°</span>
          </div>

          {/* Interactive Touch Steering Wheel */}
          <div
            ref={wheelRef}
            onTouchStart={handleWheelTouchStart}
            onTouchMove={handleWheelTouchMove}
            onTouchEnd={handleWheelTouchEnd}
            onMouseDown={() => {}}
            className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-red-600/70 bg-gradient-to-b from-[#1c080e] to-[#0c0406] shadow-2xl shadow-red-950 flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-75 select-none"
            style={{ transform: `rotate(${steeringDegrees}deg)` }}
          >
            {/* Wheel Spokes & Center Logo */}
            <div className="absolute inset-2 rounded-full border-2 border-red-500/20" />
            <div className="w-14 h-14 rounded-full bg-red-900/60 border-2 border-red-400 flex items-center justify-center shadow-inner">
              <Compass className="w-7 h-7 text-white" />
            </div>
            {/* Top Center Marker */}
            <div className="absolute top-1 w-3 h-3 bg-red-500 rounded-full shadow-md shadow-red-500" />
          </div>

          {/* Left / Right Quick Steer Paddles */}
          <div className="w-full grid grid-cols-2 gap-2 mt-2">
            <button
              onTouchStart={() => {
                triggerHaptic(15);
                setSteering(-1);
              }}
              onTouchEnd={() => setSteering(0)}
              onMouseDown={() => setSteering(-1)}
              onMouseUp={() => setSteering(0)}
              className="py-3 rounded-2xl bg-red-950/70 active:bg-red-600 border border-red-800/60 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer font-bold"
            >
              <ArrowLeft className="w-5 h-5 text-red-300" />
            </button>
            <button
              onTouchStart={() => {
                triggerHaptic(15);
                setSteering(1);
              }}
              onTouchEnd={() => setSteering(0)}
              onMouseDown={() => setSteering(1)}
              onMouseUp={() => setSteering(0)}
              className="py-3 rounded-2xl bg-red-950/70 active:bg-red-600 border border-red-800/60 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer font-bold"
            >
              <ArrowRight className="w-5 h-5 text-red-300" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT ZONE: GAS, BRAKE, DRIFT, NITRO                              */}
        {/* ================================================================= */}
        <div className="flex flex-col justify-between p-3 rounded-3xl bg-gradient-to-b from-red-950/20 to-black/60 border border-red-900/40">
          {/* Tactical Action Buttons: DRIFT (Handbrake) & BOOST (Nitro) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onTouchStart={() => {
                triggerHaptic(30);
                setIsDrift(true);
              }}
              onTouchEnd={() => setIsDrift(false)}
              onMouseDown={() => setIsDrift(true)}
              onMouseUp={() => setIsDrift(false)}
              className={`py-3 px-2 rounded-2xl border font-black text-xs tracking-wider uppercase transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg ${
                isDrift
                  ? 'bg-red-600 border-red-400 text-white shadow-red-600/70 ring-2 ring-red-400'
                  : 'bg-red-950/80 border-red-800/60 text-red-300'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>DRIFT</span>
            </button>

            <button
              onTouchStart={() => {
                triggerHaptic(35);
                setIsBoost(true);
              }}
              onTouchEnd={() => setIsBoost(false)}
              onMouseDown={() => setIsBoost(true)}
              onMouseUp={() => setIsBoost(false)}
              className={`py-3 px-2 rounded-2xl border font-black text-xs tracking-wider uppercase transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg ${
                isBoost
                  ? 'bg-amber-500 border-amber-300 text-black shadow-amber-500/70 ring-2 ring-amber-300'
                  : 'bg-red-950/80 border-red-800/60 text-amber-300'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>NITRO</span>
            </button>
          </div>

          {/* Pedals: BRAKE (Reverse) and GAS (Accelerate) */}
          <div className="grid grid-cols-2 gap-2.5 my-auto py-2">
            {/* BRAKE PEDAL */}
            <button
              onTouchStart={() => {
                triggerHaptic(25);
                setIsBrake(true);
              }}
              onTouchEnd={() => setIsBrake(false)}
              onMouseDown={() => setIsBrake(true)}
              onMouseUp={() => setIsBrake(false)}
              className={`h-36 sm:h-44 rounded-3xl border-2 flex flex-col items-center justify-between p-3 select-none active:scale-95 transition-all shadow-xl cursor-pointer ${
                isBrake
                  ? 'bg-red-600 border-white text-white shadow-red-600/80 ring-4 ring-red-500'
                  : 'bg-gradient-to-b from-[#24080c] to-[#120406] border-red-700/60 text-red-300'
              }`}
            >
              <div className="text-[10px] font-black tracking-widest uppercase">REVERSE</div>
              <div className="flex flex-col gap-1 w-full px-2 opacity-50">
                <div className="h-1 bg-red-500 rounded-full" />
                <div className="h-1 bg-red-500 rounded-full" />
                <div className="h-1 bg-red-500 rounded-full" />
              </div>
              <div className="text-base font-black tracking-tight text-white">BRAKE</div>
            </button>

            {/* GAS PEDAL */}
            <button
              onTouchStart={() => {
                triggerHaptic(25);
                setIsGas(true);
              }}
              onTouchEnd={() => setIsGas(false)}
              onMouseDown={() => setIsGas(true)}
              onMouseUp={() => setIsGas(false)}
              className={`h-36 sm:h-44 rounded-3xl border-2 flex flex-col items-center justify-between p-3 select-none active:scale-95 transition-all shadow-xl cursor-pointer ${
                isGas
                  ? 'bg-gradient-to-b from-red-500 to-emerald-500 border-white text-white shadow-emerald-500/80 ring-4 ring-emerald-400'
                  : 'bg-gradient-to-b from-[#2a0b12] to-[#140508] border-red-600/70 text-red-200'
              }`}
            >
              <div className="text-[10px] font-black tracking-widest uppercase text-emerald-400">
                DRIVE
              </div>
              <div className="flex flex-col gap-1.5 w-full px-2 opacity-60">
                <div className="h-1.5 bg-red-400 rounded-full" />
                <div className="h-1.5 bg-red-400 rounded-full" />
                <div className="h-1.5 bg-red-400 rounded-full" />
                <div className="h-1.5 bg-red-400 rounded-full" />
              </div>
              <div className="text-lg font-black tracking-tight text-white drop-shadow">GAS</div>
            </button>
          </div>

          {/* Quick Respawn Button */}
          <button
            onClick={() => {
              triggerHaptic(30);
              realtimePairing.sendControllerInput(
                {
                  steering,
                  gas: isGas ? 1 : 0,
                  brake: isBrake ? 1 : 0,
                  drift: isDrift,
                  boost: isBoost,
                  reset: true,
                  timestamp: Date.now(),
                },
                [{ code: 'KeyR', key: 'r', action: 'down', keyCode: 82 }]
              );
            }}
            className="w-full py-2 rounded-xl bg-black/60 hover:bg-red-950 border border-red-900/50 text-[11px] font-bold text-red-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Respawn Car (Key R)</span>
          </button>
        </div>
      </main>

      {/* Bottom info bar */}
      <footer className="text-center text-[10px] text-red-400/60 py-1 shrink-0">
        Touch steering on left · Gas, Brake & Drift on right · Zero Lag
      </footer>
    </div>
  );
};
