import { Link } from 'react-router-dom';
import { SITE_NAME } from '../lib/brand';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-cyan">{SITE_NAME}</p>
      <h1 className="mt-1 font-display text-3xl font-bold uppercase text-white">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-white/70">{children}</div>
      <p className="mt-8 text-xs text-white/40">
        Last updated 16 August 2026. This is product copy, not legal advice. Have counsel review it
        before taking real-money wagers in your jurisdiction.
      </p>
    </div>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of use">
      <p>
        Clashr is a skill-based PvP arcade. Tower and Bomb Party matches are won by play, not by
        chance. Practice and unstaked parties use virtual demo credits with no cash value.
      </p>
      <p>
        When SOL pots are on, each human player deposits the listed stake into an on-chain escrow
        before the match locks. The winner receives the pot minus a 5% platform fee. If a bot wins,
        the pot is paid to the house treasury. Bots never deposit.
      </p>
      <p>
        You must be 18 or older. Skill-based wagering is restricted or illegal in some places. You
        are responsible for following the laws where you live. Clashr may refuse service, freeze
        pots that cannot be settled, or disable SOL stakes without notice.
      </p>
      <p>
        Wallet signatures prove control of an address. They can move SOL when you approve a
        transaction. Lost keys, phishing, and failed RPC nodes are your risk. Settled payouts are
        final.
      </p>
      <p>
        <Link to="/privacy" className="text-neon-cyan underline">
          Privacy
        </Link>
        {' · '}
        <Link to="/responsible-play" className="text-neon-cyan underline">
          Responsible play
        </Link>
      </p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy">
      <p>
        Clashr stores the Solana address you sign in with, a session token, public username / avatar
        / color, match history, and demo-credit balances. Party lobbies are listed so other players
        can join.
      </p>
      <p>
        On-chain deposits, locks, and settlements are public Solana transactions. We do not collect
        government ID. We do not sell personal data. Wallet extensions and RPC providers have their
        own policies.
      </p>
      <p>
        To delete a session, disconnect the wallet. On-chain records cannot be erased. Contact the
        operator if you need a profile row removed from the hosted database.
      </p>
    </Shell>
  );
}

export function ResponsiblePlayPage() {
  return (
    <Shell title="Responsible play">
      <p>Only stake SOL you can afford to lose. Matches are short; pots are not an investment.</p>
      <p>
        If play stops being fun, stop. Take a break, lower the stake, or stick to free practice vs
        bots. If gambling is a problem where you live, seek local help — Clashr does not provide
        counseling.
      </p>
      <p>18+ only. Do not play if it is illegal for you. Do not play for anyone else.</p>
    </Shell>
  );
}
