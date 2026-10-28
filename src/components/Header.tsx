import React, { useEffect, useState } from 'react';
import { Flame, Code2, Tv, Sparkles, Database } from 'lucide-react';
import { StorageStats } from '../types/game';
import { formatBytes } from '../utils/db';

interface HeaderProps {
  stats: StorageStats;
  onOpenExportModal: () => void;
  onOpenAirPlayModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onOpenExportModal,
  onOpenAirPlayModal,
}) => {
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/supabase/status')
      .then((r) => r.json())
      .then((data) => setSupabaseConnected(Boolean(data.connected)))
      .catch(() => setSupabaseConnected(false));
  }, []);

  return (
    <header className="flex items-center justify-between pb-4 pt-1 border-b border-red-950/60">
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
                Cloud Active
              </span>
            )}
            {stats.apkCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shadow-sm shadow-red-600/30">
                {stats.apkCount} APK
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-red-200/60 mt-0.5">
            <span>
              {stats.totalGames} {stats.totalGames === 1 ? 'game' : 'games'}
            </span>
            <span aria-hidden="true" className="text-red-900">
              ·
            </span>
            <span className="font-mono text-red-300">{formatBytes(stats.totalBytes)}</span>
          </div>
        </div>
      </div>

      {/* Right Actions: AirPlay + Export Button (Zero Google Login Barrier) */}
      <div className="flex items-center gap-2">
        {/* AirPlay Screen Mirroring & TV Cast button */}
        <button
          onClick={onOpenAirPlayModal}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-red-950/70 hover:bg-red-600/80 active:scale-95 border border-red-700/50 hover:border-red-500 rounded-xl shadow-md shadow-red-950/50 transition-all cursor-pointer"
          title="AirPlay Wireless Casting to TV"
        >
          <Tv className="w-3.5 h-3.5 text-red-400 group-hover:text-white" />
          <span className="hidden sm:inline">AirPlay</span>
        </button>

        {/* Export / Single-File Code Modal */}
        <button
          onClick={onOpenExportModal}
          className="p-2 sm:px-3 sm:py-2 text-xs font-semibold text-red-200/80 bg-red-950/40 hover:bg-red-900/40 active:scale-95 border border-red-800/30 hover:border-red-600/50 rounded-xl transition-all cursor-pointer"
          title="Export single-file HTML"
        >
          <Code2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </header>
  );
};
