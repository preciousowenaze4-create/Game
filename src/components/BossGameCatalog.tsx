import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Play,
  Sparkles,
  Star,
  Flame,
  Plus,
  RefreshCw,
  Trophy,
  Gamepad2,
  Tv,
  X,
  Layers,
  ChevronDown,
  ArrowUp,
  Zap,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { fetchGamesFromSupabase, addGameToSupabase } from '../utils/supabaseCatalog';

interface BossGameCatalogProps {
  onPlayGame: (game: GameItem) => void;
}

export const BossGameCatalog: React.FC<BossGameCatalogProps> = ({ onPlayGame }) => {
  const [games, setGames] = useState<GameItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [displayCount, setDisplayCount] = useState<number>(36);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New Game Form State
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('Car & Driving');
  const [newThumbnail, setNewThumbnail] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load games dynamically from backend & Supabase
  const loadDynamicGames = async (search = searchQuery, cat = selectedCategory, showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const fetched = await fetchGamesFromSupabase(search, cat);
      if (fetched && fetched.length > 0) {
        setGames(fetched);
      }
    } catch (err) {
      console.warn('Failed to load games:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDynamicGames(searchQuery, selectedCategory, true);
  }, [selectedCategory]);

  // Debounced search query trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      loadDynamicGames(searchQuery, selectedCategory, false);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadDynamicGames(searchQuery, selectedCategory, false);
  };

  // Categories list with counts
  const categories = [
    { id: 'All', label: 'All Games', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'Car', label: 'Car & Driving', icon: <Gamepad2 className="w-3.5 h-3.5 text-red-400" /> },
    { id: 'Action', label: 'Action & Stunts', icon: <Flame className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'Multiplayer', label: 'Multiplayer .io', icon: <Trophy className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'Shooting', label: 'Shooting', icon: <Zap className="w-3.5 h-3.5 text-red-500" /> },
    { id: 'Sports', label: 'Sports & Bike', icon: <Sparkles className="w-3.5 h-3.5 text-rose-300" /> },
    { id: 'Puzzle', label: 'Mind & Puzzles', icon: <Sparkles className="w-3.5 h-3.5 text-amber-300" /> },
    { id: 'Rhythm', label: 'Rhythm & Music', icon: <Sparkles className="w-3.5 h-3.5 text-red-400" /> },
  ];

  // Dynamic search and filter
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q) ||
        (game.genre && game.genre.toLowerCase().includes(q)) ||
        (game.description && game.description.toLowerCase().includes(q));

      let matchCategory = true;
      if (selectedCategory !== 'All') {
        const catLow = selectedCategory.toLowerCase();
        matchCategory =
          game.category.toLowerCase().includes(catLow) ||
          Boolean(game.genre && game.genre.toLowerCase().includes(catLow));
      }

      return matchSearch && matchCategory;
    });
  }, [games, searchQuery, selectedCategory]);

  const visibleGames = useMemo(() => {
    return filteredGames.slice(0, displayCount);
  }, [filteredGames, displayCount]);

  // Handle Add Game submit (works directly without login)
  const handleAddGameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    setIsSubmitting(true);
    try {
      const added = await addGameToSupabase({
        title: newTitle.trim(),
        category: newCategory,
        game_url: newUrl.trim(),
        thumbnail_url: newThumbnail.trim() || undefined,
        description: newDescription.trim() || undefined,
      });

      if (added) {
        setGames((prev) => [added, ...prev]);
        setIsAddModalOpen(false);
        setNewTitle('');
        setNewUrl('');
        setNewThumbnail('');
        setNewDescription('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4 pb-16">
      {/* 
        HEADER & CONTROLS IN RED & DARK OBSIDIAN
        Clean, sticky top section with real-time Search, Category pills, and Stats
      */}
      <div className="space-y-3 bg-[#110609]/95 backdrop-blur-xl p-3.5 rounded-3xl border border-red-950/80 shadow-2xl shadow-black sticky top-0 z-30">
        {/* Top line: Search Bar + Add Game Button + Refresh Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-red-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayCount(36);
              }}
              placeholder="Search 330+ games (Drift, Stunt, .io, Car, Moto)..."
              className="w-full bg-[#170a0e] border border-red-900/40 rounded-2xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-red-300/40 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-red-600/40 transition-all cursor-pointer whitespace-nowrap active:scale-95"
            title="Add any game URL to Catalog"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Game</span>
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-2xl bg-red-950/40 hover:bg-red-900/50 border border-red-900/40 text-red-300 hover:text-white transition-all cursor-pointer"
            title="Refresh game list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-400' : ''}`} />
          </button>
        </div>

        {/* Categories Bar: Horizontal scrollable pills with Red highlights */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setDisplayCount(36);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/40 ring-1 ring-red-400'
                    : 'bg-[#180a0f] text-red-200/80 hover:text-white hover:bg-red-950/60 border border-red-950/80'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live counter bar */}
        <div className="flex items-center justify-between text-[11px] text-red-300/70 px-1 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-bold text-white">
              {filteredGames.length} Games Ready
            </span>
            <span>•</span>
            <span className="text-red-400 font-semibold">100% Free &amp; Unblocked</span>
          </div>

          <div className="text-[10px] text-red-300/80 font-mono">
            Tap any box to play
          </div>
        </div>
      </div>

      {/* 
        MAIN GAME GRID IN RED & DARK:
        "A little box arranged straight down. I can scroll them."
        Neat, compact, scrollable grid of game boxes with real logos
      */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-black text-white">Loading Game Library...</div>
          <div className="text-[11px] text-red-300/70">Connecting to real game runners &amp; logos</div>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#13070b] rounded-3xl border border-red-950/80 p-6">
          <div className="text-4xl">🎮</div>
          <h3 className="text-sm font-bold text-white">No games matched "{searchQuery}"</h3>
          <p className="text-xs text-red-300/70 max-w-sm mx-auto">
            Try searching for "Car", "Drift", "Action", "Stunt", "Slither", "Moto", or click below to reset.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs shadow-lg shadow-red-600/40 cursor-pointer"
          >
            Show All 330+ Games
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Compact little boxes grid arranged straight down */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {visibleGames.map((game) => (
              <div
                key={game.id}
                onClick={() => onPlayGame(game)}
                className="group relative flex flex-col bg-[#12070a] hover:bg-[#1a0a0f] border border-red-950/80 hover:border-red-500/60 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-red-950/80 transition-all duration-200 active:scale-[0.98]"
              >
                {/* Official Game Thumbnail / Logo */}
                <div className="relative aspect-[4/3] w-full bg-[#1b0a0f] overflow-hidden">
                  <img
                    src={game.thumbnailUrl || game.iconDataUrl}
                    alt={game.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12070a] via-transparent to-black/20" />

                  {/* Rating Tag */}
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur border border-red-900/40 text-[9px] font-bold text-amber-300 flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-amber-300" />
                    <span>{game.rating || 4.8}</span>
                  </div>

                  {/* Play Button Overlay on Hover/Focus */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-[2px]">
                    <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-[11px] shadow-xl shadow-red-600/50 flex items-center gap-1.5 scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-3 h-3 fill-white" />
                      <span>PLAY</span>
                    </div>
                  </div>
                </div>

                {/* Info underneath */}
                <div className="p-2 flex flex-col justify-between flex-1 gap-1">
                  <h4 className="text-[11px] sm:text-xs font-bold text-white group-hover:text-red-300 transition-colors truncate">
                    {game.title}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-red-200/60">
                    <span className="truncate max-w-[80px]">{game.category}</span>
                    <span className="text-red-400 font-semibold text-[9px] flex items-center gap-0.5">
                      <Tv className="w-2.5 h-2.5" />
                      Play
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button for Infinite Scrolling without limit */}
          {displayCount < filteredGames.length && (
            <div className="pt-2 pb-6 flex justify-center">
              <button
                onClick={() => setDisplayCount((prev) => prev + 36)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#170a0e] hover:bg-gradient-to-r hover:from-red-600 hover:to-rose-600 border border-red-900/40 hover:border-red-500 text-white font-bold text-xs shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                <span>Load More Games (+36)</span>
                <ChevronDown className="w-4 h-4" />
                <span className="text-[10px] text-red-300 font-mono">
                  ({visibleGames.length} / {filteredGames.length})
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Scroll to Top button */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-2xl shadow-red-600/50 z-40 cursor-pointer active:scale-95 transition-all border border-red-400/40"
        title="Back to Top"
      >
        <ArrowUp className="w-4 h-4" />
      </button>

      {/* 
        MODAL: Add Any Game to Catalog (Red & Dark Obsidian)
      */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#12070a] border border-red-900/50 rounded-3xl p-6 shadow-2xl space-y-4 relative text-white">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-red-300/70 hover:text-white bg-red-950/40 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-500" />
                <span>Add Game to Catalog</span>
              </h3>
              <p className="text-xs text-red-200/70">
                Paste any game link from CrazyGames, itch.io, or web runner.
              </p>
            </div>

            <form onSubmit={handleAddGameSubmit} className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-bold text-red-200 block mb-1">
                  Game Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Subway Surfers, Moto X3M"
                  className="w-full bg-[#1c0a0f] border border-red-900/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-red-200 block mb-1">
                  Game URL *
                </label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.crazygames.com/game/... or https://..."
                  className="w-full bg-[#1c0a0f] border border-red-900/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-red-200 block mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#1c0a0f] border border-red-900/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Car & Driving">Car &amp; Driving</option>
                    <option value="Action & Stunts">Action &amp; Stunts</option>
                    <option value="Multiplayer .io">Multiplayer .io</option>
                    <option value="Shooting">Shooting</option>
                    <option value="Sports & Bike">Sports &amp; Bike</option>
                    <option value="Mind & Puzzles">Mind &amp; Puzzles</option>
                    <option value="Rhythm & Music">Rhythm &amp; Music</option>
                    <option value="Arcade Classics">Arcade Classics</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-200 block mb-1">
                    Logo / Thumbnail URL
                  </label>
                  <input
                    type="url"
                    value={newThumbnail}
                    onChange={(e) => setNewThumbnail(e.target.value)}
                    placeholder="https://... logo.png"
                    className="w-full bg-[#1c0a0f] border border-red-900/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-red-200 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Short summary of game controls and gameplay..."
                  className="w-full bg-[#1c0a0f] border border-red-900/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-red-200 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/40 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add to Library</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
