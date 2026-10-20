import JSZip from 'jszip';
import { ApkDetails, GameFileType, GameItem, ScreenOrientation } from '../types/game';
import { startOrResumeUpload } from './resumableUploader';

/**
 * Encodes assets in an embedded HTML archive into data URIs
 * so they load without CORS or sandbox restrictions.
 */
async function bundleArchiveGame(
  zip: JSZip,
  entryPath: string
): Promise<string> {
  let html = await zip.files[entryPath].async('text');
  const baseDir = entryPath.includes('/')
    ? entryPath.substring(0, entryPath.lastIndexOf('/') + 1)
    : '';

  const assetPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const dataMap = new Map<string, string>();

  for (const assetPath of assetPaths) {
    if (assetPath === entryPath) continue;

    const ext = assetPath.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === 'js') mimeType = 'application/javascript';
    else if (ext === 'css') mimeType = 'text/css';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'svg') mimeType = 'image/svg+xml';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'mp3') mimeType = 'audio/mpeg';
    else if (ext === 'wav') mimeType = 'audio/wav';
    else if (ext === 'json') mimeType = 'application/json';

    try {
      const base64 = await zip.files[assetPath].async('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;

      const relativePath = assetPath.startsWith(baseDir)
        ? assetPath.substring(baseDir.length)
        : assetPath;

      dataMap.set(relativePath, dataUri);
      dataMap.set('./' + relativePath, dataUri);
      dataMap.set('/' + relativePath, dataUri);
      dataMap.set(assetPath, dataUri);
    } catch (e) {
      console.warn('Failed to encode asset:', assetPath, e);
    }
  }

  for (const [relPath, dataUri] of dataMap.entries()) {
    html = html.split(`"${relPath}"`).join(`"${dataUri}"`);
    html = html.split(`'${relPath}'`).join(`'${dataUri}'`);
  }

  return html;
}

/**
 * Generates an SVG vector badge for an APK, IPA, or app when an icon cannot be extracted.
 */
