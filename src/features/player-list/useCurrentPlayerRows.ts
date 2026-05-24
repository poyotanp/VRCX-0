import { useEffect, useState } from 'react';

import { userFacingErrorMessage } from '@/lib/errorDisplay';
import playerListPersistenceRepository from '@/repositories/playerListPersistenceRepository';
import { recordGameRuntimePresence } from '@/services/domainIngestionService';

function createRuntimeContext({
    playerListLocation,
    playerListWorldId,
    source = 'runtime'
}: any) {
    return {
        createdAt: '',
        groupName: '',
        location: playerListLocation || '',
        playerCount: 0,
        source,
        time: 0,
        worldId: playerListWorldId || '',
        worldName: ''
    };
}

export function useCurrentPlayerRows({
    addGameLogEventCount,
    currentUserEndpoint,
    currentUserId,
    currentUserSnapshot,
    gameLogDisabled,
    gameLogTailSyncedAt,
    isGameRunning,
    logLocationSnapshot,
    playerListLocation,
    playerListStartedAt,
    playerListWorldId
}: any) {
    const [loadStatus, setLoadStatus] = useState('idle');
    const [detail, setDetail] = useState('');
    const [context, setContext] = useState<any>({
        createdAt: '',
        groupName: '',
        location: '',
        playerCount: 0,
        source: 'none',
        time: 0,
        worldId: '',
        worldName: ''
    });
    const [playerRows, setPlayerRows] = useState<any[]>([]);

    useEffect(() => {
        let active = true;

        if (gameLogDisabled) {
            setLoadStatus('idle');
            setDetail('Game log ingestion is disabled.');
            setContext(
                createRuntimeContext({
                    playerListLocation,
                    playerListWorldId
                })
            );
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        if (!isGameRunning) {
            setLoadStatus('idle');
            setDetail('');
            setContext(
                createRuntimeContext({
                    playerListLocation,
                    playerListWorldId
                })
            );
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        if (!playerListLocation) {
            setLoadStatus('idle');
            setDetail('Waiting for the current runtime location.');
            setContext(
                createRuntimeContext({
                    playerListLocation: '',
                    playerListWorldId
                })
            );
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        if (playerListLocation === 'traveling') {
            setLoadStatus('idle');
            setDetail('');
            setContext({
                createdAt: '',
                groupName: '',
                location: 'traveling',
                playerCount: 0,
                source: 'runtime',
                time: 0,
                worldId: '',
                worldName: ''
            });
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        setLoadStatus('running');
        setDetail('');

        playerListPersistenceRepository
            .getCurrentInstanceSnapshot({
                currentLocation: playerListLocation,
                currentLocationStartedAt: playerListStartedAt,
                currentUserId
            })
            .then(async (result: any) => {
                if (!active) {
                    return;
                }

                const players = Array.isArray(result.players)
                    ? result.players
                    : [];

                const nextContext: any = {
                    ...result.context,
                    playerCount: players.length || result.context.playerCount
                };
                if (
                    logLocationSnapshot?.location &&
                    logLocationSnapshot.location === nextContext.location
                ) {
                    nextContext.createdAt =
                        nextContext.createdAt || logLocationSnapshot.createdAt;
                    nextContext.worldName =
                        nextContext.worldName || logLocationSnapshot.worldName;
                }
                recordGameRuntimePresence({
                    currentLocation: nextContext.location || playerListLocation,
                    currentLocationPlayers: players,
                    currentLocationStartedAt:
                        nextContext.createdAt || playerListStartedAt,
                    currentUserId,
                    currentUserSnapshot,
                    currentWorldName: nextContext.worldName,
                    endpoint: currentUserEndpoint
                });
                setContext(nextContext);
                setPlayerRows(players);
                setLoadStatus('ready');
                setDetail(
                    result.context.source === 'database'
                        ? 'Rebuilt the current instance roster from local join/leave history.'
                        : 'Using the current runtime location while waiting for local game-log player events.'
                );
            })
            .catch((error: any) => {
                if (!active) {
                    return;
                }

                setLoadStatus('error');
                setPlayerRows([]);
                setDetail(
                    userFacingErrorMessage(
                        error,
                        'Failed to reconstruct current players for the current instance.'
                    )
                );
            });

        return () => {
            active = false;
        };
    }, [
        addGameLogEventCount,
        currentUserEndpoint,
        currentUserId,
        currentUserSnapshot,
        gameLogDisabled,
        gameLogTailSyncedAt,
        isGameRunning,
        logLocationSnapshot?.createdAt,
        logLocationSnapshot?.location,
        logLocationSnapshot?.worldName,
        playerListLocation,
        playerListStartedAt,
        playerListWorldId
    ]);

    return {
        context,
        detail,
        loadStatus,
        playerRows
    };
}
