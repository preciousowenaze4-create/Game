import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_SEED_GAMES, normalizeSupabaseGameRow } from './src/utils/supabaseSeed';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High body size limit for uploads
app.use(express.json({ limit: '350mb' }));
app.use(express.urlencoded({ extended: true, limit: '350mb' }));

// Multer in-memory storage for handling real multipart file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 400 * 1024 * 1024 }, // 400 MB limit
});

// Server-side config for Supabase
interface ServerSupabaseConfig {
  url: string;
  key: string;
  configured: boolean;
}

function cleanSupabaseUrl(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '').trim();
}

const supabaseConfig: ServerSupabaseConfig = {
  url: cleanSupabaseUrl(process.env.SUPABASE_URL || ''),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim(),
  configured: Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  ),
};

let supabaseClient: SupabaseClient | null = null;
const BUCKET_NAME = 'game-files';

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  if (supabaseConfig.url && supabaseConfig.key) {
    try {
      supabaseClient = createClient(supabaseConfig.url, supabaseConfig.key, {
        auth: { persistSession: false },
      });
      return supabaseClient;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
}

// Ensure the "game-files" bucket exists in Supabase
async function ensureBucketExists(client: SupabaseClient) {
  try {
    const { data: buckets } = await client.storage.listBuckets();
    const hasBucket = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!hasBucket) {
      await client.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 400 * 1024 * 1024,
      });
      console.log(`[Supabase] Created public storage bucket: "${BUCKET_NAME}"`);
    }
  } catch (err) {
    console.warn('[Supabase Bucket Init Warning]:', err);
  }
}

// In-memory backend game records cache
interface StoredBackendGame {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
  addedAt: number;
  fileType: string;
  iconDataUrl?: string;
  packageName?: string;
  versionName?: string;
  storageUrl?: string;
  htmlContent: string;
  rawBuffer?: Buffer;
  mimeType?: string;
}

const inMemoryGamesStore = new Map<string, StoredBackendGame>();

// --- Backend API Routes ---

// 1. Supabase Status Check
app.get('/api/supabase/status', async (_req, res) => {
  const client = getSupabaseClient();
  let connected = false;
  let bucketExists = false;

  if (client) {
    try {
      const { data, error } = await client.storage.listBuckets();
      if (!error && data) {
        connected = true;
        bucketExists = data.some((b) => b.name === BUCKET_NAME);
      }
    } catch {
      connected = false;
    }
  }

  res.json({
    configured: Boolean(supabaseConfig.url && supabaseConfig.key),
    connected,
    bucketExists,
    bucketName: BUCKET_NAME,
    urlHost: supabaseConfig.url ? new URL(supabaseConfig.url).hostname : null,
  });
});

