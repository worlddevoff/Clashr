const KEY = 'clashr.legal.v1';

export interface LegalAccept {
  age18: boolean;
  terms: boolean;
  wallet: string;
  at: number;
}

export function readLegalAccept(): LegalAccept | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as LegalAccept | null;
    if (!raw?.age18 || !raw.terms) return null;
    return raw;
  } catch {
    return null;
  }
}

export function hasLegalAccept(wallet?: string): boolean {
  const row = readLegalAccept();
  if (!row) return false;
  if (wallet && row.wallet && row.wallet !== wallet) return false;
  return true;
}

export function saveLegalAccept(wallet: string): void {
  const row: LegalAccept = { age18: true, terms: true, wallet, at: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(row));
}
