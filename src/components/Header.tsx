import React, { useEffect, useState } from 'react';
import { Gamepad2, Code2, LogOut, CheckCircle2, Tv } from 'lucide-react';
import { StorageStats } from '../types/game';
import { formatBytes } from '../utils/db';
import { useAuth } from '../context/AuthContext';

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
  const { user, isAuthenticated, openLoginModal, signOut } = useAuth();
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/supabase/status')
      .then((r) => r.json())
      .then((data) => setSupabaseConnected(Boolean(data.connected)))
      .catch(() => setSupabaseConnected(false));
  }, []);

  return (
    <header className="flex items-center justify-between pb-4 pt-1 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 ring-1 ring-white/10 shrink-0">
          <Gamepad2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              Game Center Pro
            </h1>
            {supabaseConnected && (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Supabase Active
              </span>
            )}
            {stats.apkCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {stats.apkCount} APK
              </span>
            )}
            {stats.pictureCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {stats.pictureCount} Media
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>
              {stats.totalGames} {stats.totalGames === 1 ? 'file' : 'files'}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="font-mono text-slate-300">{formatBytes(stats.totalBytes)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Real Google Auth Badge & Trigger */}
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 pl-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all cursor-pointer"
              title={`Logged in as ${user.email}`}
            >
              <div className="text-left hidden sm:block">
                <div className="text-[11px] font-bold text-white leading-none truncate max-w-[100px]">
                  {user.displayName}
                </div>
                <div className="text-[9px] text-emerald-400 leading-none mt-0.5 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Google Verified
                </div>
              </div>
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`}
                alt={user.displayName || 'Google User'}
                className="w-7 h-7 rounded-xl object-cover border border-emerald-400/40"
              />
            </button>

            {/* Quick dropdown for sign out */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#111422] border border-white/10 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in">
                <div className="px-2.5 py-2 border-b border-white/5">
                  <div className="text-xs font-bold text-white truncate">{user.displayName}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{user.email}</div>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-xl text-rose-300 hover:bg-rose-500/10 text-xs transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={openLoginModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600/90 hover:bg-indigo-500 active:scale-95 border border-indigo-400/30 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {/* Small Google 'G' icon */}
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Google Login</span>
          </button>
        )}

        {/* AirPlay Screen Mirroring & TV Cast button */}
        <button
          onClick={onOpenAirPlayModal}
          className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl transition-all cursor-pointer"
          title="AirPlay Wireless Casting"
        >
          <Tv className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">AirPlay</span>
        </button>

        {/* Export / Copy Single-File HTML button */}
        <button
          onClick={onOpenExportModal}
          className="p-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl transition-all cursor-pointer"
          title="Get single-file index.html code"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
