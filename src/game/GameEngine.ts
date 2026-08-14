// Framework-agnostic base class for arcade games. Additional games (Tower,
// Floor Is Cash, ...) can extend this contract. The engine owns game state and
// is authoritative over outcomes — the UI only renders snapshots and forwards
// intent. In a real deployment this exact loop would run server-side and stream
// snapshots over WebSockets; here it runs client-side against bot opponents.
import type { EngineSnapshot } from '../types/game';

export type SnapshotListener = (snap: EngineSnapshot) => void;

export abstract class GameEngine {
  protected listeners = new Set<SnapshotListener>();
  protected raf: number | null = null;
  protected lastTs = 0;
  protected running = false;

  abstract readonly id: string;
  abstract step(dtMs: number): void;
  abstract snapshot(): EngineSnapshot;

  subscribe(fn: SnapshotListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      const dt = Math.min(48, ts - this.lastTs); // clamp to avoid tunneling
      this.lastTs = ts;
      this.step(dt);
      this.emit();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
}
