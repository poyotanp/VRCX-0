import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
    recordFriendPatch: vi.fn(),
    recordFriendRosterFacts: vi.fn()
}));

vi.mock('./domainIngestionService', () => ({
    recordFriendPatch: serviceMocks.recordFriendPatch,
    recordFriendRosterFacts: serviceMocks.recordFriendRosterFacts
}));

describe('friendBootstrapService snapshot state sync', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        const { useFriendRosterStore } =
            await import('@/state/friendRosterStore');
        const { useRuntimeStore } = await import('@/state/runtimeStore');

        useFriendRosterStore.getState().resetRoster();
        useRuntimeStore.getState().resetRuntimeState();
        useRuntimeStore.getState().setAuthBootstrap({
            currentUserId: 'usr_self',
            currentUserEndpoint: 'https://api.example.test',
            currentUserSnapshot: {
                id: 'usr_self'
            }
        });
    });

    it('does not demote a real-location friend from a state-only offline snapshot', async () => {
        const { useFriendRosterStore } =
            await import('@/state/friendRosterStore');
        const { syncFriendRosterStateFromCurrentUserSnapshot } = await import(
            './friendBootstrapService'
        );

        useFriendRosterStore.getState().applyFriendPatches([
            {
                userId: 'usr_friend',
                stateBucket: 'online',
                patch: {
                    id: 'usr_friend',
                    displayName: 'Friend',
                    state: 'online',
                    location: 'wrld_live:123'
                }
            }
        ]);

        syncFriendRosterStateFromCurrentUserSnapshot(
            {
                id: 'usr_self',
                friends: ['usr_friend'],
                offlineFriends: ['usr_friend'],
                activeFriends: [],
                onlineFriends: []
            },
            'snapshot refresh'
        );

        const state = useFriendRosterStore.getState();
        expect(state.onlineIds).toEqual(['usr_friend']);
        expect(state.offlineIds).toEqual([]);
        expect(state.friendsById.usr_friend).toMatchObject({
            state: 'online',
            stateBucket: 'online',
            location: 'wrld_live:123'
        });
        expect(serviceMocks.recordFriendPatch).toHaveBeenLastCalledWith(
            expect.objectContaining({
                userId: 'usr_friend',
                stateBucket: 'online',
                patch: expect.objectContaining({
                    state: 'online'
                })
            })
        );
    });
});
