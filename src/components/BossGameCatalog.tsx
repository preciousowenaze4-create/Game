import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Play,
  Sparkles,
  Star,
  Flame,
  Plus,
  RefreshCw,
  Tv,
  Smartphone,
  X,
  Layers,
  Car,
  Compass,
  Gauge,
  Zap,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { fetchGamesFromSupabase, addGameToSupabase } from '../utils/supabaseCatalog';
import { OFFICIAL_UNITY_CAR_SIM } from '../utils/sampleGames';

interface BossGameCatalogProps {
  onPlayGame: (game: GameItem) => void;
  onOpenTvScreen?: () => void;
  onOpenController?: () => void;
}

export const BossGameCatalog: React.FC<BossGameCatalogProps> = ({
  onPlayGame,
  onOpenTvScreen,
  onOpenController,
}) => {
  const [games, setGames] = useState<GameItem[]>([OFFICIAL_UNITY_CAR_SIM]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
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
      } else {
        setGames([OFFICIAL_UNITY_CAR_SIM]);
      }
    } catch (err) {
      console.warn('Failed to load games:', err);
      setGames([OFFICIAL_UNITY_CAR_SIM]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDynamicGames(searchQuery, selectedCategory, true);
  }, [selectedCategory]);

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

  const categories = [
    { id: 'All', label: 'All Games', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'Car & Driving', label: 'Car & Driving', icon: <Car className="w-3.5 h-3.5 text-red-400" /> },
    { id: '3D Simulation', label: '3D Simulation', icon: <Gauge className="w-3.5 h-3.5 text-rose-400" /> },
  ];

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q) ||
        (game.description && game.description.toLowerCase().includes(q));

      let matchCategory = true;
      if (selectedCategory !== 'All') {
        matchCategory = game.category.toLowerCase().includes(selectedCategory.toLowerCase());
      }

      return matchSearch && matchCategory;
    });
  }, [games, searchQuery, selectedCategory]);

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

  return (
    <div className="space-y-4 pb-16">
      {/* 
        FEATURED HERO: OFFICIAL UNITY WEBGL 3D CAR SIMULATION
      */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#22070d] via-[#140508] to-[#0a0305] border-2 border-red-600/50 shadow-2xl shadow-red-950/80 p-5 sm:p-7">
        <div className="absolute top-0 right-0 w-[350px] h-[300px] bg-red-600/20 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/90 border border-red-500/50 text-[11px] font-black uppercase tracking-wider text-red-300 shadow-sm shadow-red-950">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Official Unity WebGL Engine</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              Unity Car Simulation <span className="text-red-500">Test</span>
            </h2>

            <p className="text-xs sm:text-sm text-red-200/80 leading-relaxed">
              Official high-fidelity 3D car simulation with steering, high-speed throttle,
              braking, and drift handling. Cast directly to your TV screen and turn your iPhone
              into a zero-lag virtual touch steering wheel and pedals.
            </p>

            {/* Action Buttons: Play Direct, TV Cast, iPhone Controller */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-2">
              <button
                onClick={() => onPlayGame(OFFICIAL_UNITY_CAR_SIM)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-extrabold text-xs shadow-xl shadow-red-600/40 border border-red-400/40 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Play Now</span>
              </button>

              {onOpenTvScreen && (
                <button
                  onClick={onOpenTvScreen}
                  className="px-4 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 active:scale-95 text-white font-bold text-xs border border-red-700/60 shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Tv className="w-4 h-4 text-red-400" />
                  <span>TV Display Screen</span>
                </button>
              )}

              {onOpenController && (
                <button
                  onClick={onOpenController}
                  className="px-4 py-2.5 rounded-xl bg-black/60 hover:bg-red-950/80 active:scale-95 text-red-200 font-bold text-xs border border-red-900/60 shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-red-400" />
                  <span>iPhone Gamepad</span>
                </button>
              )}
            </div>
          </div>

          {/* 3D Car Visual Card */}
          <div className="w-full md:w-64 aspect-[4/3] rounded-2xl overflow-hidden border border-red-600/40 shadow-2xl shadow-red-950 shrink-0 relative group">
            <img
              src="https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80"
              alt="Unity 3D Car Simulation"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
              <div className="flex items-center justify-between w-full text-[11px] font-bold text-white">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> 3D WebGL
                </span>
                <span className="px-2 py-0.5 rounded bg-red-600 text-[10px] font-black">
                  60 FPS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 
        SEARCH & CATALOG CONTROLS
      */}
      <div className="space-y-3 bg-[#110609]/95 backdrop-blur-xl p-3.5 rounded-3xl border border-red-950/80 shadow-2xl shadow-black sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-red-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search car sim or uploaded games..."
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

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
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
      </div>

      {/* 
        GAME CARDS GRID: CLEAN BOXES ARRANGED STRAIGHT DOWN
      */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-black text-white">Loading Official Game...</div>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#13070b] rounded-3xl border border-red-950/80 p-6">
          <Car className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No games matched "{searchQuery}"</h3>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs shadow-lg shadow-red-600/40 cursor-pointer"
          >
            Show Official Unity Car Simulation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              onClick={() => onPlayGame(game)}
              className="group relative flex flex-col bg-[#12070a] hover:bg-[#1a0a0f] border border-red-950/80 hover:border-red-500/60 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-red-950/80 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="relative aspect-[16/10] w-full bg-[#1b0a0f] overflow-hidden">
                <img
                  src={game.thumbnailUrl || game.iconDataUrl}
                  alt={game.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12070a] via-transparent to-black/30" />

                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur border border-red-900/40 text-[10px] font-bold text-amber-300 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-300" />
                  <span>{game.rating || 4.9}</span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-[2px]">
                  <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs shadow-xl shadow-red-600/50 flex items-center gap-1.5 scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>PLAY DIRECT</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 flex flex-col justify-between flex-1">
                <div>
                  <h3 className="text-sm font-extrabold text-white group-hover:text-red-400 transition-colors line-clamp-1">
                    {game.title}
                  </h3>
                  <p className="text-[11px] text-red-200/70 mt-1 line-clamp-2 leading-relaxed">
                    {game.description || game.notes || 'Official Unity WebGL Game'}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-red-950/60 text-[10px]">
                  <span className="font-bold text-red-400">{game.category}</span>
                  <span className="text-red-300/60 font-mono">100% Free · Cloud Host</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Game Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#14060a] border border-red-800/80 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Plus className="w-4 h-4 text-red-400" />
                <span>Add Web Game Link</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-red-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddGameSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-red-300 mb-1 font-semibold">Game Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. 3D Track Rally"
                  className="w-full bg-[#1b0a0f] border border-red-900/60 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-red-300 mb-1 font-semibold">Game Web Link (URL)</label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#1b0a0f] border border-red-900/60 rounded-xl px-3 py-2 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-red-300 mb-1 font-semibold">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-[#1b0a0f] border border-red-900/60 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="Car & Driving">Car & Driving</option>
                  <option value="3D Simulation">3D Simulation</option>
                  <option value="Arcade">Arcade</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-red-950/60 text-red-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Save Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
