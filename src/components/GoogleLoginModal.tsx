import React from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const GoogleLoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    closeLoginModal,
    signInWithGoogle,
    user,
    signOut,
    loginError,
    isRedirecting,
  } = useAuth();

  if (!isLoginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm bg-[#111422] border border-white/10 rounded-3xl p-6 shadow-2xl relative space-y-4">
        {/* Close Button */}
        <button
          onClick={closeLoginModal}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Google Header */}
        <div className="text-center space-y-2 pt-1">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-white/5">
            {/* Official Google 'G' Logo */}
            <svg className="w-7 h-7" viewBox="0 0 24 24">
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
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight">
            Google Account Sign-In
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Sign in with your Google account on your phone or device to protect and unlock your file uploads to Supabase.
          </p>
        </div>

        {/* Protection Notice */}
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5 text-xs text-indigo-300">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
          <div className="leading-snug">
            <span className="font-semibold text-white">Upload Protection Active: </span>
            Authenticated users can store and manage files in the Supabase <span className="font-mono text-indigo-200">game-files</span> bucket.
          </div>
        </div>

        {user ? (
          /* Real Signed In Account Card */
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`}
                alt={user.displayName || 'Google Account'}
                className="w-11 h-11 rounded-2xl object-cover border border-emerald-400/40"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="truncate">{user.displayName}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Verified
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate font-mono mt-0.5">
                  {user.email}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/5">
              <button
                onClick={closeLoginModal}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Continue to Uploads
              </button>
              <button
                onClick={signOut}
                className="px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* 1-Tap Google Sign-In (No key pasting required) */
          <div className="space-y-3">
            {loginError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 leading-relaxed">
                {loginError}
              </div>
            )}

            <button
              onClick={() => signInWithGoogle(false)}
              disabled={isRedirecting}
              className="w-full flex items-center justify-center gap-3 p-3.5 rounded-2xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-900 font-bold text-xs shadow-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
              <span className="text-[13px] font-extrabold text-slate-900">
                {isRedirecting ? 'Redirecting to Google...' : 'Sign in with Google'}
              </span>
            </button>

            <button
              onClick={() => signInWithGoogle(true)}
              disabled={isRedirecting}
              className="w-full text-center py-2 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Having popup issues? Tap to sign in via full-page redirect
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