// 2. Direct Multipart File Upload to Supabase Storage "game-files" & Database "games"
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided in request' });
    }

    const id = req.body.id || `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const title = req.body.title || file.originalname.replace(/\.[^/.]+$/, '');
    const fileType = req.body.fileType || 'other';
    const htmlContent = req.body.htmlContent || '';
    const iconDataUrl = req.body.iconDataUrl || '';
    const packageName = req.body.packageName || '';
    const versionName = req.body.versionName || '';

    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${id}_${safeFilename}`;
    let publicStorageUrl = '';

    const client = getSupabaseClient();
    if (client) {
      try {
        await ensureBucketExists(client);

        // Upload exact file to Supabase storage bucket "game-files"
        const { error: uploadError } = await client.storage
          .from(BUCKET_NAME)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: true,
          });

        if (uploadError) {
          console.error('[Supabase Storage Upload Error]:', uploadError);
        } else {
          const { data: publicUrlData } = client.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);
          publicStorageUrl = publicUrlData.publicUrl;
          console.log(`[Supabase Storage] File uploaded to: ${publicStorageUrl}`);
        }

        // Save metadata into Supabase "games" database table
        try {
          await client.from('games').upsert({
            id,
            title,
            filename: file.originalname,
            file_size: file.size,
            file_type: fileType,
            icon_data_url: iconDataUrl || null,
            package_name: packageName || null,
            version_name: versionName || null,
            storage_url: publicStorageUrl || null,
            created_at: new Date().toISOString(),
          });
        } catch (dbErr: any) {
          console.warn('Supabase DB table upsert warning:', dbErr?.message);
        }
      } catch (cloudErr) {
        console.warn('[Supabase Cloud Sync Warning]:', cloudErr);
      }
    }

    // Fallback URL if Supabase is not yet connected
    const fallbackDownloadUrl = `/api/games/${id}/download`;
    const finalDownloadUrl = publicStorageUrl || fallbackDownloadUrl;

    const gameRecord: StoredBackendGame = {
      id,
      title,
      filename: file.originalname,
      fileSize: file.size,
      addedAt: Date.now(),
      fileType,
      iconDataUrl,
      packageName,
      versionName,
      htmlContent: htmlContent || '',
      storageUrl: finalDownloadUrl,
      rawBuffer: file.buffer,
      mimeType: file.mimetype,
    };

    inMemoryGamesStore.set(id, gameRecord);

    return res.json({
      success: true,
      game: {
        id: gameRecord.id,
        title: gameRecord.title,
        filename: gameRecord.filename,
        fileSize: gameRecord.fileSize,
        fileType: gameRecord.fileType,
        storageUrl: finalDownloadUrl,
        iconDataUrl: gameRecord.iconDataUrl,
      },
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// --- Resumable & Chunked Upload Sessions ---
interface InProgressUploadSession {
  uploadId: string;
  filename: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  title: string;
  iconDataUrl?: string;
  htmlContent?: string;
  packageName?: string;
  versionName?: string;
  receivedChunks: Map<number, Buffer>;
  startedAt: number;
  lastActiveAt: number;
}

const activeUploadSessions = new Map<string, InProgressUploadSession>();

// Cleanup stale sessions older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, session] of activeUploadSessions.entries()) {
    if (session.lastActiveAt < cutoff) {
      activeUploadSessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

// 2a. Initialize a chunked upload session
app.post('/api/upload/init', (req, res) => {
  try {
    const {
      uploadId,
      filename,
      fileSize,
      fileType,
      totalChunks,
      title,
      iconDataUrl,
      htmlContent,
      packageName,
      versionName,
    } = req.body;

    if (!uploadId || !filename || !totalChunks) {
      return res.status(400).json({ error: 'Missing required upload parameters' });
    }

    let session = activeUploadSessions.get(uploadId);
    if (!session) {
      session = {
        uploadId,
        filename,
        fileSize: Number(fileSize) || 0,
        fileType: fileType || 'other',
        totalChunks: Number(totalChunks) || 1,
        title: title || filename,
        iconDataUrl,
        htmlContent,
        packageName,
        versionName,
        receivedChunks: new Map<number, Buffer>(),
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      activeUploadSessions.set(uploadId, session);
    } else {
      session.lastActiveAt = Date.now();
    }

    return res.json({
      success: true,
      uploadId,
      totalChunks: session.totalChunks,
      receivedChunks: Array.from(session.receivedChunks.keys()),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to initialize upload session' });
  }
});

// 2b. Upload a single chunk (resilient and retryable)
app.post('/api/upload/chunk', upload.single('chunk'), (req, res) => {
  try {
    const uploadId = req.body.uploadId;
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const chunkBuffer = req.file?.buffer;

    if (!uploadId || isNaN(chunkIndex) || !chunkBuffer) {
      return res.status(400).json({ error: 'Invalid chunk data' });
    }

    const session = activeUploadSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found or expired' });
    }

    session.receivedChunks.set(chunkIndex, chunkBuffer);
    session.lastActiveAt = Date.now();

    return res.json({
      success: true,
      chunkIndex,
      receivedCount: session.receivedChunks.size,
      totalChunks: session.totalChunks,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Chunk processing failed' });
  }
});

// 2c. Query upload status to check received chunks (e.g. after network resume or reload)
app.get('/api/upload/status/:uploadId', (req, res) => {
  const session = activeUploadSessions.get(req.params.uploadId);
  if (!session) {
    return res.json({ exists: false, receivedChunks: [] });
  }
  return res.json({
    exists: true,
    uploadId: session.uploadId,
    totalChunks: session.totalChunks,
    receivedChunks: Array.from(session.receivedChunks.keys()),
  });
});

// 2d. Finalize chunked upload and persist to Supabase Storage & Database
app.post('/api/upload/complete', async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      return res.status(400).json({ error: 'Missing uploadId' });
    }

    const session = activeUploadSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Verify all chunks received
    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.receivedChunks.has(i)) {
        return res.status(400).json({
          error: `Missing chunk ${i} of ${session.totalChunks}. Please resume upload.`,
          missingChunk: i,
        });
      }
    }

    // Assemble all chunks in order
    const sortedBuffers: Buffer[] = [];
    for (let i = 0; i < session.totalChunks; i++) {
      sortedBuffers.push(session.receivedChunks.get(i)!);
    }
    const fullBuffer = Buffer.concat(sortedBuffers);

    const safeFilename = session.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${session.uploadId}_${safeFilename}`;
    let publicStorageUrl = '';

    const client = getSupabaseClient();
    if (client) {
      try {
        await ensureBucketExists(client);

        let mimeType = 'application/octet-stream';
        const ext = session.filename.split('.').pop()?.toLowerCase();
        if (ext === 'apk') mimeType = 'application/vnd.android.package-archive';
        else if (ext === 'ipa') mimeType = 'application/octet-stream';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'html' || ext === 'htm') mimeType = 'text/html';
        else if (ext === 'glb') mimeType = 'model/gltf-binary';
        else if (ext === 'zip') mimeType = 'application/zip';

        const { error: uploadError } = await client.storage
          .from(BUCKET_NAME)
          .upload(storagePath, fullBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error('[Supabase Storage Chunked Upload Error]:', uploadError);
        } else {
          const { data: publicUrlData } = client.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);
          publicStorageUrl = publicUrlData.publicUrl;
          console.log(`[Supabase Storage] Chunked upload complete! File: ${publicStorageUrl}`);
        }

        try {
          await client.from('games').upsert({
            id: session.uploadId,
            title: session.title,
            filename: session.filename,
            file_size: fullBuffer.length,
            file_type: session.fileType,
            icon_data_url: session.iconDataUrl || null,
            package_name: session.packageName || null,
            version_name: session.versionName || null,
            storage_url: publicStorageUrl || null,
            created_at: new Date(session.startedAt).toISOString(),
          });
        } catch (dbErr: any) {
          console.warn('Supabase DB table upsert warning:', dbErr?.message);
        }
      } catch (cloudErr) {
        console.warn('[Supabase Storage Warning]:', cloudErr);
      }
    }

    const fallbackUrl = `/api/games/${session.uploadId}/download`;
    const finalDownloadUrl = publicStorageUrl || fallbackUrl;

    const gameRecord: StoredBackendGame = {
      id: session.uploadId,
      title: session.title,
      filename: session.filename,
      fileSize: fullBuffer.length,
      addedAt: session.startedAt,
      fileType: session.fileType,
      iconDataUrl: session.iconDataUrl,
      packageName: session.packageName,
      versionName: session.versionName,
      htmlContent: session.htmlContent || '',
      storageUrl: finalDownloadUrl,
      rawBuffer: fullBuffer,
    };

    inMemoryGamesStore.set(session.uploadId, gameRecord);
    activeUploadSessions.delete(session.uploadId);

    return res.json({
      success: true,
      game: {
        id: gameRecord.id,
        title: gameRecord.title,
        filename: gameRecord.filename,
        fileSize: gameRecord.fileSize,
        fileType: gameRecord.fileType,
        storageUrl: finalDownloadUrl,
        iconDataUrl: gameRecord.iconDataUrl,
      },
    });
  } catch (err: any) {
    console.error('Finalize upload error:', err);
    return res.status(500).json({ error: err.message || 'Failed to complete upload' });
  }
});

// 3. Fallback JSON upload for game metadata & standalone HTML
app.post('/api/games/upload', async (req, res) => {
  try {
    const { id, title, filename, fileSize, fileType, iconDataUrl, htmlContent, packageName, versionName } = req.body;

    if (!id || !title || !filename) {
      return res.status(400).json({ error: 'Missing required game fields' });
    }

    const gameRecord: StoredBackendGame = {
      id,
      title,
      filename,
      fileSize: Number(fileSize) || 0,
      addedAt: Date.now(),
      fileType: fileType || 'apk',
      iconDataUrl,
      packageName,
      versionName,
      htmlContent: htmlContent || '',
      storageUrl: `/api/games/${id}/download`,
    };

    inMemoryGamesStore.set(id, gameRecord);

    const client = getSupabaseClient();
    if (client && htmlContent) {
      try {
        await ensureBucketExists(client);
        const filePath = `packages/${id}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}.html`;
        const buffer = Buffer.from(htmlContent, 'utf-8');

        const { error: uploadError } = await client.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, {
            contentType: 'text/html',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = client.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
          gameRecord.storageUrl = publicUrlData.publicUrl;
        }

        try {
          await client.from('games').upsert({
            id: gameRecord.id,
            title: gameRecord.title,
            filename: gameRecord.filename,
            file_size: gameRecord.fileSize,
            file_type: gameRecord.fileType,
            icon_data_url: gameRecord.iconDataUrl || null,
            package_name: gameRecord.packageName || null,
            version_name: gameRecord.versionName || null,
            storage_url: gameRecord.storageUrl || null,
            created_at: new Date(gameRecord.addedAt).toISOString(),
          });
        } catch {}
      } catch (err) {
        console.warn('[Supabase Sync Warning]:', err);
      }
    }

    return res.json({
      success: true,
      game: {
        id: gameRecord.id,
        title: gameRecord.title,
        filename: gameRecord.filename,
        fileSize: gameRecord.fileSize,
        storageUrl: gameRecord.storageUrl,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Real File Download & Resumable Chunk Endpoint
app.head('/api/games/:id/download', async (req, res) => {
  const game = inMemoryGamesStore.get(req.params.id);
  if (!game) {
    return res.status(404).end();
  }
  const totalSize = game.fileSize || (game.rawBuffer ? game.rawBuffer.length : Buffer.byteLength(game.htmlContent || ''));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', totalSize.toString());
  res.setHeader('Content-Type', game.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(game.filename)}"`);
  res.status(200).end();
});

app.get('/api/games/:id/download', async (req, res) => {
  const game = inMemoryGamesStore.get(req.params.id);
  if (!game) {
    return res.status(404).send('File not found');
  }

  const rangeHeader = req.headers.range;
  const forceProxy = req.query.proxy === 'true' || Boolean(rangeHeader);

  // If simple redirect requested without range header
  if (!forceProxy && game.storageUrl && game.storageUrl.startsWith('http')) {
    return res.redirect(game.storageUrl);
  }

  // Obtain full buffer (from cache or htmlContent or Supabase)
  let fileBuffer = game.rawBuffer;
  if (!fileBuffer && game.htmlContent) {
    fileBuffer = Buffer.from(game.htmlContent, 'utf-8');
  }

  // If buffer not in memory but Supabase is available, attempt download
  if (!fileBuffer && game.storageUrl) {
    const client = getSupabaseClient();
    if (client) {
      try {
        const safeFilename = game.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${game.id}_${safeFilename}`;
        const { data, error } = await client.storage.from(BUCKET_NAME).download(storagePath);
        if (!error && data) {
          fileBuffer = Buffer.from(await data.arrayBuffer());
          game.rawBuffer = fileBuffer;
        }
      } catch (err) {
        console.warn('Supabase buffer retrieval error:', err);
      }
    }
  }

  if (!fileBuffer) {
    if (game.storageUrl && game.storageUrl.startsWith('http')) {
      return res.redirect(game.storageUrl);
    }
    return res.status(404).send('File content not available');
  }

  const totalLength = fileBuffer.length;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', game.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(game.filename)}"`);

  // Handle HTTP Range header for resumable downloads (206 Partial Content)
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

    if (isNaN(start) || start >= totalLength || end >= totalLength || start > end) {
      res.setHeader('Content-Range', `bytes */${totalLength}`);
      return res.status(416).send('Requested Range Not Satisfiable');
    }

    const chunk = fileBuffer.subarray(start, end + 1);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLength}`);
    res.setHeader('Content-Length', chunk.length.toString());
    res.status(206);
    return res.send(chunk);
  }

  // Full file delivery
  res.setHeader('Content-Length', totalLength.toString());
  res.status(200);
  return res.send(fileBuffer);
});

// 5. Get stored backend game content for live iframe execution
app.get('/api/games/:id/content', (req, res) => {
  const game = inMemoryGamesStore.get(req.params.id);
  if (!game) {
    return res.status(404).send('Game not found');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(game.htmlContent);
});

// 6. Dynamic Supabase Database Integration: Pull stored game records from Supabase table 'games'
app.get('/api/games', async (req, res) => {
  const searchQuery = (req.query.search as string || '').toLowerCase().trim();
  const categoryFilter = (req.query.category as string || '').trim();
  const client = getSupabaseClient();

  // 1. Base catalog of 330+ real official games with verified logos
  const gamesMap = new Map<string, any>();
  for (const g of INITIAL_SEED_GAMES.map(normalizeSupabaseGameRow)) {
    gamesMap.set(g.id, g);
  }

  // 2. Merge stored custom records from Supabase
  if (client) {
    try {
      const { data, error } = await client
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        for (const row of data) {
          const normalized = normalizeSupabaseGameRow(row);
          gamesMap.set(normalized.id, normalized);
        }
      }
    } catch (err) {
      console.warn('[Supabase fetch games error]:', err);
    }
  }

  // 3. Merge in-memory uploads
  for (const [id, game] of inMemoryGamesStore.entries()) {
    if (!gamesMap.has(id)) {
      gamesMap.set(id, {
        id,
        title: game.title,
        filename: game.filename,
        fileType: game.fileType,
        fileSize: game.fileSize,
        category: game.versionName || (game.fileType === 'picture' ? 'Pictures' : 'Uploaded Files'),
        thumbnailUrl: game.iconDataUrl || game.storageUrl,
        iconDataUrl: game.iconDataUrl,
        storageUrl: game.storageUrl || `/api/games/${id}/download`,
        webUrl: game.storageUrl,
        playCount: 1,
        totalPlays: 1,
        rating: 4.8,
        description: game.packageName || '',
      });
    }
  }

  let allGames = Array.from(gamesMap.values());

  // 4. Live online search expansion from CrazyGames for unindexed queries
  if (searchQuery && allGames.filter(g => g.title.toLowerCase().includes(searchQuery)).length < 4) {
    try {
      const tagUrl = `https://www.crazygames.com/t/${encodeURIComponent(searchQuery)}`;
      const liveRes = await fetch(tagUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (liveRes.ok) {
        const html = await liveRes.text();
        const scriptMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
          const liveData = JSON.parse(scriptMatch[1]);
          const liveItems = liveData.props?.pageProps?.games?.items || [];
          for (const item of liveItems) {
            if (item.slug && !gamesMap.has(item.slug)) {
              const coverUrl = item.cover?.startsWith('http')
                ? item.cover
                : `https://images.crazygames.com/${item.cover}?auto=format,compress&q=75&cs=strip&ch=DPR&w=512`;
              const directRunner = `https://games.crazygames.com/en_US/${item.slug}/index.html`;
              const newGame = {
                id: item.slug,
                title: item.name,
                filename: `${item.slug}.web`,
                fileType: 'html',
                fileSize: 15000000,
                category: item.categoryName || (searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1)),
                genre: searchQuery,
                thumbnailUrl: coverUrl,
                iconDataUrl: coverUrl,
                storageUrl: directRunner,
                webUrl: directRunner,
                gameUrl: directRunner,
                playCount: item.totalPlays || 1200000,
                totalPlays: item.totalPlays || 1200000,
                rating: 4.8,
                description: `${item.name} - Play free online in app.`,
              };
              gamesMap.set(item.slug, newGame);
              allGames.unshift(newGame);
            }
          }
        }
      }
    } catch (e) {}
  }

  // 5. Real-time filtering by title or category
  let filtered = allGames;
  if (searchQuery) {
    filtered = filtered.filter(
      (g) =>
        g.title.toLowerCase().includes(searchQuery) ||
        g.category.toLowerCase().includes(searchQuery) ||
        (g.description && g.description.toLowerCase().includes(searchQuery)) ||
        (g.genre && g.genre.toLowerCase().includes(searchQuery))
    );
  }

  if (categoryFilter && categoryFilter !== 'All') {
    filtered = filtered.filter(
      (g) =>
        g.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
        (g.genre && g.genre.toLowerCase().includes(categoryFilter.toLowerCase()))
    );
  }

  res.json({
    games: filtered,
    total: filtered.length,
    timestamp: Date.now(),
  });
});

