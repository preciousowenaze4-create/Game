export interface ControllerInputState {
  steering: number; // -1 (full left) to +1 (full right), 0 = center
  gas: number; // 0 (idle) to 1 (full throttle)
  brake: number; // 0 (none) to 1 (full brake / reverse)
  drift: boolean; // Handbrake (Space)
  boost: boolean; // Nitro / Turbo (Shift)
  reset: boolean; // Respawn / Reset (R)
  timestamp: number;
}

export type RealtimeMessage =
  | {
      type: 'PAIR_REQUEST';
      roomCode: string;
      deviceInfo?: { name: string; isMobile: boolean };
      timestamp: number;
    }
  | {
      type: 'PAIR_ACK';
      roomCode: string;
      gameUrl: string;
      timestamp: number;
    }
  | {
      type: 'CONTROLLER_INPUT';
      roomCode: string;
      input: ControllerInputState;
      keyEvents?: Array<{
        code: string;
        key: string;
        action: 'down' | 'up';
        keyCode?: number;
      }>;
      timestamp: number;
    }
  | {
      type: 'DISCONNECT';
      roomCode: string;
      timestamp: number;
    }
  | {
      type: 'PING';
      timestamp: number;
    }
  | {
      type: 'PONG';
      timestamp: number;
    };
