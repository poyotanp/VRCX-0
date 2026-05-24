import { useMemo } from 'react';

import { buildPlayerSourceRows } from './playerListRows';

export function usePlayerListSourceRows({
    context,
    currentLocationStartedAt,
    currentUserId,
    currentUserLocation,
    currentUserSnapshot,
    isGameRunning,
    playerRows,
    runtimeRosterAvailable,
    runtimePlayerRows
}: any) {
    return useMemo(() => {
        return buildPlayerSourceRows({
            context,
            currentLocationStartedAt,
            currentUserId,
            currentUserLocation,
            currentUserSnapshot,
            isGameRunning,
            playerRows,
            runtimePlayerRows,
            runtimeRosterAvailable
        });
    }, [
        context,
        currentLocationStartedAt,
        currentUserId,
        currentUserLocation,
        currentUserSnapshot,
        isGameRunning,
        playerRows,
        runtimeRosterAvailable,
        runtimePlayerRows
    ]);
}
