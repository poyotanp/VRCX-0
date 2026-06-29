import { create } from 'zustand';

import {
    normalizeStateBucket,
    userFactKey,
    type UserFact
} from '@/domain/users/userFacts';

type UserFactInput = Omit<
    Partial<UserFact>,
    'endpoint' | 'id' | 'stateBucket' | 'updatedAt'
> &
    Record<string, unknown> & {
        endpoint?: unknown;
        id?: unknown;
        stateBucket?: unknown;
        updatedAt?: unknown;
        userId?: unknown;
    };

interface UserFactsStoreState {
    version: number;
    usersByKey: Record<string, UserFact>;
    userIdsByEndpoint: Record<string, string[]>;
    replaceUserFacts: (users: UserFactInput[] | null | undefined) => void;
    resetUserFacts: () => void;
}

const initialState: Pick<
    UserFactsStoreState,
    'version' | 'usersByKey' | 'userIdsByEndpoint'
> = {
    version: 0,
    usersByKey: {},
    userIdsByEndpoint: {}
};

function text(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function endpointFromKey(key: string): string {
    return key.split('::')[0] || 'default';
}

function isUserFactInput(value: unknown): value is UserFactInput {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNormalizedStateBucket(
    value: unknown
): value is UserFact['stateBucket'] {
    return value === undefined || normalizeStateBucket(value) === value;
}

function isStoredUserFact(
    user: UserFactInput,
    key: string,
    userId: string
): user is UserFactInput & UserFact {
    return (
        typeof user.id === 'string' &&
        user.id.trim() === userId &&
        typeof user.endpoint === 'string' &&
        user.endpoint.trim() === endpointFromKey(key) &&
        typeof user.updatedAt === 'string' &&
        isNormalizedStateBucket(user.stateBucket)
    );
}

function toUserFact(user: UserFactInput, key: string): UserFact | null {
    const userId = text(user.id ?? user.userId);
    if (!userId) {
        return null;
    }
    if (isStoredUserFact(user, key, userId)) {
        return user;
    }
    const {
        endpoint: _endpoint,
        id: _id,
        stateBucket,
        updatedAt,
        userId: _userId,
        ...rest
    } = user;
    return {
        ...rest,
        id: userId,
        endpoint: endpointFromKey(key),
        ...(stateBucket !== undefined
            ? { stateBucket: normalizeStateBucket(stateBucket) }
            : {}),
        updatedAt: text(updatedAt) || new Date().toISOString()
    };
}

export const useUserFactsStore = create<UserFactsStoreState>((set) => ({
    ...initialState,
    replaceUserFacts(users) {
        const list = Array.isArray(users) ? users.filter(isUserFactInput) : [];
        set((state) => {
            if (list.length === 0) {
                return state;
            }
            let usersByKey = state.usersByKey;
            let userIdsByEndpoint = state.userIdsByEndpoint;
            let changed = false;
            for (const user of list) {
                const key = userFactKey(user.endpoint, user.id ?? user.userId);
                if (!key) {
                    continue;
                }
                const userFact = toUserFact(user, key);
                if (!userFact) {
                    continue;
                }
                if (!changed) {
                    usersByKey = { ...usersByKey };
                    userIdsByEndpoint = { ...userIdsByEndpoint };
                    changed = true;
                }
                usersByKey[key] = userFact;
                const endpoint = endpointFromKey(key);
                const userId = userFact.id;
                const currentIds = userIdsByEndpoint[endpoint] || [];
                if (userId && !currentIds.includes(userId)) {
                    userIdsByEndpoint[endpoint] = [...currentIds, userId];
                }
            }
            if (!changed) {
                return state;
            }
            const nextState = {
                version: state.version + 1,
                usersByKey,
                userIdsByEndpoint
            };
            return nextState;
        });
    },
    resetUserFacts() {
        set(initialState);
    }
}));

export type { UserFactsStoreState };
