import { useMemo } from 'react';

import { getResolvedThemeMode } from '@/services/themeService';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useShellStore } from '@/state/shellStore';

export function useInstanceActivityRuntime(userIdOverride: any = '') {
    const authUserId = useRuntimeStore(
        (state: any) => state.auth.currentUserId
    );
    const currentEndpoint = useRuntimeStore(
        (state: any) => state.auth.currentUserEndpoint
    );
    const friendsById = useFriendRosterStore((state: any) => state.friendsById);
    const favoriteFriendIds = useFavoriteStore(
        (state: any) => state.favoriteFriendIds
    );
    const localFriendFavoritesList = useFavoriteStore(
        (state: any) => state.localFriendFavoritesList
    );
    const shellThemeMode = useShellStore((state: any) => state.themeMode);
    const hour12 = usePreferencesStore((state: any) => state.dtHour12);
    const resolvedTheme = getResolvedThemeMode(shellThemeMode);
    const friendIdSet = useMemo(
        () => new Set(Object.keys(friendsById)),
        [friendsById]
    );
    const favoriteIdSet = useMemo(
        () =>
            new Set([
                ...(favoriteFriendIds || []),
                ...(localFriendFavoritesList || [])
            ]),
        [favoriteFriendIds, localFriendFavoritesList]
    );

    return {
        currentEndpoint,
        currentUserId: userIdOverride || authUserId,
        favoriteIdSet,
        friendIdSet,
        hour12,
        resolvedTheme
    };
}
