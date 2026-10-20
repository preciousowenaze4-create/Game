import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface EditGameModalProps {
  isOpen: boolean;
  initialTitle: string;
  gameId: string;
  onSave: (id: string, newTitle: string) => void;
  onClose: () => void;
}

export const EditGameModal: React.FC<EditGameModalProps> = ({
  isOpen,
  initialTitle,
  gameId,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(initialTitle);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(gameId, title.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm bg-[#121522] border border-white/10 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
          <h3 className="text-sm font-bold text-white">Rename Game</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Game Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a10] border border-white/10 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
              placeholder="Enter game title..."
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
