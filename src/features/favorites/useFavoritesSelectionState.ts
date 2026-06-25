import { useEffect, useMemo, useState } from 'react';

import type {
    FavoriteItem,
    FavoriteKind,
    FavoriteSource
} from './favoritesTypes';

export function useFavoritesSelectionState({
    contentItems,
    isSearchActive,
    kind,
    selectedSource
}: {
    contentItems: FavoriteItem[];
    isSearchActive: boolean;
    kind: FavoriteKind;
    selectedSource: FavoriteSource;
}) {
    const [editMode, setEditMode] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<any[]>([]);
    const selectedKeysSet = useMemo(
        () => new Set(selectedKeys),
        [selectedKeys]
    );
    const isAllSelected =
        contentItems.length > 0 &&
        contentItems.every((item: any) => selectedKeysSet.has(item.key));
    const selectedContentItems = useMemo(
        () => contentItems.filter((item: any) => selectedKeysSet.has(item.key)),
        [contentItems, selectedKeysSet]
    );
    const avatarEditSelectionDisabled =
        kind === 'avatar' && selectedSource !== 'remote';

    useEffect(() => {
        setEditMode(false);
        setSelectedKeys([]);
    }, [kind]);

    useEffect(() => {
        if (isSearchActive && editMode) {
            setEditMode(false);
            setSelectedKeys([]);
        }
    }, [editMode, isSearchActive]);

    useEffect(() => {
        setSelectedKeys((keys: any) => {
            const nextKeys = keys.filter((key: any) =>
                contentItems.some((item: any) => item.key === key)
            );
            return nextKeys.length === keys.length ? keys : nextKeys;
        });
    }, [contentItems]);

    function toggleSelectAll() {
        if (isAllSelected) {
            setSelectedKeys([]);
            return;
        }
        setSelectedKeys(contentItems.map((item: any) => item.key));
    }

    return {
        avatarEditSelectionDisabled,
        editMode,
        isAllSelected,
        selectedContentItems,
        selectedKeys,
        selectedKeysSet,
        setEditMode,
        setSelectedKeys,
        toggleSelectAll
    };
}
