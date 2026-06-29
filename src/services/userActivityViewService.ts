import activityPersistenceRepository, {
    type ActivityRefreshResult,
    type ActivitySyncState
} from '@/repositories/activityPersistenceRepository';
import gameLogRepository from '@/repositories/gameLogRepository';
import type {
    ActivityNormalizeConfig,
    ActivitySession,
    ActivityView,
    OverlapView
} from '@/shared/utils/activityEngine';
import { mergeSessions } from '@/shared/utils/activityEngine';
import { runActivityWorkerTask } from '@/workers/activityWorkerRunner';

type ActivitySnapshot = {
    userId: string;
    isSelf: boolean;
    sync: ActivitySyncState & {
        updatedAt: string;
        isSelf: boolean;
        sourceLastCreatedAt: string;
        pendingSessionStartAt: string | number | null;
        cachedRangeDays: number;
        ownerUserId: string;
    };
    sessions: ActivitySession[];
    activityViews: Map<string, ActivityViewCache>;
    overlapViews: Map<string, ActivityViewCache>;
};

type ActivitySessionSnapshotResult = {
    pendingSessionStartAt: number | null;
    sessions: ActivitySession[];
};

type ActivityViewCache = Record<string, unknown> & {
    bestOverlapTime?: string;
    builtAt?: string;
    builtFromCursor?: string;
    filteredEventCount?: number;
    normalizedBuckets: number[];
    overlapPercent?: number;
    peakDay?: string;
    peakTime?: string;
    rawBuckets: number[];
};

type EnsureSnapshotOptions = {
    forceRefresh?: boolean;
    isSelf: boolean;
    ownerUserId?: string;
    rangeDays: number;
};

type ExcludeHours = {
    enabled?: boolean;
    startHour: number;
    endHour: number;
};

type LoadActivityViewOptions = {
    dayLabels: string[];
    forceRefresh?: boolean;
    isSelf?: boolean;
    ownerUserId?: string;
    rangeDays?: number;
    userId: string;
};

type LoadOverlapViewOptions = {
    currentUserId: string;
    dayLabels: string[];
    excludeHours?: ExcludeHours | null;
    forceRefresh?: boolean;
    ownerUserId?: string;
    rangeDays?: number;
    targetUserId: string;
};

type LoadTopWorldsViewOptions = {
    excludeWorldId?: string;
    limit?: number;
    rangeDays?: number;
    sortBy?: string;
};
type TopWorldRows = Awaited<
    ReturnType<typeof gameLogRepository.getMyTopWorlds>
>;

type UserActivityViewService = {
    FULL_CACHE_MAX_DAYS: number;
    getCache(
        userId: unknown,
        isSelf?: boolean,
        ownerUserId?: unknown
    ): Promise<{
        cachedRangeDays: number;
        isSelf: boolean;
        pendingSessionStartAt: string | number | null;
        sessions: ActivitySession[];
        sourceLastCreatedAt: string;
        updatedAt: string;
        userId: string;
    }>;
    invalidateUser(userId: unknown, ownerUserId?: unknown): void;
    loadActivityView(options: LoadActivityViewOptions): Promise<
        Pick<ActivityView, 'rawBuckets' | 'normalizedBuckets'> & {
            filteredEventCount?: number;
            hasAnyData: boolean;
            peakDay?: string;
            peakTime?: string;
        }
    >;
    loadOverlapView(options: LoadOverlapViewOptions): Promise<
        Pick<OverlapView, 'rawBuckets' | 'normalizedBuckets'> & {
            bestOverlapTime?: string;
            hasOverlapData: boolean;
            overlapPercent?: number;
        }
    >;
    loadTopWorldsView(options: LoadTopWorldsViewOptions): Promise<TopWorldRows>;
};

const snapshotMap = new Map<string, ActivitySnapshot>();
const inFlightJobs = new Map<string, Promise<ActivitySnapshot>>();
const FULL_CACHE_MAX_DAYS = 3650;
const MAX_SNAPSHOT_ENTRIES = 12;
let deferredWriteQueue = Promise.resolve();