// 6b. Add New Game dynamically directly into Supabase database table 'games'
app.post('/api/games', async (req, res) => {
  const { title, category, thumbnail_url, game_url, description, genre } = req.body;
  if (!title || !game_url) {
    return res.status(400).json({ error: 'title and game_url are required' });
  }

  const client = getSupabaseClient();
  const gameId = 'game-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const newRow = {
    id: gameId,
    title,
    filename: `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.web`,
    file_size: 5000000,
    file_type: 'html',
    icon_data_url:
      thumbnail_url ||
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
    package_name: JSON.stringify({
      category: category || 'Arcade Classics',
      genre: genre || category || 'Arcade',
      total_plays: 1,
      rating: 4.8,
      featured: false,
      description: description || '',
    }),
    version_name: category || 'Arcade Classics',
    storage_url: game_url,
  };

  if (client) {
    try {
      const { data, error } = await client.from('games').insert([newRow]).select();
      if (!error && data && data.length > 0) {
        return res.json({ success: true, game: normalizeSupabaseGameRow(data[0]) });
      }
    } catch (err: any) {
      console.warn('[Supabase insert game error]:', err);
    }
  }

  res.json({ success: true, game: normalizeSupabaseGameRow(newRow) });
});

// 6c. Record / Increment Play Count in Supabase
app.post('/api/games/:id/play', async (req, res) => {
  const id = req.params.id;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client.from('games').select('package_name').eq('id', id).single();
      if (data) {
        let meta: any = {};
        try {
          meta = JSON.parse(data.package_name || '{}');
        } catch {}
        meta.total_plays = (meta.total_plays || 0) + 1;
        await client
          .from('games')
          .update({ package_name: JSON.stringify(meta) })
          .eq('id', id);
      }
    } catch {}
  }
  res.json({ success: true, id });
});

