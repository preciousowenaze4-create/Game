import { GameItem } from '../types/game';
import { resolvePlayableGameUrl } from './gameUrlHelper';
import rawCatalog from './realCrazyGamesCatalog.json';

export interface RawCatalogGame {
  id: string;
  title: string;
  slug: string;
  category: string;
  genre: string;
  cover: string;
  gameUrl: string;
  totalPlays: number;
  rating: number;
  description: string;
  thumbnailUrl: string;
}

export const REAL_CATALOG_GAMES: RawCatalogGame[] = rawCatalog as RawCatalogGame[];

/**
 * Initial dynamic seed games for Supabase table 'games'.
 * Features 300+ real HTML5 / WebGL games with official high-res logos
 * and direct unblocked runners from CrazyGames and verified providers.
 */
export const INITIAL_SEED_GAMES: Array<{
  id: string;
  title: string;
  filename: string;
  file_size: number;
  file_type: string;
  icon_data_url: string;
  package_name: string;
  version_name: string;
  storage_url: string;
}> = REAL_CATALOG_GAMES.map((game, index) => {
  return {
    id: game.id || game.slug,
    title: game.title,
    filename: `${game.slug}.web`,
    file_size: 15000000 + (index * 50000),
    file_type: 'html',
    icon_data_url: game.thumbnailUrl,
    package_name: JSON.stringify({
      category: game.category,
      genre: game.genre,
      total_plays: game.totalPlays || 150000,
      rating: game.rating || 4.8,
      featured: index < 15,
      description: game.description,
      thumbnail_url: game.thumbnailUrl,
      game_url: game.gameUrl,
    }),
    version_name: game.category,
    storage_url: game.gameUrl,
  };
});

/**
 * Normalizes a raw Supabase `games` row into a rich GameItem
 */
export function normalizeSupabaseGameRow(row: any): GameItem {
  let meta: any = {};
  if (row.package_name) {
    try {
      meta = JSON.parse(row.package_name);
    } catch {
      meta = { category: row.package_name };
    }
  }

  const category =
    meta.category || row.version_name || (row.file_type === 'picture' ? 'Pictures' : 'Arcade Classics');
  const genre = meta.genre || category;
  const rawWebUrl = row.storage_url || meta.game_url || meta.web_url || '';
  const webUrl = resolvePlayableGameUrl(rawWebUrl);
  // Match official verified game art from real catalog
  const catalogMatch = REAL_CATALOG_GAMES.find(
    (g) => g.id === row.id || g.slug === row.id || g.title.toLowerCase() === (row.title || '').toLowerCase()
  );

  let thumbnailUrl: string =
    catalogMatch?.thumbnailUrl ||
    row.icon_data_url ||
    meta.thumbnail_url ||
    'https://images.crazygames.com/games/drift-hunters/cover-1656950639575.png?auto=format,compress&q=75&cs=strip&ch=DPR&w=512';

  // Strip any old unsplash placeholder completely
  if (thumbnailUrl.includes('unsplash.com')) {
    thumbnailUrl = catalogMatch?.thumbnailUrl || 'https://images.crazygames.com/games/drift-hunters/cover-1656950639575.png?auto=format,compress&q=75&cs=strip&ch=DPR&w=512';
  }

  const totalPlays = Number(meta.total_plays || meta.play_count || 120);
  const rating = Number(meta.rating || 4.8);
  const description = meta.description || meta.notes || '';
  const featured = Boolean(meta.featured);

  return {
    id: row.id,
    title: row.title || 'Untitled Game',
    filename: row.filename || `${row.id}.web`,
    fileType: row.file_type || 'html',
    fileSize: row.file_size || 5000000,
    addedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    playCount: totalPlays,
    totalPlays,
    category,
    genre,
    accentGradient: 'from-indigo-600 to-violet-700',
    iconName: 'Gamepad2',
    iconDataUrl: thumbnailUrl,
    thumbnailUrl,
    notes: description,
    description,
    htmlContent: '',
    webUrl: webUrl || rawWebUrl,
    gameUrl: webUrl || rawWebUrl,
    storageUrl: webUrl || row.storage_url,
    downloadStatus: 'ready',
    downloadProgress: 100,
    preferredOrientation: 'landscape',
    isWebCatalog: true,
    rating,
    featured,
  };
}
