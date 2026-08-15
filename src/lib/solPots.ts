/** Real SOL pots stay off until the house/oracle can settle escrow. */
export function solPotsEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_SOL_POTS === '1';
}
