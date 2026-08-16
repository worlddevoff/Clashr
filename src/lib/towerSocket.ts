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
  let authenticated = false;
  const pending: ClientMsg[] = [];

  const flush = (socket: WebSocket) => {
    while (authenticated && pending.length && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(pending.shift()));
    }
  };

  const connect = () => {
    if (closed) return;
    const token = getSessionToken();
    const socket = new WebSocket(wsUrl());
    ws = socket;
    authenticated = false;
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;
        if (msg.type === 'hello') {
          authenticated = true;
          attempt = 0;
          flush(socket);
        }
        onMsg(msg);
      } catch {
        /* ignore */
      }
    };
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token: token || '' } satisfies ClientMsg));
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
    if (ws && authenticated && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
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
