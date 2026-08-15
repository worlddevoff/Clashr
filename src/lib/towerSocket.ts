import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { wsUrl } from './api';
import { getSessionToken } from './session';

export function connectTowerSocket(onMsg: (msg: ServerMsg) => void): {
  send: (msg: ClientMsg) => void;
  close: () => void;
} {
  const token = getSessionToken();
  const url = wsUrl(token || '');
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
