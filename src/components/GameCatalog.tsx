import React, { useMemo, useState } from 'react';
import {
  Search,
  Gamepad2,
  Play,
  Sparkles,
  Star,
  Flame,
  Maximize2,
  Tv,
  Compass,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { SAMPLE_GAMES } from '../utils/sampleGames';

interface GameCatalogProps {
  onPlayGame: (game: GameItem) => void;
}

export const GameCatalog: React.FC<GameCatalogProps> = ({ onPlayGame }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  const genres = [
    'All',
    'Racing/Car',
    'Car/Action',
    'Indie/Puzzle',
    'Puzzle/Casual',
    'Rhythm/Music',
    'Strategy/Arcade',
    'Arcade/Multiplayer',
  ];

  const filteredGames = useMemo(() => {
    return SAMPLE_GAMES.filter((game) => {
      const matchSearch =
        game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (game.genre && game.genre.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (game.notes && game.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchGenre = selectedGenre === 'All' || game.genre === selectedGenre || game.category === selectedGenre;

      return matchSearch && matchGenre;
    });
  }, [searchQuery, selectedGenre]);

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/60 via-[#111428] to-[#0b0c16] border border-indigo-500/20 p-5 shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold tracking-wide uppercase">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>Instant In-App WebView Arcade</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Featured Web Games
            </h2>
            <p className="text-xs text-slate-300 max-w-md">
              Tap any game to play instantly inside the app in automatic full-screen landscape mode. Zero downloads or installations required.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>7 Web Games Ready</span>
          </div>
        </div>
      </div>

      {/* Search Bar & Filter Chips */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games catalog by title or category..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#111422] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded-md bg-white/10"
            >
              Clear
            </button>
          )}
        </div>

        {/* Genre Horizontal Filter Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-all cursor-pointer font-medium ${
                selectedGenre === genre
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 scale-[1.02]'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Clean, Scrollable Grid View */}
      {filteredGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl bg-[#111422]/60 border border-white/5">
          <Gamepad2 className="w-10 h-10 text-slate-600 mb-2" />
          <h4 className="text-sm font-bold text-slate-300">No games matched your search</h4>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Try adjusting your search keywords or select a different category.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedGenre('All');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pb-6">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              onClick={() => onPlayGame(game)}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-[#111422] border border-white/10 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer active:scale-[0.98]"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                <img
                  src={game.thumbnailUrl || game.iconDataUrl}
                  alt={game.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#111422] via-transparent to-black/30" />

                {/* Genre Tag Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur border border-white/10 text-[10px] font-semibold text-indigo-300">
                  {game.genre || game.category}
                </div>

                {/* Star Rating */}
                {game.rating && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur border border-white/10 text-[10px] font-bold text-amber-300">
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    <span>{game.rating}</span>
                  </div>
                )}

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/50 transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Game Info Details */}
              <div className="flex flex-col flex-1 p-3.5 justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                    {game.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                    {game.notes}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Tv className="w-3 h-3 text-indigo-400" />
                    <span>In-App WebView</span>
                  </span>
                  <div className="flex items-center gap-1 font-bold text-indigo-400 group-hover:text-indigo-300">
                    <span>PLAY</span>
                    <Maximize2 className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