function recordOrEmpty(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? { ...value } : {};
}

function numberArrayOrEmpty(value: unknown): number[] {
    return Array.isArray(value)
        ? value.map((entry) => Number(entry)).filter(Number.isFinite)
        : [];
}

function numberOrUndefined(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function pendingSessionStartAtNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function activitySessionSnapshotResult(
    value: unknown
): ActivitySessionSnapshotResult {
    const result = recordOrEmpty(value);
    const pendingSessionStartAt = Number(result.pendingSessionStartAt);
    return {
        pendingSessionStartAt: Number.isFinite(pendingSessionStartAt)
            ? pendingSessionStartAt
            : null,
        sessions: Array.isArray(result.sessions) ? result.sessions : []
    };
}

function activityViewCache(value: unknown): ActivityViewCache {
    const result = recordOrEmpty(value);
    return {
        ...result,
        bestOverlapTime: stringOrUndefined(result.bestOverlapTime),
        builtAt: stringOrUndefined(result.builtAt),
        builtFromCursor: stringOrUndefined(result.builtFromCursor),
        filteredEventCount: numberOrUndefined(result.filteredEventCount),
        normalizedBuckets: numberArrayOrEmpty(result.normalizedBuckets),
        overlapPercent: numberOrUndefined(result.overlapPercent),
        peakDay: stringOrUndefined(result.peakDay),
        peakTime: stringOrUndefined(result.peakTime),
        rawBuckets: numberArrayOrEmpty(result.rawBuckets)
    };
}

function deferWrite(task: () => Promise<unknown> | unknown) {
    const run = () => {
        deferredWriteQueue = deferredWriteQueue
            .catch(() => {})
            .then(async () => {
                await task();
            })
            .catch((error: unknown) => {
                console.error('[Activity] deferred write failed:', error);
            });
        return deferredWriteQueue;
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run);
        return;
    }
    setTimeout(run, 0);
}

function snapshotKey(
    userId: unknown,
    isSelf: boolean,
    ownerUserId: unknown = ''
) {
    return `${String(ownerUserId || '').trim()}:${isSelf ? 'self' : 'friend'}:${String(userId || '').trim()}`;
}

function createSnapshot(userId: string, isSelf: boolean): ActivitySnapshot {
    return {
        userId,
        isSelf,
        sync: {
            userId,
            updatedAt: '',
            isSelf,
            sourceLastCreatedAt: '',
            pendingSessionStartAt: null,
            cachedRangeDays: 0,
            ownerUserId: ''
        },
        sessions: [],
        activityViews: new Map(),
        overlapViews: new Map()
    };
}

function getSnapshot(
    userId: unknown,
    isSelf: boolean,
    ownerUserId: unknown = ''
): ActivitySnapshot {
    const normalizedUserId = String(userId || '').trim();
    const key = snapshotKey(normalizedUserId, isSelf, ownerUserId);
    let snapshot = snapshotMap.get(key);
    if (!snapshot) {
        snapshot = createSnapshot(normalizedUserId, isSelf);
        snapshotMap.set(key, snapshot);
    } else if (typeof isSelf === 'boolean') {
        snapshot.isSelf = isSelf;
        snapshot.sync.isSelf = isSelf;
    }
    snapshot.sync.ownerUserId = String(ownerUserId || '').trim();
    touchSnapshot(key, snapshot);
    pruneSnapshots();
    return snapshot;
}

function touchSnapshot(key: string, snapshot: ActivitySnapshot) {
    snapshotMap.delete(key);
    snapshotMap.set(key, snapshot);
}

function isSnapshotInFlight(key: string) {
    const [ownerUserId, role, userId] = key.split(':');
    const isSelf = role === 'self';
    const jobPrefix = `${ownerUserId || ''}:${userId || ''}:${isSelf}:`;
    for (const jobKey of inFlightJobs.keys()) {
        if (jobKey.startsWith(jobPrefix)) {
            return true;
        }
    }
    return false;
}

