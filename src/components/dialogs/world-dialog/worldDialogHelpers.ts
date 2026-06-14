import { defaultWorldCacheInfo } from '@/lib/worldAssetBundle';

import { normalizeEntityId } from './worldInstances';

export function isWorldNotFoundMessage(message: any, worldId: any) {
    const normalizedMessage = normalizeEntityId(message);
    const normalizedWorldId = normalizeEntityId(worldId);
    const match = /^World\s+(.+?)\s+not found\.?$/i.exec(normalizedMessage);

    return (
        Boolean(normalizedWorldId) &&
        normalizeEntityId(match?.[1]) === normalizedWorldId
    );
}

export function worldLoadErrorDescription(
    error: any,
    t: any,
    worldId: any,
    fallbackKey: any
) {
    if (error instanceof Error) {
        if (isWorldNotFoundMessage(error.message, worldId)) {
            return t('dialog.world.error.world_not_found_description', {
                worldId
            });
        }
        return error.message;
    }

    return t(fallbackKey);
}

export function defaultWorldSideData() {
    return {
        fileAnalysis: {},
        cache: defaultWorldCacheInfo()
    };
}

export function normalizeInstanceRegion(value: any) {
    const region = normalizeEntityId(value);
    switch (region) {
        case 'us':
        case 'US West':
            return 'US West';
        case 'use':
        case 'US East':
            return 'US East';
        case 'eu':
        case 'Europe':
            return 'Europe';
        case 'jp':
        case 'Japan':
            return 'Japan';
        default:
            return region;
    }
}

export function normalizeNewInstanceSeed(seed: any) {
    if (!seed || typeof seed !== 'object') {
        return {};
    }
    const groupId = normalizeEntityId(seed.groupId);
    return {
        ...(seed.accessType
            ? { accessType: normalizeEntityId(seed.accessType) }
            : {}),
        ...(seed.region
            ? { region: normalizeInstanceRegion(seed.region) }
            : {}),
        ...(groupId ? { accessType: 'group', groupId } : {}),
        ...(seed.groupAccessType
            ? { groupAccessType: normalizeEntityId(seed.groupAccessType) }
            : {}),
        ...(seed.groupName
            ? { groupName: normalizeEntityId(seed.groupName) }
            : {})
    };
}

export function groupOptionId(group: any) {
    return normalizeEntityId(group?.groupId || group?.id);
}

export function findGroupOption(groups: any, groupId: any) {
    const normalizedGroupId = normalizeEntityId(groupId);
    if (!normalizedGroupId) {
        return null;
    }
    return (
        (Array.isArray(groups) ? groups : []).find(
            (group: any) => groupOptionId(group) === normalizedGroupId
        ) || null
    );
}
