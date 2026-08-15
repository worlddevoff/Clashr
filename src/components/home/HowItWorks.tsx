import { ShieldCheckIcon } from 'lucide-react';

const steps = [
  {
    title: 'Connect & fund',
    body: 'Link a Solana wallet. No account, no email, no deposit minimum.',
  },
  {
    title: 'Pick your stake',
    body: 'Join an open table or host one. Every player posts the same amount into escrow.',
  },
  {
    title: 'Play the match',
    body: 'A short round of chaos. Nothing can be added or withdrawn once the round starts.',
  },
  {
    title: 'Winner takes the pot',
    body: 'Payout settles on-chain within seconds, minus a 5% table fee.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-[1240px] px-5 py-16 lg:px-8 lg:py-20"
      aria-labelledby="how-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-neon-lime">The rules</p>
          <h2
            id="how-heading"
            className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl"
          >
            How a clash works
          </h2>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheckIcon className="h-4 w-4 text-neon-lime" aria-hidden />
          Match pots escrowed on Solana
        </p>
      </div>

      <ol className="relative mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <span className="pointer-events-none absolute left-0 right-0 top-4 hidden h-px bg-line lg:block" aria-hidden />
        {steps.map((step, index) => (
          <li key={step.title} className="relative">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-line bg-ink-850 font-display text-xs font-semibold text-neon-lime">
              {index + 1}
            </span>
            <h3 className="mt-4 font-display text-base font-semibold uppercase tracking-wide text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
