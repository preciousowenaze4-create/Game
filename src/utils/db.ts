/**
 * IndexedDB storage engine for HTML games with localStorage fallback.
 * Allows storing large standalone HTML games permanently on iPhone / Safari.
 */
import { GameItem } from '../types/game';
import { SAMPLE_GAMES } from './sampleGames';

const DB_NAME = 'GameCenterMobileDB';
const DB_VERSION = 1;
const STORE_NAME = 'games';
const LOCAL_STORAGE_KEY = 'ios_game_center_games_fallback';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('addedAt', 'addedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fallback to localStorage if IndexedDB is blocked in some iframes
function getFallbackGames(): GameItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackGames(games: GameItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(games));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}


export async function saveGame(game: GameItem): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(game);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = getFallbackGames().filter((g) => g.id !== game.id);
    list.push(game);
    saveFallbackGames(list);
  }
}

export async function deleteGame(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = getFallbackGames().filter((g) => g.id !== id);
    saveFallbackGames(list);
  }
}

export async function incrementPlayCount(id: string): Promise<void> {
  const games = await getAllGames();
  const game = games.find((g) => g.id === id);
  if (game) {
    game.playCount = (game.playCount || 0) + 1;
    game.lastPlayed = Date.now();
    await saveGame(game);
  }
}

export async function updateGameTitle(id: string, newTitle: string): Promise<void> {
  const games = await getAllGames();
  const game = games.find((g) => g.id === id);
  if (game) {
    game.title = newTitle.trim();
    await saveGame(game);
  }
}

export async function getAllGames(): Promise<GameItem[]> {
  let items: GameItem[] = [];
  try {
    const db = await openDB();
    items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        resolve(req.result as GameItem[]);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    items = getFallbackGames();
  }

  // Purge any legacy sample/fake games if they exist in DB
  const realGames = items.filter((g) => !g.id.startsWith('sample-'));
  if (realGames.length !== items.length) {
    for (const fake of items.filter((g) => g.id.startsWith('sample-'))) {
      await deleteGame(fake.id).catch(() => {});
    }
  }

  return realGames.sort((a, b) => b.addedAt - a.addedAt);
}

export async function clearAllGames(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch {
    saveFallbackGames([]);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
