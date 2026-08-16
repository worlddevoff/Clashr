import type { ArenaHazard } from '../types/game';
import { getBombMap } from './bombMaps';

/** Default layout retained for callers that do not select a map explicitly. */
export function buildArenaHazards(width: number, height: number): ArenaHazard[] {
  return getBombMap(0, width, height).hazards;
}
