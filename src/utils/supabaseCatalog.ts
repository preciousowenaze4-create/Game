import { GameItem } from '../types/game';
import { INITIAL_SEED_GAMES, normalizeSupabaseGameRow } from './supabaseSeed';

/**
 * Dynamic Supabase Games Service
 * Pulls all games directly from Supabase table 'games'.
 * Supports real-time updates, adding new games, and incrementing play counts.
 */
export async function fetchGamesFromSupabase(search = '', category = 'All'): Promise<GameItem[]> {
  try {
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    if (category && category !== 'All') params.append('category', category);

    const res = await fetch(`/api/games?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.games) && data.games.length > 0) {
        return data.games;
      }
    }
  } catch (err) {
    console.warn('Error fetching dynamic games from Supabase:', err);
  }

  // Fallback to initial seed games if offline or database empty
  let fallback = INITIAL_SEED_GAMES.map(normalizeSupabaseGameRow);
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    fallback = fallback.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }
  if (category && category !== 'All') {
    fallback = fallback.filter((g) => g.category.toLowerCase() === category.toLowerCase());
  }
  return fallback;
}

export async function addGameToSupabase(payload: {
  title: string;
  category: string;
  game_url: string;
  thumbnail_url?: string;
  description?: string;
  genre?: string;
}): Promise<GameItem | null> {
  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return data.game || null;
    }
  } catch (err) {
    console.error('Error adding game to Supabase:', err);
  }
  return null;
}

export async function recordGamePlay(gameId: string): Promise<void> {
  try {
    await fetch(`/api/games/${encodeURIComponent(gameId)}/play`, {
      method: 'POST',
    });
  } catch (err) {
    console.warn('Error recording game play:', err);
  }
}
