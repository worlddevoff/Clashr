import { PrismaClient } from '@prisma/client';

const POOLER = 'aws-0-us-west-2.pooler.supabase.com';
const USER = 'postgres.cbfyrkxzgtxoypewdouf';

function looksLikeProjectUser(host: string): boolean {
  return /^postgres\.[a-z0-9]+$/i.test(host);
}

function normalize(raw: string | undefined, pooled: boolean): string {
  const value = (raw || '').trim().replace(/^["']|["']$/g, '');
  if (!value || value.startsWith('file:')) {
    throw new Error(
      pooled
        ? `DATABASE_URL is missing. Set it to postgresql://${USER}:YOUR_DB_PASSWORD@${POOLER}:6543/postgres?pgbouncer=true`
        : `DIRECT_URL is missing.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `DATABASE_URL is not a valid URL. Paste the full string, including @${POOLER}`,
    );
  }

  if (!parsed.password || parsed.password === 'YOUR_PASSWORD') {
    throw new Error(
      [
        'DATABASE_URL is missing the real Supabase host and/or password.',
        `Prisma saw host "${parsed.hostname}:${parsed.port || '5432'}" — that name is the username, not a server.`,
        'In Railway → Variables, select ALL of DATABASE_URL, delete it, and paste:',
        `postgresql://${USER}:YOUR_DB_PASSWORD@${POOLER}:6543/postgres?pgbouncer=true`,
        'Keep @aws-0-us-west-2.pooler.supabase.com in the string. Only swap YOUR_DB_PASSWORD.',
      ].join('\n'),
    );
  }

  if (looksLikeProjectUser(parsed.hostname)) {
    parsed.username = parsed.username || parsed.hostname;
    parsed.hostname = POOLER;
  }

  parsed.port = pooled ? '6543' : '5432';
  if (pooled) parsed.searchParams.set('pgbouncer', 'true');
  parsed.searchParams.set('sslmode', 'require');
  return parsed.toString();
}

process.env.DATABASE_URL = normalize(process.env.DATABASE_URL, true);
if (process.env.DIRECT_URL) {
  try {
    process.env.DIRECT_URL = normalize(process.env.DIRECT_URL, false);
  } catch {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

const parsed = new URL(process.env.DATABASE_URL);
console.log(`Clashr DB host ${parsed.hostname}:${parsed.port} user ${parsed.username}`);

export const prisma = new PrismaClient();