function pruneSnapshots() {
    if (snapshotMap.size <= MAX_SNAPSHOT_ENTRIES) {
        return;
    }

    for (const [key] of snapshotMap) {
        if (isSnapshotInFlight(key)) {
            continue;
        }
        snapshotMap.delete(key);
        if (snapshotMap.size <= MAX_SNAPSHOT_ENTRIES) {
            break;
        }
    }
}

function clearDerivedViews(snapshot: ActivitySnapshot) {
    snapshot.activityViews.clear();
    snapshot.overlapViews.clear();
}

function overlapExcludeKey(excludeHours: ExcludeHours | null | undefined) {
    if (!excludeHours?.enabled) {
        return '';
    }
    return `${excludeHours.startHour}-${excludeHours.endHour}`;
}

function pairCursor(leftCursor: unknown, rightCursor: unknown) {
    return `${leftCursor || ''}|${rightCursor || ''}`;
}

async function hydrateSnapshot(
    userId: unknown,
    isSelf: boolean,
    ownerUserId: unknown = ''
) {
    const snapshot = getSnapshot(userId, isSelf, ownerUserId);
    if (snapshot.sync.updatedAt || snapshot.sessions.length > 0) {
        return snapshot;
    }

    if (!isSelf) {
        return snapshot;
    }

    const [syncState, sessions] = await Promise.all([
        activityPersistenceRepository.getActivitySyncState(userId),
        activityPersistenceRepository.getActivitySessions(userId)
    ]);

    if (syncState) {
        snapshot.sync = {
            ...snapshot.sync,
            ...syncState,
            isSelf:
                typeof syncState.isSelf === 'boolean'
                    ? syncState.isSelf
                    : snapshot.isSelf
        };
    }
    if (Array.isArray(sessions) && sessions.length > 0) {
        snapshot.sessions = sessions;
    }
    return snapshot;
}

async function fullRefresh(snapshot: ActivitySnapshot, rangeDays: number) {
    if (snapshot.isSelf) {
        const result =
            await activityPersistenceRepository.refreshSelfActivitySessions({
                userId: snapshot.userId,
                mode: 'full',
                rangeDays,
                nowMs: Date.now()
            });
        applySelfRefreshResult(snapshot, result);
        clearDerivedViews(snapshot);
        return;
    }

    const sourceItems =
        await activityPersistenceRepository.getActivitySourceSlice({
            userId: snapshot.userId,
            ownerUserId: snapshot.sync.ownerUserId || '',
            isSelf: snapshot.isSelf,
            fromDays: rangeDays
        });
    const sourceLastCreatedAt = sourceItems.length
        ? sourceItems[sourceItems.length - 1].created_at
        : '';
    const result = activitySessionSnapshotResult(
        await runActivityWorkerTask('computeSessionsSnapshot', {
            sourceType: 'friend_presence',
            events: sourceItems,
            initialStart: null,
            nowMs: Date.now(),
            mayHaveOpenTail: false,
            sourceRevision: sourceLastCreatedAt
        })
    );

    snapshot.sessions = result.sessions;
    snapshot.sync = {
        ...snapshot.sync,
        updatedAt: new Date().toISOString(),
        isSelf: snapshot.isSelf,
        sourceLastCreatedAt,
        pendingSessionStartAt: result.pendingSessionStartAt,
        cachedRangeDays: rangeDays
    };
    clearDerivedViews(snapshot);

    if (snapshot.isSelf) {
        await activityPersistenceRepository.replaceActivitySessions(
            snapshot.userId,
            snapshot.sessions
        );
        await activityPersistenceRepository.upsertActivitySyncState(
            snapshot.sync
        );
    }
}

