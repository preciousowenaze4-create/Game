import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode2, Share2, Smartphone } from 'lucide-react';
import { getStandaloneHtmlCode } from '../utils/generateStandaloneHtml';

interface StandaloneExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StandaloneExportModal: React.FC<StandaloneExportModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const code = getStandaloneHtmlCode();

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game-center.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#121522] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Single-File index.html</h2>
              <p className="text-xs text-slate-400">Complete standalone code block for iPhone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Complete Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 active:scale-95 text-slate-200 font-semibold text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download file</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Vanilla HTML/CSS/JS</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Zero dependencies</span>
          </div>
        </div>

        {/* Code Preview Box */}
        <div className="flex-1 min-h-0 bg-[#090a10] border border-white/5 rounded-2xl p-3 font-mono text-[11px] text-slate-300 overflow-auto no-scrollbar select-text">
          <pre>{code}</pre>
        </div>

        {/* iPhone Usage Guide */}
        <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-3 text-xs text-slate-300">
          <Smartphone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-white mb-0.5">How to use on your iPhone:</div>
            <div className="text-slate-400 space-y-1 text-[11px]">
              <div>1. Save <code className="text-indigo-300 font-mono">game-center.html</code> into your iPhone <strong className="text-slate-200">Files</strong> app (or host it on GitHub Pages / Vercel).</div>
              <div>2. Open the file in Safari and tap <strong className="text-slate-200">Share</strong> <Share2 className="w-3 h-3 inline text-slate-300" /> → <strong className="text-slate-200">Add to Home Screen</strong>.</div>
              <div>3. Launch it from your Home Screen for a 100% full-screen app experience with offline IndexedDB storage!</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
