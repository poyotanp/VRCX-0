import { useEffect, useState } from 'react';

import instanceActivityRepository from '@/repositories/instanceActivityRepository';
import worldProfileRepository from '@/repositories/worldProfileRepository';
import { parseLocation } from '@/shared/utils/locationParser';

import {
    toLocalDayKey
} from './instanceActivityDate';
import {
    getLocalDayBounds
} from './instanceActivityRows';

function hasWorldName(world: any) {
    return Boolean(String(world?.name || '').trim());
}

async function loadMissingWorldProfiles(worldIds: any, worldDetailsById: any, endpoint: any) {
    const missingWorldIds = worldIds.filter(
        (worldId: any) => !hasWorldName(worldDetailsById[worldId])
    );
    if (!missingWorldIds.length) {
        return worldDetailsById;
    }

    const results = await Promise.allSettled(
        missingWorldIds.map((worldId: any) =>
            worldProfileRepository.getWorldProfile({ worldId, endpoint })
        )
    );
    const nextWorldDetailsById: any = { ...worldDetailsById };
    for (const result of results) {
        if (result.status !== 'fulfilled' || !hasWorldName(result.value)) {
            continue;
        }
        const worldId = String(result.value.id || '').trim();
        if (!worldId) {
            continue;
        }
        nextWorldDetailsById[worldId] = {
            ...(nextWorldDetailsById[worldId] || {}),
            ...result.value
        };
    }
    return nextWorldDetailsById;
}

export function useInstanceActivityData({
    currentEndpoint,
    currentUserId,
    reloadToken,
    selectedDate
}: any) {
    const [availableDates, setAvailableDates] = useState<any[]>([]);
    const [dataStatus, setDataStatus] = useState('idle');
    const [dataDetail, setDataDetail] = useState('');
    const [rawRows, setRawRows] = useState<any[]>([]);
    const [worldDetailsById, setWorldDetailsById] = useState<any>({});

    useEffect(() => {
        let active = true;

        if (!currentUserId) {
            setAvailableDates([]);
            return () => {
                active = false;
            };
        }

        instanceActivityRepository
            .getAvailableDates(currentUserId)
            .then((rows: any) => {
                if (!active) {
                    return;
                }

                const uniqueDates = Array.from(
                    new Set(
                        rows
                            .map((value: any) => toLocalDayKey(value))
                            .filter(Boolean)
                    )
                ).sort((left: any, right: any) => right.localeCompare(left));
                setAvailableDates(uniqueDates);
            })
            .catch((error: any) => {
                if (!active) {
                    return;
                }

                setDataDetail(
                    error instanceof Error
                        ? error.message
                        : 'Failed to load available instance activity dates.'
                );
            });

        return () => {
            active = false;
        };
    }, [currentUserId, reloadToken]);

    useEffect(() => {
        let active = true;

        if (!currentUserId || !selectedDate) {
            setDataStatus('idle');
            setRawRows([]);
            setWorldDetailsById({});
            return () => {
                active = false;
            };
        }

        const { start, end } = getLocalDayBounds(selectedDate);
        setDataStatus('running');
        setDataDetail('');

        instanceActivityRepository
            .getInstanceActivityRows(start.toISOString(), end.toISOString())
            .then(async (rows: any) => {
                if (!active) {
                    return;
                }

                const worldIds = Array.from(
                    new Set(
                        rows
                            .map((row: any) => parseLocation(row.location).worldId)
                            .filter(Boolean)
                    )
                );
                const nextWorldDetailsById =
                    await instanceActivityRepository.getWorldSummariesByIds(
                        worldIds
                    );
                const resolvedWorldDetailsById = await loadMissingWorldProfiles(
                    worldIds,
                    nextWorldDetailsById,
                    currentEndpoint
                );

                if (!active) {
                    return;
                }

                setRawRows(Array.isArray(rows) ? rows : []);
                setWorldDetailsById(resolvedWorldDetailsById);
                setDataStatus('ready');
            })
            .catch((error: any) => {
                if (!active) {
                    return;
                }

                setRawRows([]);
                setWorldDetailsById({});
                setDataStatus('error');
                setDataDetail(
                    error instanceof Error
                        ? error.message
                        : 'Failed to load instance activity for the selected day.'
                );
            });

        return () => {
            active = false;
        };
    }, [currentEndpoint, currentUserId, selectedDate, reloadToken]);

    return {
        availableDates,
        dataDetail,
        dataStatus,
        rawRows,
        worldDetailsById
    };
}