async function incrementalRefresh(snapshot: ActivitySnapshot) {
    if (!snapshot.sync.sourceLastCreatedAt) {
        return;
    }

    if (snapshot.isSelf) {
        const result =
            await activityPersistenceRepository.refreshSelfActivitySessions({
                userId: snapshot.userId,
                mode: 'incremental',
                nowMs: Date.now()
            });
        const previousCursor = snapshot.sync.sourceLastCreatedAt;
        applySelfRefreshResult(snapshot, result);
        if (
            result.sourceCount > 0 ||
            snapshot.sync.sourceLastCreatedAt !== previousCursor
        ) {
            clearDerivedViews(snapshot);
        }
        return;
    }

    const sourceItems =
        await activityPersistenceRepository.getActivitySourceAfter({
            userId: snapshot.userId,
            ownerUserId: snapshot.sync.ownerUserId || '',
            isSelf: snapshot.isSelf,
            afterCreatedAt: snapshot.sync.sourceLastCreatedAt,
            inclusive: snapshot.isSelf
        });
    if (sourceItems.length === 0) {
        snapshot.sync.updatedAt = new Date().toISOString();
        if (snapshot.isSelf) {
            await activityPersistenceRepository.upsertActivitySyncState(
                snapshot.sync
            );
        }
        return;
    }

    const sourceLastCreatedAt = sourceItems[sourceItems.length - 1].created_at;
    const result = activitySessionSnapshotResult(
        await runActivityWorkerTask('computeSessionsSnapshot', {
            sourceType: 'friend_presence',
            events: sourceItems,
            initialStart: pendingSessionStartAtNumber(
                snapshot.sync.pendingSessionStartAt
            ),
            nowMs: Date.now(),
            mayHaveOpenTail: false,
            sourceRevision: sourceLastCreatedAt
        })
    );

    const replaceFromStartAt = snapshot.sessions.length
        ? snapshot.sessions[Math.max(snapshot.sessions.length - 1, 0)].start
        : null;
    const mergedSessions = mergeSessions(snapshot.sessions, result.sessions);
    snapshot.sessions = mergedSessions;
    snapshot.sync = {
        ...snapshot.sync,
        updatedAt: new Date().toISOString(),
        sourceLastCreatedAt,
        pendingSessionStartAt: result.pendingSessionStartAt
    };
    clearDerivedViews(snapshot);

    if (snapshot.isSelf) {
        await activityPersistenceRepository.appendActivitySessions({
            userId: snapshot.userId,
            sessions:
                replaceFromStartAt === null
                    ? mergedSessions
                    : mergedSessions.filter(
                          (session) => session.start >= replaceFromStartAt
                      ),
            replaceFromStartAt
        });
        await activityPersistenceRepository.upsertActivitySyncState(
            snapshot.sync
        );
    }
}

async function expandRange(snapshot: ActivitySnapshot, rangeDays: number) {
    const currentDays = snapshot.sync.cachedRangeDays || 0;
    if (rangeDays <= currentDays) {
        return;
    }

    if (snapshot.isSelf) {
        const result =
            await activityPersistenceRepository.refreshSelfActivitySessions({
                userId: snapshot.userId,
                mode: 'expand',
                rangeDays,
                nowMs: Date.now()
            });
        applySelfRefreshResult(snapshot, result);
        clearDerivedViews(snapshot);
        return;
    }

    const sourceItems =
        await activityPersistenceRepository.getActivitySourceSlice({
            userId: snapshot.userId,
            ownerUserId: snapshot.sync.ownerUserId || '',
            isSelf: snapshot.isSelf,
            fromDays: rangeDays,
            toDays: currentDays
        });
    const result = activitySessionSnapshotResult(
        await runActivityWorkerTask('computeSessionsSnapshot', {
            sourceType: 'friend_presence',
            events: sourceItems,
            initialStart: null,
            nowMs: Date.now(),
            mayHaveOpenTail: false,
            sourceRevision: snapshot.sync.sourceLastCreatedAt
        })
    );

    if (result.sessions.length > 0) {
        snapshot.sessions = mergeSessions(result.sessions, snapshot.sessions);
        if (snapshot.isSelf) {
            await activityPersistenceRepository.replaceActivitySessions(
                snapshot.userId,
                snapshot.sessions
            );
        }
    }
    snapshot.sync.cachedRangeDays = rangeDays;
    snapshot.sync.updatedAt = new Date().toISOString();
    clearDerivedViews(snapshot);
    if (snapshot.isSelf) {
        await activityPersistenceRepository.upsertActivitySyncState(
            snapshot.sync
        );
    }
}