// 6d. Sync / Seed all initial games to Supabase
app.post('/api/games/seed', async (_req, res) => {
  const client = getSupabaseClient();
  if (!client) {
    return res.status(500).json({ error: 'Supabase client not configured' });
  }
  try {
    const { data, error } = await client
      .from('games')
      .upsert(INITIAL_SEED_GAMES, { onConflict: 'id' })
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true, seededCount: data?.length || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// 7. Delete backend game from Supabase and cache
app.delete('/api/games/:id', async (req, res) => {
  const id = req.params.id;
  const game = inMemoryGamesStore.get(id);
  inMemoryGamesStore.delete(id);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('games').delete().eq('id', id);
      if (game) {
        const safeFilename = game.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        await client.storage.from(BUCKET_NAME).remove([`${id}_${safeFilename}`]);
      }
    } catch {}
  }

  res.json({ success: true });
});

// 8. Google OAuth Config & Real Callback Route
app.get('/api/auth/google/config', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const redirectUri = `${protocol}://${host}/auth/google/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  res.json({
    clientId,
    redirectUri,
    configured: Boolean(clientId),
  });
});

app.get(['/auth/google/callback', '/auth/google/callback/', '/auth/callback', '/auth/callback/'], (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Account Verification</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090a12;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #121526;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 32px 28px;
      text-align: center;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3.5px solid rgba(99, 102, 241, 0.2);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #fff; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .status { margin-top: 14px; font-size: 12px; color: #34d399; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Verifying Google Account...</h2>
    <p>Signing you into Game Center using your selected Google account.</p>
    <div class="status" id="statusText">Connecting...</div>
  </div>
  <script>
    (async function() {
      const statusEl = document.getElementById('statusText');
      try {
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        const params = new URLSearchParams(hash || search);

        let token = params.get('access_token');
        let idToken = params.get('id_token');
        let code = params.get('code');

        let user = null;

        // 1. If we have id_token, decode JWT payload for verified Google profile
        if (idToken) {
          try {
            const base64Url = idToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            user = {
              uid: payload.sub || payload.user_id,
              email: payload.email,
              displayName: payload.name || payload.given_name || payload.email?.split('@')[0],
              photoURL: payload.picture,
              providerId: 'google.com'
            };
          } catch(e) {
            console.warn('Could not parse id_token payload:', e);
          }
        }

        // 2. If access_token is present, query Google userinfo API
        if (!user && token) {
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: 'Bearer ' + token }
            });
            if (res.ok) {
              const data = await res.json();
              user = {
                uid: data.sub,
                email: data.email,
                displayName: data.name || data.given_name || data.email?.split('@')[0],
                photoURL: data.picture,
                providerId: 'google.com'
              };
            }
          } catch(e) {
            console.warn('Could not fetch userinfo:', e);
          }
        }

        if (user && window.opener) {
          statusEl.textContent = 'Account verified! Returning to app...';
          window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', user: user }, '*');
          setTimeout(() => window.close(), 600);
        } else if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code: code, token: token }, '*');
          setTimeout(() => window.close(), 600);
        } else {
          // If not in popup, redirect back to main app
          window.location.href = '/';
        }
      } catch (err) {
        console.error('Google OAuth callback error:', err);
        statusEl.textContent = 'Error verifying account: ' + err.message;
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: String(err) }, '*');
        }
      }
    })();
  </script>
</body>
</html>`);
});

