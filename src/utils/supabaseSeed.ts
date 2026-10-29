import { GameItem } from '../types/game';
import { OFFICIAL_UNITY_CAR_SIM } from './sampleGames';

export const OFFICIAL_GAME_URL = 'https://play.unity.com/en/games/b8915ae5-7634-4424-93ad-73778832a84b/car-sim-test';

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

export const REAL_CATALOG_GAMES: RawCatalogGame[] = [
  {
    id: 'unity-car-sim-test',
    title: 'Unity Car Simulation Test',
    slug: 'car-sim-test',
    category: 'Car & Driving',
    genre: '3D Simulation',
    cover: OFFICIAL_UNITY_CAR_SIM.thumbnailUrl || '',
    gameUrl: OFFICIAL_GAME_URL,
    totalPlays: 14520,
    rating: 4.9,
    description: 'Official 3D Unity WebGL Car Simulation test game with realistic vehicle physics, drift handling, high-speed acceleration, and TV casting support.',
    thumbnailUrl: OFFICIAL_UNITY_CAR_SIM.thumbnailUrl || '',
  },
];

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
}> = [
  {
    id: 'unity-car-sim-test',
    title: 'Unity Car Simulation Test',
    filename: 'car-sim-test.unityweb',
    file_size: 45000000,
    file_type: 'html',
    icon_data_url: OFFICIAL_UNITY_CAR_SIM.thumbnailUrl || '',
    package_name: JSON.stringify({
      category: 'Car & Driving',
      genre: '3D Simulation',
      total_plays: 14520,
      rating: 4.9,
      featured: true,
      description: 'Official 3D Unity WebGL Car Simulation with TV pairing and real-time smartphone virtual gamepad control.',
      thumbnail_url: OFFICIAL_UNITY_CAR_SIM.thumbnailUrl,
      game_url: OFFICIAL_GAME_URL,
    }),
    version_name: 'Car & Driving',
    storage_url: OFFICIAL_GAME_URL,
  },
];

export function normalizeSupabaseGameRow(row: any): GameItem {
  let meta: any = {};
  if (row.package_name) {
    try {
      meta = JSON.parse(row.package_name);
    } catch {
      meta = { category: row.package_name };
    }
  }

  const category = meta.category || row.version_name || 'Car & Driving';
  const genre = meta.genre || category;
  const rawWebUrl = row.storage_url || meta.game_url || OFFICIAL_GAME_URL;

  const thumbnailUrl =
    row.icon_data_url ||
    meta.thumbnail_url ||
    OFFICIAL_UNITY_CAR_SIM.thumbnailUrl ||
    'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80';

  const totalPlays = Number(meta.total_plays || meta.play_count || 14520);
  const rating = Number(meta.rating || 4.9);
  const description = meta.description || meta.notes || 'Official Unity WebGL 3D Car Simulation';
  const featured = Boolean(meta.featured ?? true);

  return {
    id: row.id,
    title: row.title || 'Unity Car Simulation Test',
    filename: row.filename || 'car-sim-test.unityweb',
    fileType: row.file_type || 'html',
    fileSize: row.file_size || 45000000,
    addedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    playCount: totalPlays,
    category,
    genre,
    accentGradient: 'from-red-600 via-rose-600 to-amber-600',
    iconName: 'Car',
    thumbnailUrl,
    notes: description,
    description,
    rating,
    featured,
    htmlContent: '',
    webUrl: rawWebUrl,
    storageUrl: rawWebUrl,
    downloadStatus: 'ready',
    downloadProgress: 100,
    preferredOrientation: 'landscape',
    isWebCatalog: true,
  };
}