function applySelfRefreshResult(
    snapshot: ActivitySnapshot,
    result: ActivityRefreshResult
) {
    snapshot.sessions = Array.isArray(result?.sessions) ? result.sessions : [];
    snapshot.sync = {
        ...snapshot.sync,
        ...(result?.sync || {}),
        isSelf: true,
        ownerUserId: snapshot.sync.ownerUserId || ''
    };
}

async function ensureSnapshot(
    userId: unknown,
    {
        isSelf,
        rangeDays,
        forceRefresh = false,
        ownerUserId = ''
    }: EnsureSnapshotOptions
) {
    const jobKey = `${ownerUserId}:${userId}:${isSelf}:${rangeDays}:${forceRefresh ? 'force' : 'normal'}`;
    const existingJob = inFlightJobs.get(jobKey);
    if (existingJob) {
        return existingJob;
    }

    const job = (async () => {
        const snapshot = await hydrateSnapshot(userId, isSelf, ownerUserId);
        if (
            forceRefresh ||
            !snapshot.sync.updatedAt ||
            !snapshot.sync.sourceLastCreatedAt
        ) {
            await fullRefresh(snapshot, rangeDays);
        } else {
            await incrementalRefresh(snapshot);
            if (rangeDays > snapshot.sync.cachedRangeDays) {
                await expandRange(snapshot, rangeDays);
            }
        }
        return snapshot;
    })().finally(() => {
        inFlightJobs.delete(jobKey);
    });

    inFlightJobs.set(jobKey, job);
    return job;
}

export function pickActivityNormalizeConfig(
    isSelf: boolean,
    rangeDays: number
): ActivityNormalizeConfig {
    const common: Record<number, ActivityNormalizeConfig> = {
        7: {
            floorPercentile: 10,
            capPercentile: 80,
            rankWeight: 0.15,
            targetCoverage: 0.12,
            targetVolume: 40
        },
        30: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.25,
            targetVolume: 60
        },
        90: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.3,
            targetVolume: 50
        }
    };
    return (
        common[rangeDays] || {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: isSelf ? 0.25 : 0.2,
            targetVolume: isSelf ? 60 : 35
        }
    );
}

export function pickOverlapNormalizeConfig(
    rangeDays: number
): ActivityNormalizeConfig {
    const byRange: Record<number, ActivityNormalizeConfig> = {
        7: {
            floorPercentile: 10,
            capPercentile: 80,
            rankWeight: 0.15,
            targetCoverage: 0.08,
            targetVolume: 15
        },
        30: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.15,
            targetVolume: 25
        },
        90: {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.18,
            targetVolume: 20
        }
    };
    return (
        byRange[rangeDays] || {
            floorPercentile: 15,
            capPercentile: 85,
            rankWeight: 0.2,
            targetCoverage: 0.15,
            targetVolume: 25
        }
    );
}

async function getCache(
    userId: unknown,
    isSelf = false,
    ownerUserId: unknown = ''
) {
    const snapshot = await hydrateSnapshot(userId, isSelf, ownerUserId);
    return {
        userId: snapshot.userId,
        isSelf: snapshot.isSelf,
        updatedAt: snapshot.sync.updatedAt,
        sourceLastCreatedAt: snapshot.sync.sourceLastCreatedAt,
        pendingSessionStartAt: snapshot.sync.pendingSessionStartAt,
        cachedRangeDays: snapshot.sync.cachedRangeDays,
        sessions: snapshot.sessions
    };
}

