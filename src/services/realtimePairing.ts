import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { ControllerInputState, RealtimeMessage } from '../types/realtime';

export type PairingRole = 'tv' | 'controller';

export interface PairingListener {
  onPaired?: (info: { roomCode: string; deviceName?: string }) => void;
  onInput?: (input: ControllerInputState, keyEvents?: Array<{ code: string; key: string; action: 'down' | 'up'; keyCode?: number }>) => void;
  onDisconnect?: () => void;
  onLatencyUpdate?: (latencyMs: number) => void;
}

class RealtimePairingService {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private ws: WebSocket | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private roomCode: string = '';
  private role: PairingRole = 'tv';
  private listeners: Set<PairingListener> = new Set();
  private isPaired: boolean = false;
  private lastPingTime: number = 0;
  private pingInterval: any = null;

  constructor() {
    this.initSupabaseClient();
  }

  private async initSupabaseClient() {
    if (typeof window === 'undefined') return;
    try {
      // Query server for public Supabase configuration
      const res = await fetch('/api/supabase/config');
      if (res.ok) {
        const config = await res.json();
        if (config.url && config.anonKey) {
          this.supabase = createClient(config.url, config.anonKey, {
            realtime: {
              params: {
                eventsPerSecond: 60,
              },
            },
          });
        }
      }
    } catch {
      // Will rely on WebSocket + BroadcastChannel fallback
    }
  }

