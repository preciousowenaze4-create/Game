import React, { useEffect, useState } from 'react';
import { Flame, Tv, Smartphone } from 'lucide-react';
import { StorageStats } from '../types/game';
import { formatBytes } from '../utils/db';

interface HeaderProps {
  stats: StorageStats;
  onOpenAirPlayModal: () => void;
  onOpenTvScreen: () => void;
  onOpenController: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onOpenAirPlayModal,
  onOpenTvScreen,
  onOpenController,
}) => {
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/supabase/status')
      .then((r) => r.json())
      .then((data) => setSupabaseConnected(Boolean(data.connected)))
      .catch(() => setSupabaseConnected(false));
  }, []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-1 border-b border-red-950/60">
      {/* Brand & Stats in Dark Crimson Red */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-600/40 ring-1 ring-red-400/40 shrink-0">
          <Flame className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-tight text-white leading-tight">
              Game Center <span className="text-red-500">PRO</span>
            </h1>
            {supabaseConnected && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                Supabase Active
              </span>
            )}
            {stats.apkCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shadow-sm shadow-red-600/30">
                {stats.apkCount} APK
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-red-200/60 mt-0.5">
            <span>Unity 3D Car Sim</span>
            <span aria-hidden="true" className="text-red-900">
              ·
            </span>
            <span className="font-mono text-red-300">
              {stats.totalGames} {stats.totalGames === 1 ? 'file' : 'files'}
            </span>
          </div>
        </div>
      </div>

      {/* Screen Mode Switches: TV Display Screen + iPhone Controller */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenTvScreen}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 border border-red-400/50 rounded-xl shadow-md shadow-red-600/30 transition-all cursor-pointer"
          title="Open TV Display Screen with Room Pairing Code"
        >
          <Tv className="w-3.5 h-3.5" />
          <span>TV Screen</span>
        </button>

        <button
          onClick={onOpenController}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-100 bg-red-950/80 hover:bg-red-900 active:scale-95 border border-red-700/60 rounded-xl shadow-md transition-all cursor-pointer"
          title="Open iPhone Touch Gamepad Controller"
        >
          <Smartphone className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden sm:inline">iPhone Controller</span>
        </button>

        <button
          onClick={onOpenAirPlayModal}
          className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-red-300 hover:text-white bg-black/40 hover:bg-red-950/60 active:scale-95 border border-red-900/60 rounded-xl transition-all cursor-pointer"
          title="AirPlay Cast"
        >
          <span className="text-[11px]">AirPlay</span>
        </button>
      </div>
    </header>
  );
};
