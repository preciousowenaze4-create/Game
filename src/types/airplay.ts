export interface AirPlayDevice {
  id: string;
  name: string;
  model: 'Apple TV 4K' | 'Apple TV HD' | 'AirPlay 2 Receiver' | 'Smart Display';
  ip?: string;
  resolution: string;
  isOnline: boolean;
  rssi?: number; // signal strength
  lastSeen: number;
}

export type AirPlayConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected';

export interface RemoteControllerCommand {
  type: 'KEY_DOWN' | 'KEY_UP' | 'GESTURE' | 'TOUCH_MOVE' | 'TOUCH_TAP' | 'DISCONNECT';
  key?: string;
  code?: string;
  keyCode?: number;
  deltaX?: number;
  deltaY?: number;
  gesture?: 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right' | 'tap' | 'double-tap';
  timestamp: number;
  sessionId: string;
}
