import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { getTowerToken } from './towerApi';

export function connectTowerSocket(onMsg: (msg: ServerMsg) => void): {
  send: (msg: ClientMsg) => void;
  close: () => void;
} {
  const token = getTowerToken();
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${window.location.host}/ws?token=${encodeURIComponent(token || '')}`;
  const ws = new WebSocket(url);
  ws.onmessage = (ev) => {
    try {
      onMsg(JSON.parse(String(ev.data)) as ServerMsg);
    } catch {
      /* ignore */
    }
  };
  const send = (msg: ClientMsg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else {
      const t = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
          window.clearInterval(t);
        }
      }, 50);
      window.setTimeout(() => window.clearInterval(t), 4000);
    }
  };
  return { send, close: () => ws.close() };
}
