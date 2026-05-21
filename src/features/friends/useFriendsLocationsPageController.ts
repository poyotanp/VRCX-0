import { useDeferredValue, useEffect, useState } from 'react';

import { useScrollViewportMetrics } from '@/lib/useScrollViewportMetrics';

import { useFriendsLocationsActions } from './useFriendsLocationsActions';
import { useFriendsLocationsPageDerivedState } from './useFriendsLocationsPageDerivedState';
import { useFriendsLocationsPreferences } from './useFriendsLocationsPreferences';
import { useFriendsLocationsRosterState } from './useFriendsLocationsRosterState';
import { useFriendsLocationsRuntime } from './useFriendsLocationsRuntime';

export function useFriendsLocationsPageController() {
    const runtime = useFriendsLocationsRuntime();
    const roster = useFriendsLocationsRosterState();
    const [activeSegment, setActiveSegment] = useState('online');
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedFavoriteGroups, setCollapsedFavoriteGroups] = useState(
        () => new Set()
    );
    const {
        changeDensityPreference,
        changeShowSameInstanceInOnline,
        density,
        preferencesReady,
        showSameInstanceInOnline,
        sidebarFavoritePrefs,
        sidebarSortMethods
    } = useFriendsLocationsPreferences();
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const {
        resetScrollTop,
        viewportMetrics: scrollMetrics,
        viewportRef: scrollRef
    } = useScrollViewportMetrics();

    useEffect(() => {
        resetScrollTop();
    }, [
        activeSegment,
        deferredSearchQuery,
        resetScrollTop,
        showSameInstanceInOnline
    ]);

    const derived = useFriendsLocationsPageDerivedState({
        activeIds: roster.activeIds,
        activeSegment,
        collapsedFavoriteGroups,
        currentUserId: runtime.currentUserId,
        currentUserSnapshot: runtime.currentUserSnapshot,
        deferredSearchQuery,
        density,
        favoriteFriendGroups: roster.favoriteFriendGroups,
        friendsById: roster.friendsById,
        gameState: runtime.gameState,
        groupedFavoriteFriendIdsByGroupKey:
            roster.groupedFavoriteFriendIdsByGroupKey,
        localFriendFavoriteGroups: roster.localFriendFavoriteGroups,
        localFriendFavorites: roster.localFriendFavorites,
        offlineIds: roster.offlineIds,
        onlineIds: roster.onlineIds,
        remoteFavoriteFriendIds: roster.remoteFavoriteFriendIds,
        rosterStatus: roster.rosterStatus,
        scrollMetrics,
        showSameInstanceInOnline,
        sidebarFavoritePrefs,
        sidebarSortMethods
    });
    const actions = useFriendsLocationsActions({
        canInviteFromCurrentLocation: derived.canInviteFromCurrentLocation,
        currentEndpoint: runtime.currentEndpoint,
        currentInviteLocation: derived.currentInviteLocation,
        currentUserId: runtime.currentUserId,
        friendsMap: derived.friendsMap,
        setCollapsedFavoriteGroups
    });
    const isError = roster.rosterStatus === 'error';

    return {
        actions,
        filters: {
            activeSegment,
            searchQuery,
            setActiveSegment,
            setSearchQuery
        },
        preferences: {
            changeDensityPreference,
            changeShowSameInstanceInOnline,
            density,
            preferencesReady,
            showSameInstanceInOnline
        },
        runtime: {
            canBoop: runtime.canBoop,
            currentUserId: runtime.currentUserId
        },
        load: {
            isError,
            isFavoritesLoaded: roster.isFavoritesLoaded,
            rosterDetail: roster.rosterDetail
        },
        scroll: {
            scrollRef
        },
        derived
    };
}
