import vrchatFriendRepository from '@/repositories/vrchatFriendRepository.js';
import { useRuntimeStore } from '@/state/runtimeStore.js';

type RealtimePresenceServiceModule = {
    handleRealtimePresenceEvent: (
        message: Record<string, unknown>
    ) => Promise<boolean>;
};
const realtimePresenceServiceLoaders =
    import.meta.glob<RealtimePresenceServiceModule>(
        './realtimePresenceService.js'
    );

type FriendLike = {
    id?: unknown;
};
type AuthTarget = {
    currentUserId?: unknown;
    endpoint?: string;
};
type DeleteFriendOptions = AuthTarget & {
    friend?: FriendLike | null;
    userId?: unknown;
};
type DeleteFriendResult = {
    stale: boolean;
    userId: string;
};

function normalizeUserId(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function isCurrentAuthTarget({ currentUserId, endpoint }: AuthTarget): boolean {
    const auth = useRuntimeStore.getState().auth;
    return (
        auth.currentUserId === currentUserId &&
        auth.currentUserEndpoint === endpoint
    );
}

async function handleFriendDeletePresenceEvent(userId: string): Promise<void> {
    const loadRealtimePresenceService =
        realtimePresenceServiceLoaders['./realtimePresenceService.js'];
    if (typeof loadRealtimePresenceService !== 'function') {
        throw new Error('Realtime presence service is unavailable.');
    }
    const { handleRealtimePresenceEvent } = await loadRealtimePresenceService();
    await handleRealtimePresenceEvent({
        type: 'friend-delete',
        content: {
            userId
        }
    });
}

async function deleteFriend({
    friend,
    userId,
    endpoint = '',
    currentUserId = ''
}: DeleteFriendOptions = {}): Promise<DeleteFriendResult> {
    const normalizedUserId = normalizeUserId(userId || friend?.id);
    if (!normalizedUserId) {
        throw new Error('deleteFriend requires a friend user id.');
    }

    await vrchatFriendRepository.deleteFriend({
        userId: normalizedUserId,
        endpoint
    });

    if (!isCurrentAuthTarget({ currentUserId, endpoint })) {
        return {
            stale: true,
            userId: normalizedUserId
        };
    }

    await handleFriendDeletePresenceEvent(normalizedUserId);

    return {
        stale: false,
        userId: normalizedUserId
    };
}

const friendRelationshipService = {
    deleteFriend
};

export { deleteFriend };
export default friendRelationshipService;