  /**
   * Generates a clean 6-character room code (e.g. "CAR-784")
   */
  public generateRoomCode(): string {
    const prefixes = ['CAR', 'DRV', 'SIM', 'RACE', 'SPD', 'TURBO'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${num}`;
  }

  /**
   * Connect as TV Display receiver
   */
  public startTvSession(code?: string): string {
    this.cleanup();
    this.role = 'tv';
    this.roomCode = (code || this.generateRoomCode()).toUpperCase().trim();
    this.setupChannels();
    return this.roomCode;
  }

  /**
   * Connect as iPhone Controller
   */
  public connectController(code: string, deviceName = 'iPhone'): boolean {
    if (!code || !code.trim()) return false;
    this.cleanup();
    this.role = 'controller';
    this.roomCode = code.toUpperCase().trim();
    this.setupChannels();

    // Send pair request
    setTimeout(() => {
      this.broadcastMessage({
        type: 'PAIR_REQUEST',
        roomCode: this.roomCode,
        deviceInfo: { name: deviceName, isMobile: true },
        timestamp: Date.now(),
      });
    }, 150);

    return true;
  }

  private setupChannels() {
    if (!this.roomCode || typeof window === 'undefined') return;

    // 1. Same-device BroadcastChannel for instant local testing
    try {
      this.localBroadcast = new BroadcastChannel(`car_sim_room_${this.roomCode}`);
      this.localBroadcast.onmessage = (e) => {
        this.handleMessage(e.data);
      };
    } catch (e) {}

    // 2. Ultra-low latency WebSocket connection to backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/airplay?session=${encodeURIComponent(this.roomCode)}&role=${this.role}`;
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        // Send initial handshake
        if (this.role === 'controller') {
          this.broadcastMessage({
            type: 'PAIR_REQUEST',
            roomCode: this.roomCode,
            deviceInfo: { name: 'iPhone Controller', isMobile: true },
            timestamp: Date.now(),
          });
        }
      };
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch {}
      };
      this.ws.onclose = () => {
        this.ws = null;
      };
    } catch (err) {}

    // 3. Supabase Realtime Channel
    if (this.supabase) {
      try {
        const channelName = `room_${this.roomCode}`;
        this.channel = this.supabase.channel(channelName);

        this.channel
          .on('broadcast', { event: 'room_event' }, (payload) => {
            if (payload && payload.payload) {
              this.handleMessage(payload.payload as RealtimeMessage);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED' && this.role === 'controller') {
              this.broadcastMessage({
                type: 'PAIR_REQUEST',
                roomCode: this.roomCode,
                deviceInfo: { name: 'iPhone Controller', isMobile: true },
                timestamp: Date.now(),
              });
            }
          });
      } catch (e) {
        console.warn('Supabase Realtime subscription note:', e);
      }
    }

    // Ping interval for latency check
    this.pingInterval = setInterval(() => {
      if (this.isPaired) {
        this.lastPingTime = Date.now();
        this.broadcastMessage({ type: 'PING', timestamp: this.lastPingTime });
      }
    }, 4000);
  }

  /**
   * Broadcast message through all active links (Supabase Realtime + WS + BroadcastChannel)
   */
  public broadcastMessage(msg: RealtimeMessage) {
    const raw = JSON.stringify(msg);

    // 1. Local Broadcast
    if (this.localBroadcast) {
      try {
        this.localBroadcast.postMessage(msg);
      } catch {}
    }

    // 2. WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(raw);
      } catch {}
    }

    // 3. Supabase Realtime
    if (this.channel) {
      try {
        this.channel.send({
          type: 'broadcast',
          event: 'room_event',
          payload: msg,
        });
      } catch {}
    }
  }

  /**
   * Send controller inputs (Steering, Gas, Brake, Drift, Boost)
   */
  public sendControllerInput(
    input: ControllerInputState,
    keyEvents?: Array<{ code: string; key: string; action: 'down' | 'up'; keyCode?: number }>
  ) {
    if (!this.roomCode) return;
    this.broadcastMessage({
      type: 'CONTROLLER_INPUT',
      roomCode: this.roomCode,
      input,
      keyEvents,
      timestamp: Date.now(),
    });
  }

  private handleMessage(msg: RealtimeMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'PAIR_REQUEST': {
        if (this.role === 'tv') {
          this.isPaired = true;
          // Send back ACK
          this.broadcastMessage({
            type: 'PAIR_ACK',
            roomCode: this.roomCode,
            gameUrl: 'https://play.unity.com/en/games/b8915ae5-7634-4424-93ad-73778832a84b/car-sim-test',
            timestamp: Date.now(),
          });
          this.listeners.forEach((l) =>
            l.onPaired?.({
              roomCode: this.roomCode,
              deviceName: msg.deviceInfo?.name || 'iPhone Controller',
            })
          );
        }
        break;
      }

      case 'PAIR_ACK': {
        this.isPaired = true;
        this.listeners.forEach((l) =>
          l.onPaired?.({
            roomCode: this.roomCode,
            deviceName: 'Smart TV Display',
          })
        );
        break;
      }

      case 'CONTROLLER_INPUT': {
        if (this.role === 'tv') {
          this.listeners.forEach((l) => l.onInput?.(msg.input, msg.keyEvents));
        }
        break;
      }

      case 'DISCONNECT': {
        this.isPaired = false;
        this.listeners.forEach((l) => l.onDisconnect?.());
        break;
      }

      case 'PING': {
        this.broadcastMessage({ type: 'PONG', timestamp: msg.timestamp });
        break;
      }

      case 'PONG': {
        const latency = Math.max(1, Math.round((Date.now() - msg.timestamp) / 2));
        this.listeners.forEach((l) => l.onLatencyUpdate?.(latency));
        break;
      }
    }
  }

  public subscribe(listener: PairingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getIsPaired(): boolean {
    return this.isPaired;
  }

  public disconnect() {
    if (this.isPaired && this.roomCode) {
      this.broadcastMessage({
        type: 'DISCONNECT',
        roomCode: this.roomCode,
        timestamp: Date.now(),
      });
    }
    this.cleanup();
    this.listeners.forEach((l) => l.onDisconnect?.());
  }

  private cleanup() {
    this.isPaired = false;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.localBroadcast) {
      try {
        this.localBroadcast.close();
      } catch {}
      this.localBroadcast = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.channel && this.supabase) {
      try {
        this.supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
  }
}

export const realtimePairing = new RealtimePairingService();