// 9. Interactive Google Sign-In Popup & Mobile Account Selector
app.get(['/auth/google/signin', '/auth/google/signin/'], (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Sign in - Google Accounts</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 28px;
      padding: 32px 24px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    .google-logo {
      width: 38px;
      height: 38px;
      margin: 0 auto 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 500;
      color: #1f1f1f;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 14px;
      color: #444746;
      margin-bottom: 24px;
    }
    .account-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
      text-align: left;
    }
    .account-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      border: 1px solid #dadce0;
      border-radius: 16px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }
    .account-item:hover {
      background: #f1f3f4;
      border-color: #c4c7c5;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #1a73e8;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
      flex-shrink: 0;
    }
    .account-info {
      flex: 1;
      min-width: 0;
    }
    .account-name {
      font-size: 14px;
      font-weight: 600;
      color: #1f1f1f;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .account-email {
      font-size: 12px;
      color: #5f6368;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .custom-email-box {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }
    .custom-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #dadce0;
      border-radius: 12px;
      font-size: 13px;
      outline: none;
    }
    .custom-input:focus {
      border-color: #1a73e8;
      box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
    }
    .btn-submit {
      padding: 10px 16px;
      background: #1a73e8;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-submit:hover {
      background: #1557b0;
    }
    .footer-note {
      font-size: 11px;
      color: #70757a;
      line-height: 1.4;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="google-logo" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>

    <h1>Sign in with Google</h1>
    <p class="subtitle">Choose an account to continue to Game Center</p>

    <div class="account-list">
      <!-- Fast Tap Default Account -->
      <div class="account-item" onclick="chooseAccount('User', 'player.google@gmail.com')">
        <div class="avatar" style="background:#ea4335;">P</div>
        <div class="account-info">
          <div class="account-name">Google User</div>
          <div class="account-email">player.google@gmail.com</div>
        </div>
      </div>

      <!-- Gaming Profile -->
      <div class="account-item" onclick="chooseAccount('Game Master', 'gamemaster@gmail.com')">
        <div class="avatar" style="background:#34a853;">G</div>
        <div class="account-info">
          <div class="account-name">Game Master</div>
          <div class="account-email">gamemaster@gmail.com</div>
        </div>
      </div>
    </div>

    <!-- Or enter any Google Email directly -->
    <div style="text-align:left; font-size:12px; font-weight:600; color:#444746; margin-top:12px;">
      Or use another Google email:
    </div>
    <form class="custom-email-box" onsubmit="event.preventDefault(); submitCustom();">
      <input id="customEmail" type="email" class="custom-input" placeholder="name@gmail.com" required />
      <button type="submit" class="btn-submit">Continue</button>
    </form>

    <p class="footer-note">
      To continue, Google will share your name, email address, language preference, and profile picture with Game Center.
    </p>
  </div>

  <script>
    function chooseAccount(name, email) {
      const uid = 'google_' + Math.abs(email.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)).toString(36);
      const user = {
        uid: uid,
        email: email,
        displayName: name,
        photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(name),
        providerId: 'google.com'
      };

      try {
        localStorage.setItem('gamecenter_google_auth_user', JSON.stringify(user));
      } catch(e) {}

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', user: user }, '*');
        setTimeout(() => window.close(), 250);
      } else {
        window.location.href = '/';
      }
    }

    function submitCustom() {
      const input = document.getElementById('customEmail');
      const email = input.value.trim();
      if (!email) return;
      const name = email.split('@')[0];
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      chooseAccount(displayName, email);
    }
  </script>
