import { RemoteControllerCommand, TVSharedState } from '../types/airplay';

type AirPlayListener = (isCasting: boolean) => void;
type TVStateListener = (state: TVSharedState) => void;

class NativeAirPlayService {
  private videoElement: HTMLVideoElement | null = null;
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isCasting: boolean = false;
  private sessionId: string = 'airplay-session';
  private listeners: Set<AirPlayListener> = new Set();
  private stateListeners: Set<TVStateListener> = new Set();
  private isInitialized: boolean = false;

  private tvState: TVSharedState = {
    mode: 'catalog',
    activeGameId: null,
    activeGameTitle: null,
    focusedIndex: 0,
    category: 'All',
    totalGames: 332,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('airplay_game_channel');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingCommand(event.data);
        };
      } catch (e) {}

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        this.init();
      } else {
        window.addEventListener('DOMContentLoaded', () => this.init());
      }
    }
  }

  public init() {
    if (this.isInitialized || typeof document === 'undefined') return;
    this.isInitialized = true;

    // Create a real media element wired to iOS system AirPlay
    const video = document.createElement('video');
    video.id = 'native-ios-airplay-target';
    video.setAttribute('x-webkit-airplay', 'allow');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('preload', 'auto');
    video.setAttribute('muted', 'true');
    video.muted = true;
    video.style.position = 'fixed';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.bottom = '0';
    video.style.right = '0';
    video.style.zIndex = '-999';

    // Generate an active canvas stream so iOS recognizes an active media session for AirPlay
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 640, 360);
      }
      const stream = canvas.captureStream ? canvas.captureStream(15) : null;
      if (stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    } catch (e) {}

    // Listen for real native iOS AirPlay route transition
    video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged' as any, () => {
      const isWireless = Boolean((video as any).webkitCurrentPlaybackTargetIsWireless);
      console.log('[Native iOS AirPlay Target Changed]: isWireless =', isWireless);
      this.setIsCasting(isWireless);
    });

    // Remote Playback API listeners for standard modern browsers
    if ((video as any).remote) {
      (video as any).remote.addEventListener('connect', () => {
        this.setIsCasting(true);
      });
      (video as any).remote.addEventListener('disconnect', () => {
        this.setIsCasting(false);
      });
    }

    document.body.appendChild(video);
    this.videoElement = video;
  }

  /**
   * Triggers the real native iOS AirPlay route picker (system AVRoutePickerView / sheet)
   */
  public triggerNativeAirPlayPicker(): boolean {
    this.init();

    // 1. WebKit native iOS AirPlay route picker
    if (this.videoElement && typeof (this.videoElement as any).webkitShowPlaybackTargetPicker === 'function') {
      try {
        (this.videoElement as any).webkitShowPlaybackTargetPicker();
        return true;
      } catch (err) {
        console.warn('Native iOS AirPlay picker error:', err);
      }
    }

    // 2. Standard W3C Remote Playback API
    if (this.videoElement && (this.videoElement as any).remote?.prompt) {
      try {
        (this.videoElement as any).remote.prompt().then(() => {
          this.setIsCasting(true);
        }).catch((err: any) => {
          console.warn('Remote prompt cancelled or error:', err);
        });
        return true;
      } catch (e) {}
    }

    // 3. Presentation API fallback
    if (typeof window !== 'undefined' && (window as any).PresentationRequest) {
      try {
        const request = new (window as any).PresentationRequest(['/tv']);
        request.start().then(() => {
          this.setIsCasting(true);
        }).catch(() => {});
        return true;
      } catch (e) {}
    }

    // 4. Also enable casting state so user can pair with TV screen immediately
    this.setIsCasting(true);
    return true;
  }

  public setIsCasting(active: boolean) {
    if (this.isCasting === active) return;
    this.isCasting = active;

    if (active) {
      this.initWebSocket();
      // Request TV current state
      this.sendCommand({ type: 'REQUEST_SYNC' });
    } else {
      if (this.ws) {
        try {
          this.ws.close();
        } catch (e) {}
        this.ws = null;
      }
    }

    this.listeners.forEach((cb) => cb(this.isCasting));
  }

  public subscribe(cb: AirPlayListener) {
    this.listeners.add(cb);
    cb(this.isCasting);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public subscribeTVState(cb: TVStateListener) {
    this.stateListeners.add(cb);
    cb(this.tvState);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  public getTVState(): TVSharedState {
    return this.tvState;
  }

  public updateTVState(partial: Partial<TVSharedState>, broadcast = true) {
    this.tvState = { ...this.tvState, ...partial };
    this.stateListeners.forEach((cb) => cb(this.tvState));

    if (broadcast) {
      this.sendCommand({
        type: 'SYNC_TV_STATE',
        tvState: this.tvState,
      });
    }
  }

  public getIsCasting(): boolean {
    return this.isCasting;
  }

  public disconnect() {
    this.sendCommand({ type: 'DISCONNECT' });
    this.setIsCasting(false);
  }

  // Navigation commands for browsing games on TV
  public navigate(direction: 'up' | 'down' | 'left' | 'right') {
    this.sendCommand({
      type: 'NAVIGATE',
      direction,
    });
  }

  public selectGame(gameId?: string) {
    this.sendCommand({
      type: 'SELECT_GAME',
      gameId,
    });
  }

  public exitGameToCatalog() {
    this.sendCommand({
      type: 'EXIT_GAME',
    });
  }

  public setCategory(category: string) {
    this.sendCommand({
      type: 'SET_CATEGORY',
      category,
    });
  }

  // Send real-time remote controller touch/gesture/key commands to the game on the TV
  public sendCommand(cmd: Omit<RemoteControllerCommand, 'timestamp' | 'sessionId'>) {
    const fullCmd: RemoteControllerCommand = {
      ...cmd,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    // 1. Local cross-window BroadcastChannel (0ms latency)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(fullCmd);
      } catch (e) {}
    }

    // 2. WebSocket for network TV receiver
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(fullCmd));
      } catch (e) {}
    }
  }

  private handleIncomingCommand(cmd: RemoteControllerCommand) {
    if (!cmd) return;

    if (cmd.type === 'SYNC_TV_STATE' && cmd.tvState) {
      this.updateTVState(cmd.tvState, false);
    } else if (cmd.type === 'DISCONNECT') {
      this.setIsCasting(false);
    }
  }

  private initWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/airplay?session=${encodeURIComponent(this.sessionId)}&role=controller`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingCommand(data);
        } catch (e) {}
      };
    } catch (err) {}
  }
}

export const airPlayService = new NativeAirPlayService();
