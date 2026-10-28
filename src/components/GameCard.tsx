import React, { useState } from 'react';
import {
  Play,
  Trash2,
  Edit2,
  Download,
  MoreVertical,
  Flame,
  Sparkles,
  Rocket,
  Zap,
  Gamepad2,
  Smartphone,
  FileCode2,
  Image as ImageIcon,
  Box,
  Apple,
  HardDriveDownload,
  Eye,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { formatBytes } from '../utils/db';
import { startOrResumeDownload } from '../utils/resumableDownloader';

interface GameCardProps {
  game: GameItem;
  onPlay: (game: GameItem) => void;
  onDelete: (id: string, title: string) => void;
  onRename: (id: string, currentTitle: string) => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  onPlay,
  onDelete,
  onRename,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Render appropriate cover image / thumbnail / icon
  const renderIcon = () => {
    const coverUrl =
      game.iconDataUrl ||
      game.mediaUrl ||
      (game.fileType === 'picture' && game.storageUrl ? game.storageUrl : null);

    if (coverUrl) {
      return (
        <img
          src={coverUrl}
          alt={game.title}
          className="w-full h-full object-cover rounded-2xl"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }

    if (game.fileType === 'picture') {
      return <ImageIcon className="w-6 h-6 text-emerald-300" />;
    }

    if (game.fileType === '3d') {
      return <Box className="w-6 h-6 text-cyan-300" />;
    }

    if (game.fileType === 'ipa') {
      return <Apple className="w-6 h-6 text-sky-300" />;
    }

    if (game.fileType === 'apk') {
      return <Smartphone className="w-6 h-6 text-amber-300" />;
    }

    return <Gamepad2 className="w-6 h-6 text-white" />;
  };

  // Direct download using Supabase public URL or backend download endpoint
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);

    // If public Supabase storage URL exists, trigger direct download
    if (game.storageUrl && game.storageUrl.startsWith('http')) {
      const a = document.createElement('a');
      a.href = game.storageUrl;
      a.download = game.filename || `${game.title}.bin`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Direct endpoint download
    window.location.href = `/api/games/${game.id}/download`;
  };

  const formattedDate = new Date(game.addedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const isPicture = game.fileType === 'picture';
  const isWebGame = game.fileType === 'html' || (game.fileType === 'zip' && game.apkDetails?.hasEmbeddedHtml);

  return (
    <div className="group relative flex items-center gap-3.5 p-3.5 bg-[#12070a] hover:bg-[#1c0d12] border border-red-950/60 hover:border-red-600/40 rounded-2xl transition-all duration-150 shadow-md shadow-black/50">
      {/* Game/Media Thumbnail with actual image or app icon */}
      <div
        className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${
          game.accentGradient || 'from-red-600 to-rose-800'
        } flex items-center justify-center shrink-0 shadow-lg ring-1 ring-red-500/20 overflow-hidden cursor-pointer active:scale-95 transition-transform`}
        onClick={() => onPlay(game)}
      >
        {renderIcon()}
      </div>

      {/* Game/Media Details */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3
            onClick={() => onPlay(game)}
            className="text-sm font-semibold text-white tracking-tight truncate leading-snug cursor-pointer hover:text-red-400 transition-colors"
          >
            {game.title}
          </h3>

          {/* Format Badges */}
          {game.fileType === 'apk' && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              APK
            </span>
          )}
          {game.fileType === 'ipa' && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
              IPA
            </span>
          )}
          {game.fileType === 'html' && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
              HTML5
            </span>
          )}
          {isPicture && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              Photo
            </span>
          )}
          {game.fileType === '3d' && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
              3D GLB
            </span>
          )}
        </div>

        {/* Clean Metadata */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
          <span className="font-mono text-slate-300">{formatBytes(game.fileSize)}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{formattedDate}</span>
          {game.storageUrl && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-[10px] text-emerald-400 font-semibold">Supabase Stored</span>
            </>
          )}
        </div>
      </div>

      {/* Actions: Direct Download, Play/View, and Delete */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Real Download Button with direct Supabase public URL */}
        <button
          onClick={handleDownload}
          className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl transition-all cursor-pointer"
          title={`Download ${game.filename} directly to device`}
          aria-label={`Download ${game.title}`}
        >
          <Download className="w-4 h-4 text-emerald-400" />
        </button>

        {/* Play / View / Install Button */}
        <button
          onClick={() => onPlay(game)}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-white font-bold text-xs tracking-wide rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer ${
            isPicture
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
              : game.fileType === 'ipa' || game.fileType === 'apk'
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
              : game.fileType === '3d'
              ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-950/40'
              : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-950/50'
          }`}
          aria-label={`Open ${game.title}`}
        >
          {isPicture ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>VIEW</span>
            </>
          ) : game.fileType === 'apk' || game.fileType === 'ipa' ? (
            <>
              <Smartphone className="w-3.5 h-3.5" />
              <span>INSTALL</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>PLAY</span>
            </>
          )}
        </button>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(game.id, game.title);
          }}
          className="p-2 text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/20 border border-white/5 hover:border-rose-500/30 rounded-xl active:scale-90 transition-all cursor-pointer"
          title={`Delete ${game.title}`}
          aria-label={`Delete ${game.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* More Actions Toggle */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-9 z-50 w-44 bg-[#180a0f] border border-red-900/50 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onRename(game.id, game.title);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Direct Download</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    startOrResumeDownload(game);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <HardDriveDownload className="w-3.5 h-3.5 text-red-400" />
                  <span>Resumable Download</span>
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete(game.id, game.title);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/20 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