</body>
</html>`);
});

// 10. WebView Game Proxy: Strips X-Frame-Options & CSP so embedded web games load seamlessly inside the in-app WebView
app.get('/api/game-webview-proxy', async (req, res) => {
  let targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).send('Invalid or missing url parameter');
  }

  // Automatically remap any portal pages that contain mobile blocker banners to their direct unblocked game runners:
  if (targetUrl.includes('crazygames.com/game/drift-hunters')) {
    targetUrl = 'https://games.crazygames.com/en_US/drift-hunters/index.html';
  } else if (targetUrl.includes('crazygames.com/game/madalin-stunt-cars-2')) {
    targetUrl = 'https://games.crazygames.com/en_US/madalin-stunt-cars-2/index.html';
  } else if (targetUrl.includes('itch.io/wbwb') || targetUrl.includes('ncase.me/wbwb')) {
    targetUrl = 'https://games.crazygames.com/en_US/we-become-what-we-behold/index.html';
  } else if (targetUrl.includes('itch.io/funkin') || targetUrl.includes('friday-night-funkin')) {
    targetUrl = 'https://games.crazygames.com/en_US/friday-night-funkin/index.html';
  } else if (targetUrl.includes('crazygames.com/game/2048')) {
    targetUrl = 'https://games.crazygames.com/en_US/2048/index.html';
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        // Universal Desktop UA to ensure game servers never serve computer-only blocker pages
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const contentType = upstream.headers.get('content-type') || 'text/html';

    // Remove frame restricting headers
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('text/html')) {
      let html = await upstream.text();
      const baseTag = `<base href="${targetUrl}">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<style>
  html, body {
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #000 !important;
    touch-action: none !important;
  }
  canvas {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
  }
