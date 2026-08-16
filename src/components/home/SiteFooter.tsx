import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { SITE_NAME, SITE_TAGLINE } from '../../lib/brand';

const CLASHR_CA = 'ABRe7Xrmxm6NhMz27ZHkJrPML3b4ZydcVxTfbZ4Fpump';
const X_URL = 'https://x.com/Clashrfun';

const columns = [
  {
    title: 'Play',
    links: [
      { label: 'Open tables', to: '/play' },
      { label: 'Tower', to: '/play/tower' },
      { label: 'Bomb Party', to: '/play/bomb-party' },
      { label: 'Host a table', to: '/play' },
    ],
  },
  {
    title: 'Compete',
    links: [
      { label: 'Leaderboard', to: '/leaderboard' },
      { label: 'Home', to: '/' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Terms', to: '/terms' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Responsible play', to: '/responsible-play' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink-950">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo className="text-4xl" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              {SITE_TAGLINE}. Real stakes, short matches, on-chain payouts.
            </p>
            <div className="mt-6 max-w-sm space-y-3">
              <div>
                <p className="eyebrow text-white/60">Official $CLASHR CA</p>
                <a
                  href={`https://pump.fun/coin/${CLASHR_CA}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all font-mono text-xs text-neon-cyan transition-colors hover:text-white"
                >
                  {CLASHR_CA}
                </a>
              </div>
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-medium text-muted transition-colors hover:text-white"
              >
                Follow @Clashrfun on X ↗
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="eyebrow text-white">{column.title}</h2>
                <ul className="mt-3 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="text-sm text-muted transition-colors duration-150 ease-snap hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="text-xs text-muted">© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
          <p className="max-w-xl text-xs leading-relaxed text-muted">
            18+ only. Skill-based wagering is restricted in some jurisdictions. Check local laws
            before staking SOL. Play with amounts you can afford to lose.
          </p>
        </div>
      </div>
    </footer>
  );
}
