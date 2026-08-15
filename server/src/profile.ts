import { prisma } from './db.ts';
import type { User } from '../../src/types/domain.ts';

export interface ClientUser extends User {
  balance: number;
}

export async function toClientUser(userId: string): Promise<ClientUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const [board, account] = await Promise.all([
    prisma.leaderboardRow.findUnique({ where: { userId } }),
    prisma.creditAccount.findUnique({ where: { userId } }),
  ]);
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    color: user.color,
    level: user.level,
    xp: user.xp,
    xpToNext: user.xpToNext,
    gamesPlayed: board?.gamesPlayed ?? 0,
    wins: board?.wins ?? 0,
    biggestWin: board?.biggestWin ?? 0,
    streak: board?.streak ?? 0,
    walletAddress: user.id,
    walletConnected: true,
    balance: account?.balance ?? 0,
  };
}

export async function updateProfile(
  userId: string,
  patch: { username?: string; avatar?: string; color?: string },
): Promise<ClientUser | null> {
  const username = patch.username?.trim().slice(0, 16);
  await prisma.user.update({
    where: { id: userId },
    data: {
      username: username || undefined,
      avatar: patch.avatar || undefined,
      color: patch.color || undefined,
    },
  });
  return toClientUser(userId);
}

export async function applyXp(userId: string, amount: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  let xp = user.xp + amount;
  let level = user.level;
  let xpToNext = user.xpToNext;
  while (xp >= xpToNext && level < 99) {
    xp -= xpToNext;
    level += 1;
    xpToNext = 100 * level;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { xp, level, xpToNext },
  });
}