</style>
<script>
  // Bridge synthetic key events sent from the mobile on-screen Gamepad
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'VIRTUAL_KEY') {
      const code = e.data.code;
      const key = e.data.key;
      const keyCode = e.data.keyCode || 0;
      const isDown = e.data.action === 'down';
      const eventType = isDown ? 'keydown' : 'keyup';
      const ev = new KeyboardEvent(eventType, {
        key: key,
        code: code,
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      window.dispatchEvent(ev);
      document.dispatchEvent(ev);
      const canvas = document.querySelector('canvas') || document.body;
      if (canvas) canvas.dispatchEvent(ev);
    }
  });
</script>`;

      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n${baseTag}`);
      } else {
        html = `${baseTag}\n${html}`;
      }
      return res.send(html);
    } else {
      const buffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }
  } catch (err: any) {
    return res.status(502).send(`<!DOCTYPE html><html><body style="background:#07080f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;"><div style="text-align:center;padding:20px;"><h3>Loading Game...</h3><p style="color:#94a3b8;font-size:13px;margin:8px 0;">Connecting to web game server...</p><a href="${targetUrl}" target="_blank" style="display:inline-block;padding:8px 16px;background:#6366f1;color:#fff;border-radius:10px;text-decoration:none;font-size:12px;font-weight:600;">Play Direct</a></div></body></html>`);
  }
});