function generateAppVectorBadge(title: string, packageName: string, colorVariant = 0): string {
  const initial = (title.trim()[0] || 'A').toUpperCase();
  const colorSets = [
    ['#6366f1', '#a855f7'],
    ['#f59e0b', '#ef4444'],
    ['#10b981', '#06b6d4'],
    ['#ec4899', '#8b5cf6'],
    ['#3b82f6', '#1d4ed8'],
  ];
  const [c1, c2] = colorSets[colorVariant % colorSets.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="28" fill="url(#g)"/>
    <circle cx="64" cy="64" r="38" fill="rgba(0,0,0,0.18)"/>
    <text x="64" y="76" font-family="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="46" font-weight="900" fill="#ffffff" text-anchor="middle">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Searches the APK or IPA archive for the real app icon.
 */
async function extractArchiveIcon(zip: JSZip, entries: string[]): Promise<string | undefined> {
  const iconPriorities = [
    (name: string) => name.includes('mipmap-xxxhdpi') && (name.includes('ic_launcher') || name.includes('app_icon')),
    (name: string) => name.includes('mipmap-xxhdpi') && (name.includes('ic_launcher') || name.includes('app_icon')),
    (name: string) => name.includes('mipmap-xhdpi') && (name.includes('ic_launcher') || name.includes('app_icon')),
    (name: string) => name.includes('mipmap-hdpi') && (name.includes('ic_launcher') || name.includes('app_icon')),
    (name: string) => name.includes('drawable-xxxhdpi') && (name.includes('app_icon') || name.includes('ic_launcher')),
    (name: string) => name.includes('drawable-xxhdpi') && (name.includes('app_icon') || name.includes('ic_launcher')),
    (name: string) => name.includes('AppIcon') && (name.endsWith('.png') || name.endsWith('@2x.png') || name.endsWith('@3x.png')),
    (name: string) => name.includes('iTunesArtwork'),
    (name: string) => name.includes('drawable') && (name.includes('app_icon') || name.includes('icon.png')),
    (name: string) => name.includes('ic_launcher') && (name.endsWith('.png') || name.endsWith('.webp')),
    (name: string) => name.includes('icon') && (name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.jpg')),
    (name: string) => name.endsWith('.png') && !name.includes('/') && name.length < 30,
  ];

  for (const matchFn of iconPriorities) {
    const candidate = entries.find((e) => !zip.files[e].dir && matchFn(e));
    if (candidate) {
      try {
        const ext = candidate.split('.').pop()?.toLowerCase();
        let mime = 'image/png';
        if (ext === 'webp') mime = 'image/webp';
        else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';

        const base64 = await zip.files[candidate].async('base64');
        return `data:${mime};base64,${base64}`;
      } catch (err) {
        console.warn('Icon load failed for', candidate, err);
      }
    }
  }

  return undefined;
}

/**
 * Extracts human-readable strings from package filename.
 */
export function parsePackageFilenameInfo(filename: string): { title: string; packageName?: string; version?: string } {
  const cleanName = filename.replace(/\.(apk|ipa|zip|xapk)$/i, '');
  let packageName = cleanName;
  let version = '';

  const versionMatch = cleanName.match(/_([0-9]+(?:\.[0-9]+)+)/) || cleanName.match(/-([0-9]+(?:\.[0-9]+)+)/);
  if (versionMatch) {
    version = versionMatch[1];
    packageName = cleanName.replace(versionMatch[0], '');
  }

  let title = packageName;
  if (packageName.includes('.')) {
    const parts = packageName.split('.');
    title = parts[parts.length - 1];
    if (title.length <= 2 && parts.length > 2) {
      title = parts[parts.length - 2] + ' ' + title;
    }
  }

  title = title.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  if (!title) title = 'Package';

  return { title, packageName, version };
}

/**
 * Detects native game engine from library entries.
 */
function detectArchiveEngine(entries: string[]): string {
  const lowerEntries = entries.map((e) => e.toLowerCase());

  if (lowerEntries.some((e) => e.includes('libunity.so') || e.includes('assets/bin/data/unity') || e.includes('unityframework'))) {
    return 'Unity 3D Engine';
  }
  if (lowerEntries.some((e) => e.includes('libue4.so') || e.includes('libunreal.so') || e.includes('unrealengine'))) {
    return 'Unreal Engine';
  }
  if (lowerEntries.some((e) => e.includes('libgodot_android.so') || e.includes('godot'))) {
    return 'Godot Engine';
  }
  if (lowerEntries.some((e) => e.includes('libcocos2djs.so') || e.includes('libcocos2dcpp.so'))) {
    return 'Cocos2d Engine';
  }
  if (lowerEntries.some((e) => e.includes('assets/www/index.html') || e.includes('cordova.js') || e.includes('capacitor.js'))) {
    return 'HTML5 / Web Hybrid';
  }
  if (lowerEntries.some((e) => e.includes('/lib/arm64-v8a/') || e.includes('/lib/armeabi-v7a/'))) {
    return 'Native ARM Binary';
  }
  return 'Native Application';
}

/**
 * Builds the genuine Native App (APK / IPA) Preview & Dashboard view.
 * Displays real package details, file size, engine, and direct download action.
 */
function generateNativeAppDashboardHtml(
  title: string,
  packageName: string,
  version: string,
  fileSize: number,
  extractedCount: number,
  engine: string,
  isIpa: boolean,
  iconDataUrl?: string
): string {
  const safeTitle = title.replace(/"/g, '&quot;');
  const safePkg = (packageName || (isIpa ? 'app.ipa' : 'app.apk')).replace(/"/g, '&quot;');
  const safeVer = version || '1.0';
  const mbSize = (fileSize / (1024 * 1024)).toFixed(1);
  const typeLabel = isIpa ? 'iOS Application (.ipa)' : 'Android Game Package (.apk)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
  
  html, body {
    width: 100%;
    min-height: 100%;
    background: #07080e;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
  }

  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: max(16px, env(safe-area-inset-top, 16px)) 16px max(24px, env(safe-area-inset-bottom, 24px));
  }

  .container {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card {
    background: #111422;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .header-card {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .app-logo {
    width: 68px;
    height: 68px;
    border-radius: 18px;
    object-fit: cover;
    box-shadow: 0 6px 18px rgba(0,0,0,0.6);
    background: ${isIpa ? '#0284c7' : '#6366f1'};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.15);
  }

  .app-info { min-width: 0; flex: 1; }
  .app-title { font-size: 18px; font-weight: 800; color: #fff; line-height: 1.2; word-break: break-word; }
  .app-pkg { font-size: 11px; color: #94a3b8; font-family: ui-monospace, Menlo, monospace; margin-top: 3px; word-break: break-all; }

  .badge-row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
  .badge-type { background: ${isIpa ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${isIpa ? '#38bdf8' : '#fbbf24'}; border: 1px solid ${isIpa ? 'rgba(56, 189, 248, 0.35)' : 'rgba(245, 158, 11, 0.35)'}; }
  .badge-engine { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.35); }
  .badge-verified { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.35); }

  .spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .spec-box { background: #090a12; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 10px 14px; }
  .spec-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
  .spec-val { font-size: 12px; font-weight: 700; color: #f1f5f9; margin-top: 2px; }

  .action-btn {
    width: 100%;
    padding: 14px;
    border-radius: 16px;
    border: none;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
    transition: transform 0.15s ease;
  }
  .action-btn:active { transform: scale(0.98); }
</style>
</head>
<body>
  <div class="container">
    <div class="card header-card">
      ${
        iconDataUrl
          ? `<img src="${iconDataUrl}" class="app-logo" alt="icon">`
          : `<div class="app-logo">${isIpa ? '🍏' : '🤖'}</div>`
      }
      <div class="app-info">
        <h1 class="app-title">${safeTitle}</h1>
        <div class="app-pkg">${safePkg}</div>
        <div class="badge-row">
          <span class="badge badge-type">${typeLabel}</span>
          <span class="badge badge-engine">${engine}</span>
          <span class="badge badge-verified">Supabase Stored</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:12px; letter-spacing:0.5px;">
        Package Specifications
      </div>
      <div class="spec-grid">
        <div class="spec-box">
          <div class="spec-label">File Size</div>
          <div class="spec-val">${mbSize} MB</div>
        </div>
        <div class="spec-box">
          <div class="spec-label">Version</div>
          <div class="spec-val">${safeVer}</div>
        </div>
        <div class="spec-box">
          <div class="spec-label">Engine</div>
          <div class="spec-val">${engine}</div>
        </div>
        <div class="spec-box">
          <div class="spec-label">Archived Files</div>
          <div class="spec-val">${extractedCount} entries</div>
        </div>
      </div>
    </div>

    <button class="action-btn" onclick="window.parent.postMessage({type:'DOWNLOAD_ORIGINAL'}, '*')">
      <span>📥</span>
      <span>Download ${isIpa ? 'IPA' : 'APK'} File to Device</span>
    </button>
  </div>
</body>
</html>`;
}

/**
 * Builds a real Picture Viewer HTML that stands straight (vertical portrait)
 * with zoom, pan, and rotation.
 */
function generatePictureViewerHtml(
  title: string,
  filename: string,
  fileSize: number,
  dataUrl: string
): string {
  const safeTitle = title.replace(/"/g, '&quot;');
  const mbSize = (fileSize / (1024 * 1024)).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #07080e; color: #f8fafc; font-family: -apple-system, sans-serif; }
  body { display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: max(12px, env(safe-area-inset-top, 12px)) 14px max(14px, env(safe-area-inset-bottom, 14px)); height: 100vh; }
  .pic-top-bar { width: 100%; max-width: 500px; background: rgba(18, 22, 36, 0.95); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; z-index: 20; }
  .pic-title { font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pic-meta { font-size: 10px; color: #94a3b8; }
  .pic-view-container { width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; margin: 10px 0; }
  .pic-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 14px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
  .pic-bottom-bar { width: 100%; max-width: 500px; background: rgba(18, 22, 36, 0.95); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; padding: 8px 16px; display: flex; align-items: center; justify-content: space-around; z-index: 20; }
  .pic-btn { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 6px 14px; border-radius: 12px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .pic-btn:active { background: #6366f1; transform: scale(0.95); }
</style>
</head>
<body>
  <div class="pic-top-bar">
    <div>
      <div class="pic-title">${safeTitle}</div>
      <div class="pic-meta">Photo · ${mbSize} MB · Standing Straight</div>
    </div>
    <div style="font-size:11px; color:#10b981; font-weight:700;">● Portrait</div>
  </div>

  <div class="pic-view-container" id="container">
    <img src="${dataUrl}" class="pic-img" id="targetImg" alt="${safeTitle}">
  </div>

  <div class="pic-bottom-bar">
    <button class="pic-btn" onclick="zoomIn()">➕ Zoom In</button>
    <button class="pic-btn" onclick="zoomOut()">➖ Zoom Out</button>
    <button class="pic-btn" onclick="resetZoom()">⟲ Reset</button>
    <button class="pic-btn" onclick="rotate()">↻ Rotate</button>
  </div>

<script>
  let scale = 1; let rotation = 0;
  const img = document.getElementById('targetImg');
  function updateTransform() { img.style.transform = \`scale(\${scale}) rotate(\${rotation}deg)\`; }
  function zoomIn() { scale = Math.min(3, scale + 0.3); updateTransform(); }
  function zoomOut() { scale = Math.max(0.6, scale - 0.3); updateTransform(); }
  function resetZoom() { scale = 1; rotation = 0; updateTransform(); }
  function rotate() { rotation = (rotation + 90) % 360; updateTransform(); }
</script>
</body>
</html>`;
}

/**
 * Builds a dedicated 3D GLB/GLTF Viewer HTML using Three.js module.
 */
function generate3DModelViewerHtml(title: string, dataUrl: string): string {
  const safeTitle = title.replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} - 3D Viewer</title>
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>
<style>
  body, html { width: 100%; height: 100%; margin: 0; background: #07080e; overflow: hidden; display: flex; flex-direction: column; }
  .top-bar { padding: 12px 16px; background: #111422; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff; font-family: -apple-system, sans-serif; font-size: 13px; font-weight: bold; }
  model-viewer { width: 100%; flex: 1; --poster-color: transparent; }
</style>
</head>
<body>
  <div class="top-bar">🧊 ${safeTitle} (Interactive 3D Model)</div>
  <model-viewer src="${dataUrl}" camera-controls auto-rotate shadow-intensity="1" ar></model-viewer>
</body>
</html>`;
}

/**
 * Uploads a real File to backend with genuine XMLHttpRequest progress reporting.
 */
export function uploadFileWithProgress(
  file: File,
  meta: {
    id: string;
    title: string;
    fileType: string;
    htmlContent?: string;
    iconDataUrl?: string;
    packageName?: string;
    versionName?: string;
  },
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; storageUrl?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('file', file);
    formData.append('id', meta.id);
    formData.append('title', meta.title);
    formData.append('fileType', meta.fileType);
    if (meta.htmlContent) formData.append('htmlContent', meta.htmlContent);
    if (meta.iconDataUrl) formData.append('iconDataUrl', meta.iconDataUrl);
    if (meta.packageName) formData.append('packageName', meta.packageName);
    if (meta.versionName) formData.append('versionName', meta.versionName);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress?.(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve({ success: true, storageUrl: res.game?.storageUrl });
        } catch {
          resolve({ success: true });
        }
      } else {
        reject(new Error(`Server upload error: ${xhr.statusText || xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network connection error during file upload'));
    xhr.open('POST', '/api/upload', true);
    xhr.send(formData);
  });
}

/**
 * Validates and prepares ANY user file (APK, IPA, ZIP, HTML, PNG, JPG, GLB/GLTF)
 * and uploads it directly to the Supabase "game-files" storage bucket.
 */
export async function validateAndInstallGameFile(
  file: File,
  onProgress?: (progress: number, stepText: string) => void
): Promise<GameItem> {
  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();

  onProgress?.(5, 'Inspecting file format...');

  if (file.size === 0) {
    throw new Error('This file is empty (0 bytes). Please upload a valid file.');
  }

  const generatedId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  title = title.replace(/\b\w/g, (c) => c.toUpperCase());
  let fileType: GameFileType = 'other';
  let category: GameItem['category'] = 'Custom';
  let preferredOrientation: ScreenOrientation = 'landscape';
  let htmlContent = '';
  let iconDataUrl: string | undefined = undefined;
  let mediaUrl: string | undefined = undefined;
  let apkDetails: ApkDetails | undefined = undefined;

  // 1. Pictures / Images: Check MIME type and file extension (support phone camera photos, HEIC, PNG, JPG, etc.)
  const isImageFile =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|ico|heic|heif|avif|tiff)$/i.test(fileName);

  if (isImageFile) {
    fileType = 'picture';
    category = 'Picture';
    preferredOrientation = 'portrait';

    onProgress?.(15, 'Reading image data...');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read picture file'));
      reader.readAsDataURL(file);
    });

    iconDataUrl = dataUrl;
    mediaUrl = dataUrl;
    htmlContent = generatePictureViewerHtml(title, fileName, file.size, dataUrl);
  }
  // 2. 3D Model files (.glb, .gltf)
  else if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf')) {
    fileType = '3d';
    category = '3D Model';
    preferredOrientation = 'landscape';

    onProgress?.(15, 'Processing 3D model...');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read 3D file'));
      reader.readAsDataURL(file);
    });

    iconDataUrl = generateAppVectorBadge(title, fileName, 2);
    htmlContent = generate3DModelViewerHtml(title, dataUrl);
  }
  // 3. Web Games (.html or .htm): Load and render live in iframe
  else if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    fileType = 'html';
    category = 'HTML5';
    preferredOrientation = 'landscape';

    onProgress?.(15, 'Reading web game code...');
    const text = await file.text();

    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    iconDataUrl = generateAppVectorBadge(title, fileName, 0);
    htmlContent = text;
  }
  // 4. Native Apps & Packages (.apk, .ipa, .zip, .xapk)
  else if (
    lowerName.endsWith('.apk') ||
    lowerName.endsWith('.ipa') ||
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.xapk')
  ) {
    const isIpa = lowerName.endsWith('.ipa');
    fileType = isIpa ? 'ipa' : lowerName.endsWith('.apk') ? 'apk' : 'zip';
    category = isIpa ? 'iOS IPA' : fileType === 'apk' ? 'Android APK' : 'Arcade';
    preferredOrientation = 'landscape';

    onProgress?.(15, 'Unpacking package...');

    let zip: JSZip;
    try {
      const buffer = await file.arrayBuffer();
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw new Error('This archive is corrupt or unreadable.');
    }

    const entries = Object.keys(zip.files);
    onProgress?.(25, 'Extracting app icon and metadata...');

    iconDataUrl = await extractArchiveIcon(zip, entries);
    const parsed = parsePackageFilenameInfo(fileName);
    title = parsed.title;

    if (!iconDataUrl) {
      iconDataUrl = generateAppVectorBadge(title, parsed.packageName || fileName, isIpa ? 4 : 1);
    }

    // Check if web game is inside ZIP/APK
    const htmlEntry = entries.find(
      (name) =>
        !zip.files[name].dir &&
        (name.toLowerCase() === 'index.html' ||
          name.toLowerCase().endsWith('/index.html') ||
          name.toLowerCase().includes('assets/www/index.html') ||
          name.toLowerCase().endsWith('.html'))
    );

    const engine = detectArchiveEngine(entries);

    if (htmlEntry) {
      onProgress?.(35, 'Extracting embedded web game...');
      htmlContent = await bundleArchiveGame(zip, htmlEntry);
      apkDetails = {
        packageName: parsed.packageName,
        versionName: parsed.version,
        hasEmbeddedHtml: true,
        entryHtmlPath: htmlEntry,
        engine,
        extractedFilesCount: entries.length,
        mainAssets: entries.slice(0, 15),
      };
    } else {
      // Native App: Display app card with file size/metadata and direct download button
      onProgress?.(35, 'Configuring native app card...');
      htmlContent = generateNativeAppDashboardHtml(
        title,
        parsed.packageName || fileName,
        parsed.version || '1.0',
        file.size,
        entries.length,
        engine,
        isIpa,
        iconDataUrl
      );
      apkDetails = {
        packageName: parsed.packageName,
        versionName: parsed.version,
        hasEmbeddedHtml: false,
        engine,
        extractedFilesCount: entries.length,
        mainAssets: entries.slice(0, 20),
      };
    }
  }
  // 5. Other files
  else {
    fileType = 'other';
    category = 'Custom';
    preferredOrientation = 'portrait';
    iconDataUrl = generateAppVectorBadge(title, fileName, 3);
  }

  // Resumable & network-resilient chunked upload directly to Supabase Storage bucket "game-files"
  onProgress?.(40, 'Starting resilient chunked upload to Supabase...');
  let storageUrl = `/api/games/${generatedId}/download`;

  try {
    const uploadResult = await new Promise<any>((resolve, reject) => {
      startOrResumeUpload(
        file,
        {
          id: generatedId,
          title,
          fileType,
          htmlContent,
          iconDataUrl,
          packageName: apkDetails?.packageName,
          versionName: apkDetails?.versionName,
        },
        (completedGame) => resolve(completedGame),
        (err) => reject(err)
      );
    });

    if (uploadResult?.storageUrl) {
      storageUrl = uploadResult.storageUrl;
    }
  } catch (err: any) {
    console.warn('Backend chunked upload warning:', err);
    throw new Error(`Upload to Supabase paused: ${err.message || 'Network connection dropped'}. The transfer can be resumed anytime.`);
  }

  onProgress?.(100, 'Upload & Installation Complete');

  const newGameItem: GameItem = {
    id: generatedId,
    title,
    filename: file.name,
    fileType,
    fileSize: file.size,
    addedAt: Date.now(),
    playCount: 0,
    category,
    accentGradient:
      fileType === 'picture'
        ? 'from-emerald-600 to-teal-800'
        : fileType === 'ipa'
        ? 'from-sky-500 to-blue-700'
        : fileType === 'apk'
        ? 'from-amber-500 to-red-600'
        : 'from-indigo-600 to-purple-800',
    iconName: fileType === 'picture' ? 'Image' : fileType === 'apk' || fileType === 'ipa' ? 'Smartphone' : 'Gamepad2',
    iconDataUrl,
    mediaUrl,
    htmlContent,
    downloadStatus: 'ready',
    downloadProgress: 100,
    preferredOrientation,
    apkDetails,
    storageUrl,
    syncedToCloud: Boolean(storageUrl && storageUrl.startsWith('http')),
  };

  return newGameItem;
}
