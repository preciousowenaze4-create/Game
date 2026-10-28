import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Plus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileCode2,
  Sparkles,
  Smartphone,
  Image as ImageIcon,
  FolderArchive,
  Flame,
  Zap,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { validateAndInstallGameFile } from '../utils/apkExtractor';

interface GameUploaderProps {
  onGameAdded: (game: GameItem) => void;
  onDownloadStarted?: (filename: string, size: number) => void;
}

export const GameUploader: React.FC<GameUploaderProps> = ({
  onGameAdded,
  onDownloadStarted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [stepDescription, setStepDescription] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Directly open system file picker - no login required!
  const handleTriggerUpload = () => {
    setErrorMessage(null);
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setInstallProgress(10);
    setStepDescription('Reading file contents...');
    onDownloadStarted?.(file.name, file.size);

    try {
      const installedGame = await validateAndInstallGameFile(file, (progress, step) => {
        setInstallProgress(progress);
        setStepDescription(step);
      });

      onGameAdded(installedGame);
      setSuccessMessage(`"${installedGame.title}" successfully installed and ready to play!`);

      setTimeout(() => {
        setSuccessMessage(null);
        setIsProcessing(false);
        setInstallProgress(0);
        setStepDescription('');
      }, 2500);
    } catch (err: any) {
      console.error('File verification error:', err);
      const msg = err?.message || 'Upload could not be processed. Please check file format.';
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
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Quick Demo Game generator for immediate 1-click test
  const handleInstallDemoGame = () => {
    const htmlDemo = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  body { margin: 0; background: #0a0507; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; text-align: center; }
  h1 { font-size: 28px; color: #ef4444; margin-bottom: 8px; text-shadow: 0 0 20px rgba(239,68,68,0.5); }
  p { color: #fca5a5; font-size: 14px; max-width: 300px; margin-bottom: 24px; }
  .btn { padding: 14px 28px; background: linear-gradient(135deg, #ef4444, #991b1b); color: #fff; border: none; border-radius: 16px; font-weight: bold; font-size: 16px; cursor: pointer; box-shadow: 0 10px 25px rgba(239,68,68,0.4); }
  .score { font-size: 48px; font-weight: 900; color: #fff; margin: 16px 0; }
</style>
</head>
<body>
  <h1>RED SPEED RACER</h1>
  <p>Tap the turbo button to speed up!</p>
  <div class="score" id="score">0 MPH</div>
  <button class="btn" onclick="speedUp()">TAP FOR NITRO</button>
  <script>
    let speed = 0;
    function speedUp() {
      speed += 15;
      document.getElementById('score').innerText = speed + ' MPH';
    }
  </script>
</body>
</html>`;

    const blob = new Blob([htmlDemo], { type: 'text/html' });
    const file = new File([blob], 'Red-Speed-Racer.html', { type: 'text/html' });
    processFile(file);
  };

  return (
    <div className="my-2 space-y-3">
      {/* Accepts all requested formats without restriction: APK, IPA, ZIP, HTML, PNG, JPG, GLB/GLTF */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileInputChange}
        className="hidden"
      />

      {/* Main Drag & Drop Upload Zone in Dark & Crimson Red */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTriggerUpload}
        className={`group relative overflow-hidden rounded-3xl p-6 sm:p-8 border transition-all duration-300 cursor-pointer ${
          isDragging
            ? 'bg-red-950/40 border-red-500 scale-[0.99] ring-2 ring-red-500/50 shadow-2xl shadow-red-900/50'
            : 'bg-[#12070a] hover:bg-[#19090e] border-red-900/40 hover:border-red-500/60 shadow-xl shadow-black/80'
        }`}
      >
        {/* Subtle Ambient Red Glow in background */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-red-600/20 transition-colors" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-3">
          {/* Glowing Red Icon */}
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-800 text-white shadow-xl shadow-red-600/40 border border-red-400/30 group-hover:scale-105 transition-transform duration-300">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-400 animate-ping" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>Install &amp; Upload Game File</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold uppercase">
                Free &amp; Direct
              </span>
            </h3>
            <p className="text-xs text-red-200/70 mt-1 max-w-sm mx-auto">
              Tap here or drag &amp; drop any file. Instantly playable inside the app with zero login required.
            </p>
          </div>

          {/* Supported Format Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-800/40 text-[11px] font-bold text-red-200">
              <Smartphone className="w-3 h-3 text-red-400" />
              <span>APK &amp; IPA</span>
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-800/40 text-[11px] font-bold text-red-200">
              <FolderArchive className="w-3 h-3 text-red-400" />
              <span>HTML5 &amp; ZIP</span>
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-800/40 text-[11px] font-bold text-red-200">
              <ImageIcon className="w-3 h-3 text-red-400" />
              <span>Pictures</span>
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-800/40 text-[11px] font-bold text-red-200">
              <Zap className="w-3 h-3 text-red-400" />
              <span>3D Models</span>
            </span>
          </div>

          {/* Action Trigger Button */}
          <div className="pt-2">
            <button
              type="button"
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-red-600/40 flex items-center gap-2 group-hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Choose File from Device</span>
            </button>
          </div>
        </div>

        {/* Live Progress Bar when uploading */}
        {isProcessing && (
          <div className="mt-5 space-y-2 relative z-10 pt-3 border-t border-red-900/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-200 font-semibold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                <span>{stepDescription || 'Installing file...'}</span>
              </span>
              <span className="font-mono text-white font-bold">{installProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-red-900/40 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-400 rounded-full transition-all duration-200"
                style={{ width: `${Math.max(5, installProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-white text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-red-950/80 border border-red-500 text-white text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Quick 1-Click Demo File Test Option */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#14080c] border border-red-900/30 text-xs">
        <div className="flex items-center gap-2 text-red-200/80">
          <Sparkles className="w-3.5 h-3.5 text-red-400" />
          <span>Want to test upload right now?</span>
        </div>
        <button
          type="button"
          onClick={handleInstallDemoGame}
          disabled={isProcessing}
          className="px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600 border border-red-500/40 hover:border-red-400 text-white font-bold text-[11px] transition-all cursor-pointer active:scale-95"
        >
          Install Demo Game
        </button>
      </div>
    </div>
  );
};
