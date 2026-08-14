import type { TowerEvent, TowerMoment, TowerPlayerState } from './types';

function playerMap(players: TowerPlayerState[]): Map<string, TowerPlayerState> {
  return new Map(players.map((p) => [p.id, p]));
}

export function detectMoments(players: TowerPlayerState[], events: TowerEvent[]): TowerMoment[] {
  const byId = playerMap(players);
  const moments: TowerMoment[] = [];
  const shoveHits = new Map<string, { count: number; floor: number }>();

  for (const e of events) {
    if ((e.kind === 'shove' || e.kind === 'shove_ko') && e.actorId) {
      const prev = shoveHits.get(e.actorId) ?? { count: 0, floor: e.floor ?? 1 };
      shoveHits.set(e.actorId, {
        count: prev.count + 1,
        floor: Math.max(prev.floor, e.floor ?? 1),
      });
    }
  }

  let bestShove: { id: string; count: number; floor: number } | null = null;
  for (const [id, v] of shoveHits) {
    if (!bestShove || v.count > bestShove.count) bestShove = { id, ...v };
  }
  if (bestShove && bestShove.count >= 2) {
    const p = byId.get(bestShove.id);
    if (p) {
      moments.push({
        id: 'biggest_shove',
        kind: 'biggest_shove',
        headline: `${p.username} knocked ${bestShove.count} players off Floor ${bestShove.floor}.`,
        player: p.username,
        avatar: p.avatar,
        color: p.color,
        stat: `${bestShove.count} shoves`,
      });
    }
  }

  const falls = events.filter((e) => e.kind === 'fall' && e.mag && e.mag >= 3);
  falls.sort((a, b) => (b.mag ?? 0) - (a.mag ?? 0));
  if (falls[0]?.targetId) {
    const p = byId.get(falls[0].targetId);
    if (p) {
      moments.push({
        id: 'biggest_fall',
        kind: 'biggest_fall',
        headline: `${p.username} fell ${Math.round(falls[0].mag ?? 0)} floors.`,
        player: p.username,
        avatar: p.avatar,
        color: p.color,
        stat: `${Math.round(falls[0].mag ?? 0)} floors`,
      });
    }
  }

  const saves = events.filter((e) => e.kind === 'ledge_save');
  const lastSave = saves[saves.length - 1];
  if (lastSave?.targetId) {
    const p = byId.get(lastSave.targetId);
    if (p) {
      moments.push({
        id: 'last_second_save',
        kind: 'last_second_save',
        headline: `${p.username} grabbed the ledge with ${(lastSave.mag ?? 0.3).toFixed(1)}s left.`,
        player: p.username,
        avatar: p.avatar,
        color: p.color,
        stat: 'Ledge save',
      });
    }
  }

  const finalists = events.filter((e) => e.kind === 'final');
  const aliveAtEnd = players.filter((p) => p.maxFloor >= 26);
  if (finalists.length || aliveAtEnd.length >= 2) {
    const names = players
      .filter((p) => p.alive || (p.maxFloor >= 28))
      .slice(0, 2);
    if (names.length >= 2) {
      moments.push({
        id: 'final_duel',
        kind: 'final_duel',
        headline: `${names.length} players reached the final floors.`,
        player: names[0].username,
        avatar: names[0].avatar,
        color: names[0].color,
        stat: 'Final climb',
      });
    }
  }

  return moments;
}
