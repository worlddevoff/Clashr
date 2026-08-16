import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { wsUrl } from './api';
import { getSessionToken } from './session';

export function connectTowerSocket(onMsg: (msg: ServerMsg) => void): {
  send: (msg: ClientMsg) => void;
  close: () => void;
} {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  const pending: ClientMsg[] = [];

  const flush = (socket: WebSocket) => {
    while (pending.length && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(pending.shift()));
    }
  };

  const connect = () => {
    if (closed) return;
    const token = getSessionToken();
    const socket = new WebSocket(wsUrl(token || ''));
    ws = socket;
    socket.onmessage = (ev) => {
      try {
        onMsg(JSON.parse(String(ev.data)) as ServerMsg);
      } catch {
        /* ignore */
      }
    };
    socket.onopen = () => {
      attempt = 0;
      flush(socket);
    };
    socket.onclose = () => {
      if (closed) return;
      const wait = Math.min(8000, 400 * 2 ** attempt);
      attempt += 1;
      window.setTimeout(connect, wait);
    };
  };

  connect();

  const send = (msg: ClientMsg) => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else pending.push(msg);
  };

  return {
    send,
    close: () => {
      closed = true;
      pending.length = 0;
      ws?.close();
    },
  };
}