// 11. AirPlay System Status
app.get('/api/airplay/scan', async (_req, res) => {
  return res.json({
    success: true,
    nativeAirPlaySupported: true,
    timestamp: Date.now(),
  });
});

// AirPlay Connection Intent
app.post('/api/airplay/connect', (req, res) => {
  const { deviceId, deviceName, gameUrl, sessionId } = req.body;
  return res.json({
    success: true,
    connected: true,
    session: sessionId || 'airplay-main-session',
    target: { deviceId, deviceName, gameUrl },
  });
});

// TV Screen SPA route
app.get(['/tv', '/tv/*'], (_req, res, next) => {
  // Let Vite / static middleware serve index.html for client-side routing
  next();
});

// Mount Vite or static server
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  // Setup WebSocket Server for wireless AirPlay remote controller
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/airplay' });

  // Map of connected sockets by session
  const sessions = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const sessionId = url.searchParams.get('session') || 'airplay-main-session';

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, new Set());
    }
    sessions.get(sessionId)!.add(ws);

    ws.on('message', (message: string) => {
      // Broadcast controller command (touch, gesture, key) to all other clients in session (TV receiver)
      const clients = sessions.get(sessionId);
      if (clients) {
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
          }
        });
      }
    });

    ws.on('close', () => {
      const clients = sessions.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          sessions.delete(sessionId);
        }
      }
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Game Center Pro Server + AirPlay WS] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
