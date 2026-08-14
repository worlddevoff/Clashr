import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { EconomyProvider } from './contexts/EconomyContext';
import { LeaderboardProvider } from './contexts/LeaderboardContext';
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

export function App() {
  return (
    <AuthProvider>
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
              </Route>
              <Route path="/game/tower/:roomId" element={<TowerGamePage />} />
              <Route path="/game/:roomId" element={<GamePage />} />
            </Routes>
          </BrowserRouter>
        </LeaderboardProvider>
      </EconomyProvider>
    </AuthProvider>
  );
}
