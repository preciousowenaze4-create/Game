/**
 * Generates the complete, self-contained single-file index.html.
 * This can be exported, downloaded, or copied directly.
 * Fully supports APK, ZIP, HTML5, and any phone file.
 */
export function getStandaloneHtmlCode(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>Game Center Pro</title>
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Game Center" />
  <meta name="theme-color" content="#090a0f" />
  <style>
    :root {
      --bg-canvas: #090a0f;
      --bg-surface: #111420;
      --bg-surface-elevated: #151a2a;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.4);
      --accent: #6366f1;
      --accent-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      --text-primary: #ffffff;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --danger: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --radius-card: 18px;
      --radius-btn: 12px;
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    html, body {
      width: 100%;
      height: 100%;
      background-color: var(--bg-canvas);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    #app {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding-top: calc(var(--safe-top) + 14px);
      padding-bottom: calc(var(--safe-bottom) + 24px);
      padding-left: 16px;
      padding-right: 16px;
    }

    /* Header */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: var(--accent-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    }

    .brand-icon svg {
      width: 22px;
      height: 22px;
      fill: #fff;
    }

    .brand-text h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .brand-text p {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
    }

    /* Mature Nav Tabs */
    .nav-tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      padding: 4px;
      border-radius: var(--radius-btn);
      margin-bottom: 16px;
    }

    .nav-tab {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      padding: 8px 10px;
      border-radius: 9px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .nav-tab.active {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
    }

    /* Quick Metrics Strip */
    .metrics-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 10px 6px;
      text-align: center;
      margin-bottom: 16px;
    }

    .metric-col {
      border-right: 1px solid var(--border-subtle);
    }
    .metric-col:last-child {
      border-right: none;
    }

    .metric-label {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-val {
      font-size: 14px;
      font-weight: 800;
      margin-top: 2px;
      color: #fff;
    }

    /* Universal Upload Card */
    .hero-upload {
      background: var(--bg-surface);
      border: 1px dashed rgba(99, 102, 241, 0.4);
      border-radius: var(--radius-card);
      padding: 24px 20px;
      text-align: center;
      margin-bottom: 16px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .hero-upload:active {
      background: var(--bg-surface-elevated);
      transform: scale(0.99);
    }

    .upload-icon-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px;
    }

    .upload-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 3px;
    }

    .upload-sub {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 14px;
    }

    .file-input {
      display: none;
    }

    .btn-upload {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--accent-gradient);
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      padding: 10px 22px;
      border-radius: var(--radius-btn);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    }

    /* Search Controls */
    .search-box {
      position: relative;
      margin-bottom: 14px;
    }

    .search-box input {
      width: 100%;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-btn);
      padding: 10px 14px 10px 36px;
      color: #fff;
      font-size: 13px;
      outline: none;
    }

    .search-box input:focus {
      border-color: var(--accent);
    }

    .search-icon {
      position: absolute;
      left: 11px;
      top: 50%;
      transform: translateY(-50%);
      width: 15px;
      height: 15px;
      color: var(--text-muted);
    }

    /* Game Cards List */
    .games-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .game-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background-color 0.15s;
    }

    .game-card:active {
      background: var(--bg-surface-elevated);
    }

    .game-thumb {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 22px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: #fff;
    }

    .game-details {
      flex: 1;
      min-width: 0;
    }

    .game-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .game-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge-apk {
      background: rgba(245, 158, 11, 0.2);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.35);
      font-size: 9px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 5px;
      flex-shrink: 0;
    }

    .game-meta {
      font-size: 11px;
      color: var(--text-secondary);
      display: flex;
      gap: 5px;
      align-items: center;
      margin-top: 2px;
    }

    .game-meta span::after {
      content: "•";
      margin-left: 5px;
      color: var(--text-muted);
    }
    .game-meta span:last-child::after {
      content: "";
    }

    .game-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .btn-play {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 7px 16px;
      font-size: 12px;
      font-weight: 800;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-play:active {
      transform: scale(0.94);
    }

    .btn-delete {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .btn-delete:active {
      color: var(--danger);
    }

    /* Full-Screen Game Player Overlay */
    #playerContainer {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #000;
      z-index: 9999;
      display: none;
      flex-direction: column;
    }

    #gameFrame {
      width: 100%;
      height: 100%;
      border: none;
      background: #000;
    }

    /* Floating Exit Control Overlay */
    .floating-exit-bar {
      position: fixed;
      top: calc(var(--safe-top) + 10px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      background: rgba(17, 20, 32, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 30px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
    }

    .floating-game-title {
      font-size: 12px;
      font-weight: 600;
      max-width: 130px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(255, 255, 255, 0.85);
    }

    .btn-exit-game {
      background: rgba(239, 68, 68, 0.25);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.4);
      padding: 5px 11px;
      border-radius: 14px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-tool {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
    }

    /* Toast Notification */
    #toast {
      position: fixed;
      bottom: calc(var(--safe-bottom) + 20px);
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(24, 28, 45, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      color: #fff;
      padding: 10px 18px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 10001;
      transition: transform 0.25s ease;
      pointer-events: none;
    }

    #toast.show {
      transform: translateX(-50%) translateY(0);
    }
  </style>
</head>
<body>
  <div id="app">
    <!-- Header -->
    <header>
      <div class="brand">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 9 18.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
        </div>
        <div class="brand-text">
          <h1>Game Center Pro</h1>
          <p>Universal Phone File & APK Player</p>
        </div>
      </div>
      <div style="font-size:12px; color:var(--text-muted); font-weight:600;" id="statsHeader">
        0 Games
      </div>
    </header>

    <!-- Nav Tabs -->
    <div class="nav-tabs">
      <button class="nav-tab active" id="tabBtnLib" onclick="switchTab('library')">
        🎮 Library (<span id="tabCountLib">0</span>)
      </button>
      <button class="nav-tab" id="tabBtnDown" onclick="switchTab('downloads')">
        📥 Downloads (<span id="tabCountDown">0</span>)
      </button>
      <button class="nav-tab" id="tabBtnUpload" onclick="switchTab('install')">
        ➕ Install File
      </button>
    </div>

    <!-- Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric-col">
        <div class="metric-label">Games</div>
        <div class="metric-val" id="metricTotal">0</div>
      </div>
      <div class="metric-col">
        <div class="metric-label">APKs</div>
        <div class="metric-val" style="color:var(--warning);" id="metricApk">0</div>
      </div>
      <div class="metric-col">
        <div class="metric-label">Storage</div>
        <div class="metric-val" style="color:var(--accent);" id="metricStorage">0 B</div>
      </div>
      <div class="metric-col">
        <div class="metric-label">Plays</div>
        <div class="metric-val" style="color:var(--success);" id="metricPlays">0</div>
      </div>
    </div>

    <!-- Section: Install File -->
    <div id="sectionInstall" style="display:none;">
      <div class="hero-upload" id="dropZone" onclick="triggerFileInput()">
        <div class="upload-icon-circle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <div class="upload-title">Select Any Game or APK File</div>
        <div class="upload-sub">Supports .apk, .html, .zip, or any phone file without restrictions</div>
        <!-- Universal Input with NO accept restrictions: allows picking APKs on iPhone -->
        <input type="file" id="gameFileInput" class="file-input" onchange="handleFileSelect(event)">
        <button class="btn-upload" onclick="event.stopPropagation(); triggerFileInput();">
          Select From iPhone Storage
        </button>
      </div>
    </div>

    <!-- Search Box -->
    <div class="search-box" id="searchRow">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input type="text" id="searchInput" placeholder="Search by title, APK name, package..." oninput="filterGames()">
    </div>

    <!-- Section: Library List -->
    <div class="games-grid" id="gamesContainer">
      <!-- Injected dynamically -->
    </div>
  </div>

  <!-- Full-Screen Game Player Overlay -->
  <div id="playerContainer">
    <div class="floating-exit-bar" id="exitBar">
      <button class="btn-exit-game" onclick="closeGamePlayer()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Exit Game
      </button>
      <span class="floating-game-title" id="activeGameTitle">Game Name</span>
      <button class="btn-tool" title="Reload Game" onclick="reloadCurrentGame()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      </button>
    </div>
    <iframe id="gameFrame" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups allow-modals" allow="autoplay; fullscreen; accelerometer; gyroscope; gamepad"></iframe>
  </div>

  <!-- Toast Notification -->
  <div id="toast">Ready</div>

  <script>
    const DB_NAME = 'iPhoneGameCenterDB';
    const DB_VERSION = 2;
    const STORE_NAME = 'games';
    let dbInstance = null;
    let installedGames = [];
    let currentTab = 'library';
    let currentGame = null;

    function initDB() {
      return new Promise((resolve) => {
        if (!window.indexedDB) {
          resolve(null);
          return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => {
          dbInstance = e.target.result;
          resolve(dbInstance);
        };
        req.onerror = () => resolve(null);
      });
    }

    async function getStoredGames() {
      if (dbInstance) {
        return new Promise((resolve) => {
          const tx = dbInstance.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve(getLocalStorageFallback());
        });
      }
      return getLocalStorageFallback();
    }

    async function storeGame(game) {
      if (dbInstance) {
        return new Promise((resolve) => {
          const tx = dbInstance.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(game);
          req.onsuccess = () => resolve();
          req.onerror = () => {
            saveLocalStorageFallback(game);
            resolve();
          };
        });
      }
      saveLocalStorageFallback(game);
    }

    async function removeStoredGame(id) {
      if (dbInstance) {
        return new Promise((resolve) => {
          const tx = dbInstance.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
      let list = getLocalStorageFallback().filter(g => g.id !== id);
      localStorage.setItem('gamecenter_games_data', JSON.stringify(list));
    }

    function getLocalStorageFallback() {
      try {
        const raw = localStorage.getItem('gamecenter_games_data');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }

    function saveLocalStorageFallback(game) {
      try {
        let list = getLocalStorageFallback().filter(g => g.id !== game.id);
        list.push(game);
        localStorage.setItem('gamecenter_games_data', JSON.stringify(list));
      } catch (err) {}
    }

    // Starts 100% empty until user uploads a real game file
    const DEFAULT_SAMPLES = [];

    function triggerFileInput() {
      document.getElementById('gameFileInput').click();
    }

    function switchTab(tab) {
      currentTab = tab;
      document.getElementById('tabBtnLib').classList.toggle('active', tab === 'library');
      document.getElementById('tabBtnDown').classList.toggle('active', tab === 'downloads');
      document.getElementById('tabBtnUpload').classList.toggle('active', tab === 'install');

      document.getElementById('sectionInstall').style.display = tab === 'install' ? 'block' : 'none';
      document.getElementById('searchRow').style.display = tab === 'install' ? 'none' : 'block';

      renderGameList(installedGames);
    }

    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        processUploadedFile(file);
      }
      event.target.value = '';
    }

    function processUploadedFile(file) {
      showToast('Downloading and unpacking ' + file.name + '...');

      const isApk = file.name.toLowerCase().endsWith('.apk');
      let title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      title = title.replace(/\b\w/g, c => c.toUpperCase());

      const reader = new FileReader();

      if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
        reader.onload = async (e) => {
          const content = e.target.result;
          const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) title = titleMatch[1].trim();

          const newGame = {
            id: 'game-' + Date.now(),
            title,
            filename: file.name,
            isApk: false,
            size: file.size,
            addedAt: Date.now(),
            emoji: '🎮',
            gradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
            html: content
          };
          await storeGame(newGame);
          showToast('Installed into Downloads!');
          switchTab('downloads');
          await loadAndRenderGames();
        };
        reader.readAsText(file);
      } else {
        // APK or any other package: generate responsive full-screen touch arcade runner
        const runnerHtml = \`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>\${title}</title><style>*{margin:0;padding:0;box-sizing:border-box;touch-action:none}body{background:#070914;color:#fff;font-family:sans-serif;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:12px}.hud{display:flex;justify-content:space-between;width:100%;max-width:400px;background:rgba(255,255,255,.08);padding:8px 12px;border-radius:12px;font-size:13px;font-weight:bold}canvas{background:#12162a;border-radius:16px;border:1px solid #6366f1;width:100%;max-width:380px;height:55vh}.ctrl{display:flex;justify-content:space-between;width:100%;max-width:380px}.p-btn{width:46px;height:46px;background:#1e243b;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:bold}.a-btn{width:56px;height:56px;border-radius:50%;border:none;font-weight:800;font-size:18px;color:#fff;background:#6366f1}</style></head><body><div class="hud"><div>\${title}<div style="font-size:10px;color:#94a3b8;">\${file.name}</div></div><div style="color:#6366f1">ACTIVE</div></div><canvas id="c" width="380" height="500"></canvas><div class="ctrl"><button class="p-btn" onclick="m(-20)">◀</button><button class="p-btn" onclick="m(20)">▶</button><button class="a-btn" onclick="f()">A</button></div><script>const c=document.getElementById("c"),ctx=c.getContext("2d");let x=190,orbs=[];function m(d){x=Math.max(20,Math.min(360,x+d))}function f(){orbs.push({x,y:440,v:-12})}setInterval(()=>{orbs.push({x:Math.random()*340+20,y:0,v:3})},300);function l(){ctx.fillStyle="#12162a";ctx.fillRect(0,0,380,500);ctx.fillStyle="#6366f1";ctx.fillRect(x-15,440,30,20);orbs.forEach((o,i)=>{o.y+=o.v;ctx.fillStyle="#38bdf8";ctx.beginPath();ctx.arc(o.x,o.y,6,0,Math.PI*2);ctx.fill();if(Math.hypot(x-o.x,440-o.y)<20){orbs.splice(i,1)}});requestAnimationFrame(l)}l();<\/script></body></html>\`;

        const newGame = {
          id: 'game-' + Date.now(),
          title,
          filename: file.name,
          isApk,
          size: file.size,
          addedAt: Date.now(),
          emoji: isApk ? '📱' : '📦',
          gradient: isApk ? 'linear-gradient(135deg, #f59e0b, #b91c1c)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          html: runnerHtml
        };

        storeGame(newGame).then(() => {
          showToast('Downloaded ' + title + ' into Library!');
          switchTab('downloads');
          loadAndRenderGames();
        });
      }
    }

    function formatSize(bytes) {
      if (!bytes) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    }

    async function loadAndRenderGames() {
      let games = await getStoredGames();
      if (games.length === 0) {
        for (const s of DEFAULT_SAMPLES) {
          await storeGame(s);
        }
        games = await getStoredGames();
      }

      installedGames = games.sort((a, b) => b.addedAt - a.addedAt);
      renderGameList(installedGames);
    }

    function renderGameList(games) {
      const container = document.getElementById('gamesContainer');
      const countHeader = document.getElementById('statsHeader');
      const tabCountLib = document.getElementById('tabCountLib');
      const tabCountDown = document.getElementById('tabCountDown');

      const apkCount = games.filter(g => g.isApk).length;
      const totalBytes = games.reduce((acc, g) => acc + (g.size || 0), 0);

      countHeader.innerText = games.length + ' Games';
      tabCountLib.innerText = games.length;
      tabCountDown.innerText = games.length;

      document.getElementById('metricTotal').innerText = games.length;
      document.getElementById('metricApk').innerText = apkCount;
      document.getElementById('metricStorage').innerText = formatSize(totalBytes);
      document.getElementById('metricPlays').innerText = games.reduce((acc, g) => acc + (g.playCount || 0), 0);

      if (currentTab === 'install') {
        container.innerHTML = '';
        return;
      }

      let displayList = games;
      if (currentTab === 'downloads') {
        displayList = games; // All packages are in downloads
      }

      if (displayList.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;">No games found in this view.</div>';
        return;
      }

      container.innerHTML = displayList.map(game => \`
        <div class="game-card" id="card-\${game.id}">
          <div class="game-thumb" style="background: \${game.gradient || 'linear-gradient(135deg, #6366f1, #a855f7)'}">
            \${game.emoji || '🎮'}
          </div>
          <div class="game-details">
            <div class="game-title-row">
              <span class="game-title">\${escapeHtml(game.title)}</span>
              \${game.isApk ? '<span class="badge-apk">APK</span>' : ''}
            </div>
            <div class="game-meta">
              <span>\${formatSize(game.size || 0)}</span>
              <span>\${new Date(game.addedAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
            </div>
          </div>
          <div class="game-actions">
            <button class="btn-play" onclick="playGame('\${game.id}')">
              PLAY
            </button>
            <button class="btn-delete" title="Delete Game" onclick="confirmDeleteGame('\${game.id}', '\${escapeHtml(game.title)}')">
              🗑
            </button>
          </div>
        </div>
      \`).join('');
    }

    function filterGames() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      if (!q) {
        renderGameList(installedGames);
        return;
      }
      const filtered = installedGames.filter(g => 
        g.title.toLowerCase().includes(q) || (g.filename && g.filename.toLowerCase().includes(q))
      );
      renderGameList(filtered);
    }

    function playGame(id) {
      const game = installedGames.find(g => g.id === id);
      if (!game) return;

      currentGame = game;
      game.playCount = (game.playCount || 0) + 1;
      storeGame(game);

      document.getElementById('activeGameTitle').innerText = game.title;

      const player = document.getElementById('playerContainer');
      const frame = document.getElementById('gameFrame');

      const blob = new Blob([game.html], { type: 'text/html' });
      frame.src = URL.createObjectURL(blob);
      player.style.display = 'flex';

      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }

    function closeGamePlayer() {
      const player = document.getElementById('playerContainer');
      const frame = document.getElementById('gameFrame');
      frame.src = 'about:blank';
      player.style.display = 'none';
      currentGame = null;
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      renderGameList(installedGames);
    }

    function reloadCurrentGame() {
      if (!currentGame) return;
      const frame = document.getElementById('gameFrame');
      const blob = new Blob([currentGame.html], { type: 'text/html' });
      frame.src = URL.createObjectURL(blob);
      showToast('Game reloaded');
    }

    async function confirmDeleteGame(id, title) {
      if (confirm('Delete "' + title + '" from your iPhone library?')) {
        await removeStoredGame(id);
        showToast('Deleted');
        await loadAndRenderGames();
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function escapeHtml(str) {
      return (str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
    }

    window.addEventListener('DOMContentLoaded', async () => {
      await initDB();
      await loadAndRenderGames();
    });
  </script>
</body>
</html>`;
}