async function loadActivityView({
    userId,
    ownerUserId = '',
    isSelf = false,
    rangeDays = 30,
    dayLabels,
    forceRefresh = false
}: LoadActivityViewOptions) {
    const snapshot = await ensureSnapshot(userId, {
        isSelf,
        rangeDays,
        forceRefresh,
        ownerUserId
    });
    const cacheOwnerUserId = ownerUserId || userId;
    const cacheTargetUserId = isSelf ? '' : userId;
    const cacheKey = String(rangeDays);
    const currentCursor = snapshot.sync.sourceLastCreatedAt || '';
    let view = snapshot.activityViews.get(cacheKey);

    if (!forceRefresh && view?.builtFromCursor === currentCursor) {
        return {
            hasAnyData: snapshot.sessions.length > 0,
            filteredEventCount: view.filteredEventCount,
            peakDay: view.peakDay,
            peakTime: view.peakTime,
            rawBuckets: view.rawBuckets,
            normalizedBuckets: view.normalizedBuckets
        };
    }

    if (!forceRefresh && cacheOwnerUserId) {
        const persisted =
            await activityPersistenceRepository.getActivityBucketCache({
                ownerUserId: cacheOwnerUserId,
                targetUserId: cacheTargetUserId,
                rangeDays,
                viewKind:
                    activityPersistenceRepository.ACTIVITY_VIEW_KIND.ACTIVITY
            });
        if (persisted && persisted.builtFromCursor === currentCursor) {
            view = activityViewCache({
                ...recordOrEmpty(persisted.summary),
                rawBuckets: persisted.rawBuckets,
                normalizedBuckets: persisted.normalizedBuckets,
                builtFromCursor: persisted.builtFromCursor,
                builtAt: persisted.builtAt
            });
            snapshot.activityViews.set(cacheKey, view);
            return {
                hasAnyData: snapshot.sessions.length > 0,
                filteredEventCount: view.filteredEventCount,
                peakDay: view.peakDay,
                peakTime: view.peakTime,
                rawBuckets: view.rawBuckets,
                normalizedBuckets: view.normalizedBuckets
            };
        }
    }

    view = {
        ...activityViewCache(
            await runActivityWorkerTask('computeActivityView', {
                sessions: snapshot.sessions,
                dayLabels,
                rangeDays,
                normalizeConfig: pickActivityNormalizeConfig(isSelf, rangeDays)
            })
        ),
        builtFromCursor: currentCursor,
        builtAt: new Date().toISOString()
    };
    snapshot.activityViews.set(cacheKey, view);
    if (cacheOwnerUserId) {
        deferWrite(() =>
            activityPersistenceRepository.upsertActivityBucketCache({
                ownerUserId: cacheOwnerUserId,
                targetUserId: cacheTargetUserId,
                rangeDays,
                viewKind:
                    activityPersistenceRepository.ACTIVITY_VIEW_KIND.ACTIVITY,
                builtFromCursor: currentCursor,
                rawBuckets: view.rawBuckets,
                normalizedBuckets: view.normalizedBuckets,
                summary: {
                    peakDay: view.peakDay,
                    peakTime: view.peakTime,
                    filteredEventCount: view.filteredEventCount
                },
                builtAt: view.builtAt
            })
        );
    }

    return {
        hasAnyData: snapshot.sessions.length > 0,
        filteredEventCount: view.filteredEventCount,
        peakDay: view.peakDay,
        peakTime: view.peakTime,
        rawBuckets: view.rawBuckets,
        normalizedBuckets: view.normalizedBuckets
    };
}

