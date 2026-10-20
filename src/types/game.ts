/**
 * Universal Game and Package types supporting real APKs, IPAs, HTML games, Pictures, GLB 3D models, and media files.
 */
export type GameFileType =
  | 'apk'
  | 'ipa'
  | 'html'
  | 'zip'
  | 'rom'
  | 'picture'
  | '3d'
  | 'audio'
  | 'video'
  | 'document'
  | 'other';

export type DownloadState = 'downloading' | 'unpacking' | 'ready' | 'failed';
export type ScreenOrientation = 'landscape' | 'portrait';

export interface ApkDetails {
  packageName?: string;
  versionName?: string;
  hasEmbeddedHtml?: boolean;
  entryHtmlPath?: string;
  engine?: string; // 'Unity 3D', 'Unreal Engine', 'Godot', 'HTML5 Hybrid', 'Native iOS/Android'
  architectures?: string[];
  extractedFilesCount?: number;
  mainAssets?: string[];
  dexFilesCount?: number;
}

export interface GameItem {
  id: string;
  title: string;
  filename: string;
  fileType: GameFileType;
  fileSize: number; // in bytes
  addedAt: number; // timestamp
  lastPlayed?: number; // timestamp
  playCount: number;
  category: string;
  accentGradient: string;
  iconName: string;
  iconDataUrl?: string; // base64 icon extracted from APK / Picture / ZIP
  mediaUrl?: string; // raw base64 data URL for pictures / audio / files
  notes?: string;
  htmlContent: string; // executable HTML or live previewer
  downloadStatus: DownloadState;
  downloadProgress: number; // 0 - 100
  preferredOrientation?: ScreenOrientation;
  apkDetails?: ApkDetails;
  storageUrl?: string; // Direct public URL from Supabase storage bucket "game-files"
  syncedToCloud?: boolean;
  webUrl?: string; // Direct Web URL for in-app WebView
  gameUrl?: string; // Direct Web Game URL alias
  thumbnailUrl?: string; // Visual thumbnail/logo for Game Catalog
  genre?: string;
  isWebCatalog?: boolean;
  rating?: number;
  totalPlays?: number;
  featured?: boolean;
  description?: string;
  tags?: string[];
}

export interface DownloadItem {
  id: string;
  gameId: string;
  filename: string;
  title: string;
  fileSize: number;
  progress: number;
  status: DownloadState;
  startedAt: number;
  fileType: GameFileType;
  iconDataUrl?: string;
  storageUrl?: string;
}

export interface StorageStats {
  totalGames: number;
  totalBytes: number;
  totalPlays: number;
  apkCount: number;
  pictureCount: number;
}
