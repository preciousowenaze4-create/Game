import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Plus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileCode2,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { validateAndInstallGameFile } from '../utils/apkExtractor';
import { useAuth } from '../context/AuthContext';

interface GameUploaderProps {
  onGameAdded: (game: GameItem) => void;
  onDownloadStarted?: (filename: string, size: number) => void;
}

export const GameUploader: React.FC<GameUploaderProps> = ({
  onGameAdded,
  onDownloadStarted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [stepDescription, setStepDescription] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleTriggerUpload = () => {
    // Restrict upload: user must be authenticated with Firebase Google Login
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    setErrorMessage(null);
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setInstallProgress(5);
    setStepDescription('Inspecting file contents...');
    onDownloadStarted?.(file.name, file.size);

    try {
      const installedGame = await validateAndInstallGameFile(file, (progress, step) => {
        setInstallProgress(progress);
        setStepDescription(step);
      });

      onGameAdded(installedGame);
      setSuccessMessage(`"${installedGame.title}" successfully uploaded to Supabase & installed!`);
      setTimeout(() => {
        setSuccessMessage(null);
        setIsProcessing(false);
        setInstallProgress(0);
        setStepDescription('');
      }, 2500);
    } catch (err: any) {
      console.error('File verification error:', err);
      const msg = err?.message || 'Upload failed. Please check your file and internet connection.';
      setErrorMessage(msg);
      setIsProcessing(false);
      setInstallProgress(0);
      setStepDescription('');
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="my-2">
      {/* Accepts all requested formats without restriction: APK, IPA, ZIP, HTML, PNG, JPG, GLB/GLTF */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileInputChange}
        className="hidden"
        disabled={!isAuthenticated}
      />

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTriggerUpload}
        className={`group relative overflow-hidden rounded-3xl p-6 border transition-all duration-200 cursor-pointer ${
          !isAuthenticated
            ? 'bg-[#111420]/80 hover:bg-[#141827] border-amber-500/20 hover:border-amber-500/40 shadow-lg shadow-black/40'
            : isDragging
            ? 'bg-indigo-950/40 border-indigo-500 scale-[0.99] ring-2 ring-indigo-500/30'
            : 'bg-[#111420] hover:bg-[#141827] border-white/10 hover:border-white/20 shadow-lg shadow-black/40'
        }`}
      >
        <div className="relative flex flex-col items-center text-center">
          {!isAuthenticated ? (
            /* Locked State for Unauthenticated Users */
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform mb-3 shadow-md shadow-amber-500/10">
                <Lock className="w-8 h-8" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-[11px] font-semibold mb-2 border border-amber-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Authentication Required</span>
              </div>

              <h2 className="text-base font-bold text-white tracking-tight mb-1">
                Sign in with Google to Upload Files
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                Uploads to Supabase storage are protected by Firebase Authentication. Please sign in with Google to upload APKs, IPAs, HTML5 games, and media.
              </p>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openLoginModal();
                }}
                className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-lg shadow-white/5 active:scale-95 transition-all cursor-pointer"
              >
                {/* SVG Google 'G' Logo */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Sign in with Google</span>
              </button>
            </>
          ) : (
            /* Unlocked State for Authenticated Users */
            <>
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform mb-3">
                {isProcessing ? (
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                ) : (
                  <UploadCloud className="w-8 h-8" />
                )}
              </div>

              {/* User Identity Pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[11px] font-semibold mb-2 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[200px]">Unlocked as {user?.email}</span>
              </div>

              <h2 className="text-base font-bold text-white tracking-tight mb-1">
                Install Game, App, or Media File
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                Upload any file from your device: <span className="text-amber-300 font-mono">.apk</span>,{' '}
                <span className="text-sky-300 font-mono">.ipa</span>,{' '}
                <span className="text-indigo-300 font-mono">.html</span>,{' '}
                <span className="text-indigo-300 font-mono">.zip</span>,{' '}
                <span className="text-emerald-300 font-mono">.png/.jpg</span>, or{' '}
                <span className="text-cyan-300 font-mono">.glb</span>.
                Files are stored directly in your Supabase <span className="font-mono text-slate-200">game-files</span> bucket.
              </p>

              {isProcessing ? (
                <div className="w-full max-w-xs my-2 p-3.5 rounded-2xl bg-[#090a10] border border-white/10 text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5 truncate max-w-[200px]">
                      <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{stepDescription || 'Uploading to Supabase...'}</span>
                    </span>
                    <span className="text-indigo-400 font-bold tabular-nums shrink-0">{installProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-200"
                      style={{ width: `${installProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerUpload();
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Choose File from Device</span>
                </button>
              )}
            </>
          )}

          {/* Quick file format pills */}
          <div className="flex items-center gap-1.5 mt-4 text-[11px] text-slate-400 flex-wrap justify-center">
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5">Android APK</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5">iOS IPA</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5">HTML5 Web Game</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5">Photos & Art</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5">3D GLB/GLTF</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTriggerUpload();
              }}
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-200 text-[11px] font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
