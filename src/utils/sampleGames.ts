import { GameItem } from '../types/game';

/**
 * Official Unity WebGL Car Simulation Game
 * Exact link: https://play.unity.com/en/games/b8915ae5-7634-4424-93ad-73778832a84b/car-sim-test
 */
export const OFFICIAL_UNITY_CAR_SIM: GameItem = {
  id: 'unity-car-sim-test',
  title: 'Unity Car Simulation Test',
  filename: 'car-sim-test.unityweb',
  fileType: 'html',
  fileSize: 45000000,
  addedAt: Date.now(),
  playCount: 14520,
  category: 'Car & Driving',
  genre: '3D Simulation',
  accentGradient: 'from-red-600 via-rose-600 to-amber-600',
  iconName: 'Car',
  thumbnailUrl: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
  notes: 'Official high-quality Unity WebGL 3D Car Simulation. Full steering, throttle acceleration, dynamic brake, and drift physics for TV casting and iPhone touch gamepad control.',
  htmlContent: '',
  webUrl: 'https://play.unity.com/en/games/b8915ae5-7634-4424-93ad-73778832a84b/car-sim-test',
  storageUrl: 'https://play.unity.com/en/games/b8915ae5-7634-4424-93ad-73778832a84b/car-sim-test',
  downloadStatus: 'ready',
  downloadProgress: 100,
  preferredOrientation: 'landscape',
  isWebCatalog: true,
  rating: 4.9,
};

export const SAMPLE_GAMES: GameItem[] = [
  OFFICIAL_UNITY_CAR_SIM,
];
