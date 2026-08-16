import { describe, expect, it } from 'vitest';
import { mapPublicListings, mapRemoteParty } from './partyRemote';

describe('public party mapping', () => {
  it('maps lobby rows from the list RPC', () => {
    const list = mapPublicListings([
      {
        id: 'abc123',
        game_slug: 'tower',
        capacity: 10,
        entry: 50,
        entry_lamports: 10_000_000,
        host_id: 'HostWallet111111111111111111111111111111111',
        host_name: 'Maya',
        member_count: 2,
        created_at: 1_700_000_000_000,
      },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('ABC123');
    expect(list[0]?.gameSlug).toBe('tower');
    expect(list[0]?.hostName).toBe('Maya');
    expect(list[0]?.memberCount).toBe(2);
  });

  it('maps camelCase lobby rows from GET /api/parties', () => {
    const list = mapPublicListings([
      {
        id: 'FASWEM',
        gameSlug: 'bomb-party',
        capacity: 2,
        entry: 50,
        entryLamports: 4_000_000,
        hostId: 'Host111',
        hostName: 'Host',
        memberCount: 1,
        createdAt: 1_786_893_627_969,
      },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('FASWEM');
    expect(list[0]?.gameSlug).toBe('bomb-party');
    expect(list[0]?.memberCount).toBe(1);
  });

  it('maps camelCase parties from the match server', () => {
    const party = mapRemoteParty({
      id: '42vkm6',
      gameSlug: 'bomb-party',
      capacity: 2,
      entry: 0,
      hostId: 'host',
      status: 'waiting',
      visibility: 'private',
      members: [{ id: 'host', username: 'Host', avatar: '🐸', color: '#0f0', isHost: true, joinedAt: 1 }],
    });
    expect(party?.id).toBe('42VKM6');
    expect(party?.capacity).toBe(2);
    expect(party?.members).toHaveLength(1);
    expect(party?.hostId).toBe('host');
  });

  it('drops closed parties and keeps live ones', () => {
    expect(mapRemoteParty({ id: 'X', host_id: 'h', status: 'closed', members: [] })).toBeNull();
    const live = mapRemoteParty({
      id: 'live01',
      game_slug: 'bomb-party',
      capacity: 5,
      entry: 50,
      host_id: 'host',
      status: 'live',
      visibility: 'public',
      game_path: '/game/live01',
      members: [{ id: 'host', username: 'H', avatar: '🐸', color: '#fff', isHost: true, joinedAt: 1 }],
    });
    expect(live?.status).toBe('live');
    expect(live?.gamePath).toBe('/game/live01');
  });
});
