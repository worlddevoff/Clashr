import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { EconomyProvider } from './contexts/EconomyContext';
import { LeaderboardProvider } from './contexts/LeaderboardContext';
import { SolPotsProvider } from './contexts/SolPotsContext';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { PlayPage } from './pages/PlayPage';
import { PlayHubPage } from './pages/PlayHubPage';
import { TowerLobbyPage } from './pages/TowerLobbyPage';
import { TowerGamePage } from './pages/TowerGamePage';
import { PartyPage } from './pages/PartyPage';
import { GamePage } from './pages/GamePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { PrivacyPage, ResponsiblePlayPage, TermsPage } from './pages/LegalPages';
import { LegalGate } from './components/LegalGate';

export function App() {
  return (
    <AuthProvider>
      <SolPotsProvider>
        <EconomyProvider>
          <LeaderboardProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/play" element={<PlayHubPage />} />
                  <Route path="/play/bomb-party" element={<PlayPage />} />
                  <Route path="/play/tower" element={<TowerLobbyPage />} />
                  <Route path="/party/:partyId" element={<PartyPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/how-it-works" element={<HowItWorksPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/responsible-play" element={<ResponsiblePlayPage />} />
                </Route>
                <Route
                  path="/game/tower/:roomId"
                  element={
                    <LegalGate>
                      <TowerGamePage />
                    </LegalGate>
                  }
                />
                <Route
                  path="/game/:roomId"
                  element={
                    <LegalGate>
                      <GamePage />
                    </LegalGate>
                  }
                />
              </Routes>
            </BrowserRouter>
          </LeaderboardProvider>
        </EconomyProvider>
      </SolPotsProvider>
    </AuthProvider>
  );
}
