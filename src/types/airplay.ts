export interface AirPlayDevice {
  id: string;
  name: string;
  model: 'Apple TV 4K' | 'Apple TV HD' | 'AirPlay 2 Receiver' | 'Smart Display';
  ip?: string;
  resolution: string;
  isOnline: boolean;
  rssi?: number;
  lastSeen: number;
}

export type AirPlayConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected';

export type TVDisplayMode = 'catalog' | 'playing';

export interface TVSharedState {
  mode: TVDisplayMode;
  activeGameId: string | null;
  activeGameTitle: string | null;
  focusedIndex: number;
  category: string;
  totalGames: number;
}

export interface RemoteControllerCommand {
  type:
    | 'KEY_DOWN'
    | 'KEY_UP'
    | 'GESTURE'
    | 'TOUCH_MOVE'
    | 'TOUCH_TAP'
    | 'NAVIGATE'
    | 'SELECT_GAME'
    | 'SET_CATEGORY'
    | 'EXIT_GAME'
    | 'REQUEST_SYNC'
    | 'SYNC_TV_STATE'
    | 'DISCONNECT';
  key?: string;
  code?: string;
  keyCode?: number;
  deltaX?: number;
  deltaY?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  gameId?: string;
  category?: string;
  gesture?: 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right' | 'tap' | 'double-tap';
  tvState?: Partial<TVSharedState>;
  timestamp: number;
  sessionId: string;
}
