import React, { useEffect, useRef, useState } from 'react';
import { Tv, Wifi, Gamepad2, Sparkles, Volume2 } from 'lucide-react';
import { resolvePlayableGameUrl } from '../utils/gameUrlHelper';

export const TvReceiverView: React.FC = () => {
  const [gameUrl, setGameUrl] = useState<string>('');
  const [controllerConnected, setControllerConnected] = useState<boolean>(false);
  const [lastGesture, setLastGesture] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // 1. Determine game URL from query params
    const params = new URLSearchParams(window.location.search);
    const rawGame = params.get('game') || 'https://games.crazygames.com/en_US/drift-hunters/index.html';
    setGameUrl(resolvePlayableGameUrl(rawGame));

    // 2. Setup BroadcastChannel for 0ms cross-window local communication
    let broadcast: BroadcastChannel | null = null;
    try {
      broadcast = new BroadcastChannel('airplay_game_channel');
      broadcast.onmessage = (e) => {
        handleRemoteCommand(e.data);
      };
    } catch (e) {}

    // 3. Setup WebSocket connection for wireless network controller commands
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/airplay?session=airplay-main-session&role=receiver`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setControllerConnected(true);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRemoteCommand(data);
        } catch (e) {}
      };
      ws.onclose = () => {
        setControllerConnected(false);
      };
    } catch (err) {}

    return () => {
      if (broadcast) broadcast.close();
      if (ws) ws.close();
    };
  }, []);

  // Handle touch / gesture / keyboard events sent from iPhone controller
  const handleRemoteCommand = (data: any) => {
    if (!data) return;
    setControllerConnected(true);

    if (data.type === 'GESTURE') {
      setLastGesture(data.gesture || '');
      setTimeout(() => setLastGesture(''), 1500);

      // Map swipe gestures to keyboard arrows
      if (data.gesture === 'swipe-up') dispatchKey('ArrowUp', 38);
      else if (data.gesture === 'swipe-down') dispatchKey('ArrowDown', 40);
      else if (data.gesture === 'swipe-left') dispatchKey('ArrowLeft', 37);
      else if (data.gesture === 'swipe-right') dispatchKey('ArrowRight', 39);
      else if (data.gesture === 'tap') dispatchKey('Space', 32);
    } else if (data.type === 'KEY_DOWN') {
      dispatchKeyEvent(data.code || 'Space', data.key || ' ', true, data.keyCode || 32);
    } else if (data.type === 'KEY_UP') {
      dispatchKeyEvent(data.code || 'Space', data.key || ' ', false, data.keyCode || 32);
    } else if (data.type === 'TOUCH_TAP') {
      dispatchKey('Space', 32);
    }
  };

  const dispatchKey = (code: string, keyCode: number) => {
    dispatchKeyEvent(code, code, true, keyCode);
    setTimeout(() => dispatchKeyEvent(code, code, false, keyCode), 120);
  };

  const dispatchKeyEvent = (code: string, key: string, isDown: boolean, keyCode: number) => {
    const eventType = isDown ? 'keydown' : 'keyup';
    const ev = new KeyboardEvent(eventType, {
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
    });

    window.dispatchEvent(ev);
    document.dispatchEvent(ev);

    // Forward to iframe if same-origin or postMessage
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage(
          {
            type: 'VIRTUAL_KEY',
            action: isDown ? 'down' : 'up',
            code,
            key,
            keyCode,
          },
          '*'
        );
      } catch (e) {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col w-screen h-screen overflow-hidden select-none">
      {/* Top TV HUD Bar */}
      <div className="absolute top-4 left-6 right-6 z-40 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 text-white shadow-2xl">
          <Tv className="w-5 h-5 text-indigo-400" />
          <span className="text-xs font-bold tracking-wide">AirPlay Big Screen Receiver</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
        </div>

        {controllerConnected && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-950/80 backdrop-blur-md border border-indigo-500/40 text-white shadow-2xl animate-in fade-in">
            <Gamepad2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-indigo-200">
              iPhone Remote Connected
            </span>
            {lastGesture && (
              <span className="text-xs font-bold text-amber-300 ml-1">
                [{lastGesture}]
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Fullscreen TV Game Display */}
      <iframe
        ref={iframeRef}
        src={gameUrl}
        title="AirPlay TV Game Display"
        className="w-full h-full border-none bg-black block"
        allow="autoplay; fullscreen; accelerometer; gyroscope; gamepad; cross-origin-isolated; pointer-lock"
      />
    </div>
  );
};
