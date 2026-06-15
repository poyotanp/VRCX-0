import { useEffect, useMemo, useState } from 'react';

import { normalizeId } from '@/components/sidebar/friends-sidebar/friendsSidebarModel';
import memoPersistenceRepository from '@/repositories/memoPersistenceRepository';
import userProfileRepository from '@/repositories/userProfileRepository';
import vrchatInstanceRepository from '@/repositories/vrchatInstanceRepository';
import worldProfileRepository from '@/repositories/worldProfileRepository';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import { getEstimatedDwellSince } from './friendDwellTracker';
import {
    buildUserHoverCardModel,
    normalizeInstanceCounts
} from './userHoverCardModel';

export function useUserHoverCardData({ userId, seed }: any) {
    const endpoint = useRuntimeStore(
        (state: any) => state.auth.currentUserEndpoint
    );
    const trustColor = usePreferencesStore((state: any) => state.trustColor);

    const normalizedUserId = normalizeId(userId) || normalizeId(seed?.id);

    const isFriend = Boolean(seed);

    const [profile, setProfile] = useState<any>(null);
    const [memo, setMemo] = useState('');
    const [worldThumb, setWorldThumb] = useState('');
    const [population, setPopulation] = useState<any>(null);
    const [profileLoading, setProfileLoading] = useState(true);

    const nowMs = useMemo(() => Date.now(), [profile, seed]);
    const model = useMemo(
        () => buildUserHoverCardModel({ seed, profile, nowMs }),
        [seed, profile, nowMs]
    );

    useEffect(() => {
        let active = true;
        if (!normalizedUserId) {
            setProfileLoading(false);
            return undefined;
        }
        setProfileLoading(true);
        userProfileRepository
            .getUserProfile({
                userId: normalizedUserId,
                endpoint,
                dialog: false,
                isFriend
            })
            .then((next: any) => {
                if (active) {
                    setProfile(next);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (active) {
                    setProfileLoading(false);
                }
            });
        memoPersistenceRepository
            .getUserMemo(normalizedUserId)
            .then((entry: any) => {
                if (active) {
                    setMemo(String(entry?.memo || '').trim());
                }
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [normalizedUserId, endpoint, isFriend]);

    const worldId = model.location.worldId;
    const instanceId = model.location.instanceId;
    const isRealInstance = model.location.isRealInstance;

    useEffect(() => {
        let active = true;
        setWorldThumb('');
        setPopulation(null);
        if (!worldId) {
            return undefined;
        }
        worldProfileRepository
            .fetchWorldProfile({ worldId, endpoint })
            .then((world: any) => {
                if (active) {
                    setWorldThumb(
                        world?.thumbnailImageUrl || world?.imageUrl || ''
                    );
                }
            })
            .catch(() => {});
        if (isRealInstance && instanceId) {
            vrchatInstanceRepository
                .getInstance({ worldId, instanceId, endpoint })
                .then((response: any) => {
                    if (active) {
                        setPopulation(
                            normalizeInstanceCounts(response?.json ?? response)
                        );
                    }
                })
                .catch(() => {});
        }
        return () => {
            active = false;
        };
    }, [worldId, instanceId, isRealInstance, endpoint]);

    const instanceEpoch =
        model.instanceEpoch ||
        (model.variant === 'in-instance'
            ? getEstimatedDwellSince(
                  normalizedUserId,
                  model.location.effectiveLocation
              )
            : 0);

    return {
        model,
        worldThumb,
        population,
        memo,
        trustColor,
        instanceEpoch,
        loading: profileLoading && !profile
    };
}
