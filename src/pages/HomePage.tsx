import { useEffect, useState } from 'react';
import { FEATURED_GAMES } from '../data/demo';
import { useLeaderboard } from '../contexts/LeaderboardContext';
import { subscribePublicParties } from '../lib/party';
import type { PublicPartyListing } from '../types/party';
import { HomeHero } from '../components/home/HomeHero';
import { OpenTables } from '../components/home/OpenTables';
import { GameLineup } from '../components/home/GameLineup';
import { HowItWorks } from '../components/home/HowItWorks';
import { LeaderboardPreview } from '../components/home/LeaderboardPreview';
import { SiteFooter } from '../components/home/SiteFooter';

export function HomePage() {
  const { entries, highlights } = useLeaderboard();
  const [publicParties, setPublicParties] = useState<PublicPartyListing[]>([]);
  const liveCount = FEATURED_GAMES.filter((g) => g.status === 'playable').length;

  useEffect(() => subscribePublicParties(setPublicParties), []);

  return (
    <div className="w-full">
      <HomeHero liveCount={liveCount} openTables={publicParties} />
      <OpenTables parties={publicParties} />
      <GameLineup />
      <HowItWorks />
      <LeaderboardPreview entries={entries} highlights={highlights} />
      <SiteFooter />
    </div>
  );
}
