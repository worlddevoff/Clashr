import type { ArenaHazard } from '../types/game';

export interface BombMapTheme {
  surface: string;
  ambient: string;
  gridOpacity: number;
  ice: string;
  iceBorder: string;
  block: string;
  blockBorder: string;
}

export interface BombMap {
  id: string;
  name: string;
  hazards: ArenaHazard[];
  theme: BombMapTheme;
}

const BASE_ARENA = { width: 900, height: 620 };

const MAPS: readonly BombMap[] = [
  {
    id: 'neon-nexus',
    name: 'Neon Nexus',
    hazards: [
      { id: 'n-b1', kind: 'block', x: 290, y: 270, w: 70, h: 70 },
      { id: 'n-b2', kind: 'block', x: 540, y: 270, w: 70, h: 70 },
      { id: 'n-b3', kind: 'block', x: 415, y: 420, w: 70, h: 56 },
      { id: 'n-i1', kind: 'ice', x: 80, y: 80, w: 140, h: 90 },
      { id: 'n-i2', kind: 'ice', x: 680, y: 450, w: 140, h: 90 },
      { id: 'n-i3', kind: 'ice', x: 380, y: 70, w: 140, h: 70 },
    ],
    theme: {
      surface: 'linear-gradient(145deg, #10101d 0%, #090914 55%, #151020 100%)',
      ambient: 'radial-gradient(circle at 50% 50%, rgba(255,43,43,0.09), transparent 65%)',
      gridOpacity: 0.4,
      ice: 'linear-gradient(135deg, rgba(120,210,255,0.22), rgba(34,229,255,0.08))',
      iceBorder: 'rgba(34,229,255,0.35)',
      block: 'linear-gradient(160deg, #1a1a2e 0%, #0d0d18 55%, #16162a 100%)',
      blockBorder: 'rgba(255,255,255,0.12)',
    },
  },
  {
    id: 'split-shift',
    name: 'Split Shift',
    hazards: [
      { id: 's-b1', kind: 'block', x: 415, y: 155, w: 70, h: 90 },
      { id: 's-b2', kind: 'block', x: 415, y: 375, w: 70, h: 90 },
      { id: 's-b3', kind: 'block', x: 285, y: 275, w: 90, h: 70 },
      { id: 's-b4', kind: 'block', x: 525, y: 275, w: 90, h: 70 },
      { id: 's-i1', kind: 'ice', x: 285, y: 250, w: 105, h: 120 },
      { id: 's-i2', kind: 'ice', x: 510, y: 250, w: 105, h: 120 },
    ],
    theme: {
      surface: 'linear-gradient(135deg, #07151b 0%, #0b101a 48%, #15102a 100%)',
      ambient: 'radial-gradient(circle at 50% 50%, rgba(34,229,255,0.13), transparent 62%)',
      gridOpacity: 0.3,
      ice: 'linear-gradient(145deg, rgba(52,255,221,0.24), rgba(34,229,255,0.07))',
      iceBorder: 'rgba(52,255,221,0.42)',
      block: 'linear-gradient(160deg, #16303a 0%, #09141c 58%, #112934 100%)',
      blockBorder: 'rgba(52,255,221,0.2)',
    },
  },
  {
    id: 'violet-orbit',
    name: 'Violet Orbit',
    hazards: [
      { id: 'v-b1', kind: 'block', x: 335, y: 205, w: 75, h: 60 },
      { id: 'v-b2', kind: 'block', x: 490, y: 205, w: 75, h: 60 },
      { id: 'v-b3', kind: 'block', x: 335, y: 355, w: 75, h: 60 },
      { id: 'v-b4', kind: 'block', x: 490, y: 355, w: 75, h: 60 },
      { id: 'v-i1', kind: 'ice', x: 360, y: 245, w: 180, h: 130 },
      { id: 'v-i2', kind: 'ice', x: 85, y: 260, w: 120, h: 100 },
      { id: 'v-i3', kind: 'ice', x: 695, y: 260, w: 120, h: 100 },
    ],
    theme: {
      surface: 'linear-gradient(150deg, #160d25 0%, #090b18 50%, #17102b 100%)',
      ambient: 'radial-gradient(circle at 50% 48%, rgba(160,107,255,0.18), transparent 62%)',
      gridOpacity: 0.34,
      ice: 'linear-gradient(135deg, rgba(194,154,255,0.25), rgba(101,74,255,0.09))',
      iceBorder: 'rgba(180,130,255,0.4)',
      block: 'linear-gradient(160deg, #30204b 0%, #120d20 58%, #26183f 100%)',
      blockBorder: 'rgba(190,145,255,0.22)',
    },
  },
  {
    id: 'solar-crossing',
    name: 'Solar Crossing',
    hazards: [
      { id: 'c-b1', kind: 'block', x: 280, y: 275, w: 100, h: 70 },
      { id: 'c-b2', kind: 'block', x: 520, y: 275, w: 100, h: 70 },
      { id: 'c-b3', kind: 'block', x: 415, y: 145, w: 70, h: 85 },
      { id: 'c-b4', kind: 'block', x: 415, y: 390, w: 70, h: 85 },
      { id: 'c-i1', kind: 'ice', x: 370, y: 225, w: 160, h: 170 },
      { id: 'c-i2', kind: 'ice', x: 75, y: 65, w: 130, h: 90 },
      { id: 'c-i3', kind: 'ice', x: 695, y: 465, w: 130, h: 90 },
    ],
    theme: {
      surface: 'linear-gradient(145deg, #211306 0%, #100d10 52%, #251309 100%)',
      ambient: 'radial-gradient(circle at 50% 50%, rgba(255,176,32,0.17), transparent 64%)',
      gridOpacity: 0.28,
      ice: 'linear-gradient(135deg, rgba(255,205,84,0.2), rgba(255,105,45,0.07))',
      iceBorder: 'rgba(255,176,32,0.4)',
      block: 'linear-gradient(160deg, #422713 0%, #180f0b 58%, #352010 100%)',
      blockBorder: 'rgba(255,190,80,0.22)',
    },
  },
] as const;

export const BOMB_MAPS: readonly BombMap[] = MAPS;

function scaleHazards(hazards: ArenaHazard[], width: number, height: number): ArenaHazard[] {
  const sx = width / BASE_ARENA.width;
  const sy = height / BASE_ARENA.height;
  return hazards.map((hazard) => ({
    ...hazard,
    x: hazard.x * sx,
    y: hazard.y * sy,
    w: hazard.w * sx,
    h: hazard.h * sy,
  }));
}

export function getBombMap(seed: number, width: number, height: number): BombMap {
  const index = Math.abs(Math.trunc(seed)) % MAPS.length;
  const map = MAPS[index];
  return { ...map, hazards: scaleHazards(map.hazards, width, height) };
}

export function getBombMapTheme(mapId?: string): BombMapTheme {
  return MAPS.find((map) => map.id === mapId)?.theme ?? MAPS[0].theme;
}
