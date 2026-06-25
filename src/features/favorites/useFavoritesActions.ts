import { useRef, useState } from 'react';

import { openFavoriteImportDialog } from '@/services/favoriteImportService';

import type { FavoriteKind, FavoriteSource } from './favoritesTypes';
import { useFavoritesBulkActions } from './useFavoritesBulkActions';
import { useFavoritesCollectionActions } from './useFavoritesCollectionActions';
import { useFavoritesItemActions } from './useFavoritesItemActions';

export function useFavoritesActions({
    allItems,
    avatarHistoryLoading,
    canInviteFromCurrentLocation,
    currentEndpoint,
    currentInviteLocation,
    currentUserId,
    currentUserSnapshot,
    friendsById,
    friendsMap,
    kind,
    localGroups,
    newLocalGroupName,
    refreshRemoteDetails,
    selectedContentItems,
    selectedGroupKey,
    selectedSource,
    setAvatarHistory,
    setAvatarHistoryLoading,
    setCreatingLocalGroup,
    setEditMode,
    setExportDialogOpen,
    setNewLocalGroupName,
    setSelectedGroupKey,
    setSelectedKeys,
    setSelectedSource
}: {
    allItems: any[];
    avatarHistoryLoading: boolean;
    canInviteFromCurrentLocation: boolean;
    currentEndpoint: string;
    currentInviteLocation: string;
    currentUserId: string;
    currentUserSnapshot: any;
    friendsById: Record<string, any>;
    friendsMap: Map<string, any>;
    kind: FavoriteKind;
    localGroups: any[];
    newLocalGroupName: string;
    refreshRemoteDetails(): void;
    selectedContentItems: any[];
    selectedGroupKey: string;
    selectedSource: FavoriteSource;
    setAvatarHistory(value: any[] | ((current: any[]) => any[])): void;
    setAvatarHistoryLoading(value: boolean): void;
    setCreatingLocalGroup(value: boolean): void;
    setEditMode(value: boolean): void;
    setExportDialogOpen(value: boolean): void;
    setNewLocalGroupName(value: string): void;
    setSelectedGroupKey(value: string): void;
    setSelectedKeys(value: any[] | ((current: any[]) => any[])): void;
    setSelectedSource(value: FavoriteSource): void;
}) {
    const [refreshing, setRefreshing] = useState(false);
    const [removingFavoriteKey, setRemovingFavoriteKey] = useState('');
    const removingFavoriteKeyRef = useRef('');
    const collectionActions = useFavoritesCollectionActions({
        allItems,
        currentEndpoint,
        currentUserId,
        currentUserSnapshot,
        kind,
        localGroups,
        refreshRemoteDetails,
        refreshing,
        removingFavoriteKeyRef,
        selectedGroupKey,
        selectedSource,
        setAvatarHistory,
        setExportDialogOpen,
        setRefreshing,
        setRemovingFavoriteKey,
        setSelectedGroupKey
    });
    const itemActions = useFavoritesItemActions({
        avatarHistoryLoading,
        canInviteFromCurrentLocation,
        currentEndpoint,
        currentInviteLocation,
        currentUserId,
        friendsById,
        friendsMap,
        kind,
        localGroups,
        newLocalGroupName,
        refreshing,
        selectedContentItems,
        selectedSource,
        setAvatarHistory,
        setAvatarHistoryLoading,
        setCreatingLocalGroup,
        setNewLocalGroupName,
        setSelectedGroupKey,
        setSelectedSource
    });
    const bulkActions = useFavoritesBulkActions({
        handleRemoveLocalFavorite: collectionActions.handleRemoveLocalFavorite,
        handleRemoveRemoteFavorite:
            collectionActions.handleRemoveRemoteFavorite,
        selectedContentItems,
        setEditMode,
        setSelectedKeys
    });

    function importFavorites() {
        openFavoriteImportDialog({
            type: kind
        });
    }

    return {
        ...bulkActions,
        ...collectionActions,
        ...itemActions,
        importFavorites,
        refreshing,
        removingFavoriteKey
    };
}