async function loadOverlapView({
    currentUserId,
    targetUserId,
    ownerUserId = currentUserId,
    rangeDays = 30,
    dayLabels,
    excludeHours,
    forceRefresh = false
}: LoadOverlapViewOptions) {
    const [selfSnapshot, targetSnapshot] = await Promise.all([
        ensureSnapshot(currentUserId, {
            isSelf: true,
            rangeDays,
            forceRefresh,
            ownerUserId
        }),
        ensureSnapshot(targetUserId, {
            isSelf: false,
            rangeDays,
            forceRefresh,
            ownerUserId
        })
    ]);
    const excludeKey = overlapExcludeKey(excludeHours);
    const cacheKey = `${targetUserId}:${rangeDays}:${excludeKey}`;
    const cursor = pairCursor(
        selfSnapshot.sync.sourceLastCreatedAt,
        targetSnapshot.sync.sourceLastCreatedAt
    );
    let view = targetSnapshot.overlapViews.get(cacheKey);

    if (!forceRefresh && view?.builtFromCursor === cursor) {
        return {
            hasOverlapData: view.rawBuckets.some((value) => value > 0),
            overlapPercent: view.overlapPercent,
            bestOverlapTime: view.bestOverlapTime,
            rawBuckets: view.rawBuckets,
            normalizedBuckets: view.normalizedBuckets
        };
    }

    if (!forceRefresh && ownerUserId) {
        const persisted =
            await activityPersistenceRepository.getActivityBucketCache({
                ownerUserId,
                targetUserId,
                rangeDays,
                viewKind:
                    activityPersistenceRepository.ACTIVITY_VIEW_KIND.OVERLAP,
                excludeKey
            });
        if (persisted?.builtFromCursor === cursor) {
            view = activityViewCache({
                ...recordOrEmpty(persisted.summary),
                rawBuckets: persisted.rawBuckets,
                normalizedBuckets: persisted.normalizedBuckets,
                builtFromCursor: persisted.builtFromCursor,
                builtAt: persisted.builtAt
            });
            targetSnapshot.overlapViews.set(cacheKey, view);
            return {
                hasOverlapData: view.rawBuckets.some((value) => value > 0),
                overlapPercent: view.overlapPercent,
                bestOverlapTime: view.bestOverlapTime,
                rawBuckets: view.rawBuckets,
                normalizedBuckets: view.normalizedBuckets
            };
        }
    }

    view = {
        ...activityViewCache(
            await runActivityWorkerTask('computeOverlapView', {
                selfSessions: selfSnapshot.sessions,
                targetSessions: targetSnapshot.sessions,
                dayLabels,
                rangeDays,
                excludeHours: excludeHours?.enabled ? excludeHours : null,
                normalizeConfig: pickOverlapNormalizeConfig(rangeDays)
            })
        ),
        builtFromCursor: cursor,
        builtAt: new Date().toISOString()
    };
    targetSnapshot.overlapViews.set(cacheKey, view);
    if (ownerUserId) {
        deferWrite(() =>
            activityPersistenceRepository.upsertActivityBucketCache({
                ownerUserId,
                targetUserId,
                rangeDays,
                viewKind:
                    activityPersistenceRepository.ACTIVITY_VIEW_KIND.OVERLAP,
                excludeKey,
                builtFromCursor: cursor,
                rawBuckets: view.rawBuckets,
                normalizedBuckets: view.normalizedBuckets,
                summary: {
                    overlapPercent: view.overlapPercent,
                    bestOverlapTime: view.bestOverlapTime
                },
                builtAt: view.builtAt
            })
        );
    }

    return {
        hasOverlapData: view.rawBuckets.some((value) => value > 0),
        overlapPercent: view.overlapPercent,
        bestOverlapTime: view.bestOverlapTime,
        rawBuckets: view.rawBuckets,
        normalizedBuckets: view.normalizedBuckets
    };
}

async function loadTopWorldsView({
    rangeDays = 30,
    limit = 5,
    sortBy = 'time',
    excludeWorldId = ''
}: LoadTopWorldsViewOptions) {
    return gameLogRepository.getMyTopWorlds(
        rangeDays,
        limit,
        sortBy,
        excludeWorldId
    );
}

function invalidateUser(userId: unknown, ownerUserId: unknown = '') {
    const normalizedUserId = String(userId || '').trim();
    const normalizedOwnerUserId = String(ownerUserId || '').trim();
    for (const key of snapshotMap.keys()) {
        if (
            key.endsWith(`:${normalizedUserId}`) &&
            (!normalizedOwnerUserId ||
                key.startsWith(`${normalizedOwnerUserId}:`))
        ) {
            snapshotMap.delete(key);
        }
    }
}

const userActivityViewService: UserActivityViewService = {
    FULL_CACHE_MAX_DAYS,
    getCache,
    invalidateUser,
    loadActivityView,
    loadOverlapView,
    loadTopWorldsView
};

export { userActivityViewService };
