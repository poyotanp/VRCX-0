import { commands } from '@/platform/tauri/bindings';
import type {
    ActivityBucketCacheInput as IpcActivityBucketCacheInput,
    ActivityBucketCacheQueryInput as IpcActivityBucketCacheQueryInput,
    ActivityFriendPresenceAfterInput,
    ActivityFriendPresenceSliceInput,
    ActivityPresenceOutput as IpcActivityPresenceOutput,
    ActivitySelfSessionsRefreshInput as IpcActivitySelfSessionsRefreshInput,
    ActivitySessionOutput as IpcActivitySessionOutput,
    ActivitySourceLocationOutput as IpcActivitySourceLocationOutput,
    ActivitySyncStateInput as IpcActivitySyncStateInput,
    ActivitySyncStateOutput as IpcActivitySyncStateOutput
} from '@/platform/tauri/bindings';
import { DAY_MS } from '@/shared/constants/time';
import type { ActivitySession } from '@/shared/utils/activityEngine';

export type ActivityViewKind =
    (typeof ACTIVITY_VIEW_KIND)[keyof typeof ACTIVITY_VIEW_KIND];
type ActivitySyncStateRow = IpcActivitySyncStateOutput;
type ActivitySessionRow = IpcActivitySessionOutput;
type ActivityLocationRow = IpcActivitySourceLocationOutput;
type PresenceRow = IpcActivityPresenceOutput;

interface ActivitySyncStateEntry {
    userId?: unknown;
    updatedAt?: string;
    isSelf?: unknown;
    sourceLastCreatedAt?: string;
    pendingSessionStartAt?: string | number | null;
    cachedRangeDays?: string | number;
}

interface AppendActivitySessionsInput {
    userId?: unknown;
    sessions?: ActivitySession[];
    replaceFromStartAt?: number | null;
}

interface ActivityBucketCacheQuery {
    ownerUserId: string;
    targetUserId?: string;
    rangeDays: number;
    viewKind: ActivityViewKind | string;
    excludeKey?: string;
}

interface ActivityBucketCacheEntry extends ActivityBucketCacheQuery {
    bucketVersion?: number;
    builtFromCursor?: string;
    rawBuckets?: number[];
    normalizedBuckets?: number[];
    summary?: ActivityBucketCacheSummary;
    builtAt?: string;
}

interface ActivitySelfSessionsRefreshRequest {
    userId?: unknown;
    mode: 'full' | 'incremental' | 'expand';
    rangeDays?: string | number;
    nowMs?: number;
}

interface ActivitySourceSliceInput {
    fromDays: number;
    toDays?: number;
}

interface ActivitySelfSourceAfterInput {
    afterCreatedAt: string;
    inclusive?: boolean;
}

interface FriendPresenceSliceInput {
    userId: unknown;
    ownerUserId: unknown;
    fromDateIso: string;
    toDateIso?: string;
}

interface FriendPresenceAfterInput {
    userId: unknown;
    ownerUserId: unknown;
    afterCreatedAt: string;
}

interface ActivitySourceQuery extends ActivitySourceSliceInput {
    userId?: unknown;
    ownerUserId?: unknown;
    isSelf?: boolean;
}

interface ActivitySourceAfterQuery extends ActivitySelfSourceAfterInput {
    userId?: unknown;
    ownerUserId?: unknown;
    isSelf?: boolean;
}

export type ActivitySourceEvent = {
    created_at: string;
    time: number;
};

export type ActivityPresenceEvent = {
    created_at: string;
    type: string;
};

export type ActivityPersistedSession = {
    start: number;
    end: number;
    isOpenTail: boolean;
    sourceRevision: string;
};

export type ActivitySyncState = {
    userId: string;
    updatedAt: string;
    isSelf: boolean;
    sourceLastCreatedAt: string;
    pendingSessionStartAt: string | number | null;
    cachedRangeDays: number;
};

export type ActivityRefreshResult = {
    sync: ActivitySyncState;
    sessions: ActivityPersistedSession[];
    sourceCount: number;
};

export type ActivitySourceBounds = {
    firstCreatedAt: string;
    lastCreatedAt: string;
    count: number;
};

export type ActivityBucketCacheSummary = Record<string, unknown> & {
    filteredEventCount?: number;
    peakDay?: string;
    peakTime?: string;
    bestOverlapTime?: string;
    overlapPercent?: number;
};

export type ActivityBucketCache = {
    ownerUserId: string;
    targetUserId: string;
    rangeDays: number;
    viewKind: ActivityViewKind | string;
    excludeKey: string;
    bucketVersion: number;
    builtFromCursor: string;
    rawBuckets: number[];
    normalizedBuckets: number[];
    summary: ActivityBucketCacheSummary;
    builtAt: string;
};

const ACTIVITY_VIEW_KIND = Object.freeze({
    ACTIVITY: 'activity',
    OVERLAP: 'overlap'
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeText(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function normalizeNumber(value: unknown): number {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInteger(value: unknown): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePendingSessionStartAt(
    value: unknown
): string | number | null {
    return typeof value === 'string' || typeof value === 'number'
        ? value
        : null;
}

function normalizeNumberArray(value: unknown): number[] {
    if (Array.isArray(value)) {
        return value.map(normalizeNumber);
    }
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value) as unknown;
            return Array.isArray(parsed) ? parsed.map(normalizeNumber) : [];
        } catch {
            return [];
        }
    }
    return [];
}

function parseMaybeObject(value: unknown): Record<string, unknown> {
    if (isRecord(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value) as unknown;
            return isRecord(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

function normalizeBucketSummary(value: unknown): ActivityBucketCacheSummary {
    const source = parseMaybeObject(value);
    const summary: ActivityBucketCacheSummary = { ...source };

    if ('filteredEventCount' in source) {
        summary.filteredEventCount = normalizeInteger(
            source.filteredEventCount
        );
    }
    if ('peakDay' in source) {
        summary.peakDay = normalizeText(source.peakDay);
    }
    if ('peakTime' in source) {
        summary.peakTime = normalizeText(source.peakTime);
    }
    if ('bestOverlapTime' in source) {
        summary.bestOverlapTime = normalizeText(source.bestOverlapTime);
    }
    if ('overlapPercent' in source) {
        summary.overlapPercent = normalizeNumber(source.overlapPercent);
    }

    return summary;
}

function normalizeActivitySyncStateRow(
    row: ActivitySyncStateRow | null,
    fallbackUserId: string
): ActivitySyncState | null {
    if (!row || typeof row !== 'object') {
        return null;
    }

    return {
        userId: normalizeText(row.userId || fallbackUserId),
        updatedAt: normalizeText(row.updatedAt),
        isSelf: Boolean(row.isSelf),
        sourceLastCreatedAt: normalizeText(row.sourceLastCreatedAt),
        pendingSessionStartAt: normalizePendingSessionStartAt(
            row.pendingSessionStartAt
        ),
        cachedRangeDays: normalizeInteger(row.cachedRangeDays)
    };
}

function normalizeActivitySessionRow(
    row: ActivitySessionRow | null
): ActivityPersistedSession | null {
    if (!row || typeof row !== 'object') {
        return null;
    }

    return {
        start: normalizeInteger(row.start),
        end: normalizeInteger(row.end),
        isOpenTail: Boolean(row.isOpenTail),
        sourceRevision: normalizeText(row.sourceRevision)
    };
}

function normalizeLocationRow(
    row: ActivityLocationRow | null
): ActivitySourceEvent | null {
    if (!row || typeof row !== 'object') {
        return null;
    }

    return {
        created_at: normalizeText(row.created_at),
        time: normalizeInteger(row.time)
    };
}

function normalizePresenceRow(
    row: PresenceRow | null
): ActivityPresenceEvent | null {
    if (!row || typeof row !== 'object') {
        return null;
    }
    return {
        created_at: normalizeText(row.created_at),
        type: normalizeText(row.type)
    };
}

function hasCreatedAt<T extends { created_at: unknown }>(
    row: T | null
): row is T {
    return typeof row?.created_at === 'string' && Boolean(row.created_at);
}

async function getSelfActivitySourceSlice({
    fromDays,
    toDays = 0
}: ActivitySourceSliceInput) {
    const fromDateIso = new Date(Date.now() - fromDays * DAY_MS).toISOString();
    const toDateIso =
        toDays > 0 ? new Date(Date.now() - toDays * DAY_MS).toISOString() : '';

    const rows = await commands.appActivitySelfSourceSlice({
        fromDateIso,
        toDateIso
    });

    if (!Array.isArray(rows)) {
        return [];
    }

    return rows.map(normalizeLocationRow).filter(hasCreatedAt);
}

async function getSelfActivitySourceAfter({
    afterCreatedAt,
    inclusive = false
}: ActivitySelfSourceAfterInput) {
    const rows = await commands.appActivitySelfSourceAfter({
        afterCreatedAt,
        inclusive
    });

    if (!Array.isArray(rows)) {
        return [];
    }

    return rows.map(normalizeLocationRow).filter(hasCreatedAt);
}

async function getSelfActivitySourceBounds(): Promise<ActivitySourceBounds> {
    const row = await commands.appActivitySelfSourceBounds();
    return {
        firstCreatedAt: String(row.firstCreatedAt ?? ''),
        lastCreatedAt: String(row.lastCreatedAt ?? ''),
        count: normalizeInteger(row.count)
    };
}

async function getFriendPresenceSlice({
    userId,
    fromDateIso,
    toDateIso = '',
    ownerUserId
}: FriendPresenceSliceInput) {
    const input: ActivityFriendPresenceSliceInput = {
        ownerUserId: String(ownerUserId ?? ''),
        userId: String(userId ?? ''),
        fromDateIso: String(fromDateIso ?? ''),
        toDateIso: String(toDateIso ?? '')
    };
    const rows = await commands.appActivityFriendPresenceSlice(input);

    const output = Array.isArray(rows)
        ? rows.map(normalizePresenceRow).filter(hasCreatedAt)
        : [];

    return output.sort((left, right) =>
        String(left.created_at || '').localeCompare(
            String(right.created_at || '')
        )
    );
}

async function getFriendPresenceAfter({
    userId,
    afterCreatedAt,
    ownerUserId
}: FriendPresenceAfterInput) {
    const input: ActivityFriendPresenceAfterInput = {
        ownerUserId: String(ownerUserId ?? ''),
        userId: String(userId ?? ''),
        afterCreatedAt: String(afterCreatedAt ?? '')
    };
    const rows = await commands.appActivityFriendPresenceAfter(input);
    return Array.isArray(rows)
        ? rows.map(normalizePresenceRow).filter(hasCreatedAt)
        : [];
}

async function getActivitySourceSlice({
    userId,
    ownerUserId = '',
    isSelf,
    fromDays,
    toDays = 0
}: ActivitySourceQuery) {
    if (isSelf) {
        return getSelfActivitySourceSlice({ fromDays, toDays });
    }

    const fromDateIso = new Date(Date.now() - fromDays * DAY_MS).toISOString();
    const toDateIso =
        toDays > 0 ? new Date(Date.now() - toDays * DAY_MS).toISOString() : '';
    return getFriendPresenceSlice({
        userId,
        fromDateIso,
        toDateIso,
        ownerUserId
    });
}

async function getActivitySourceAfter({
    userId,
    ownerUserId = '',
    isSelf,
    afterCreatedAt,
    inclusive = false
}: ActivitySourceAfterQuery) {
    return isSelf
        ? getSelfActivitySourceAfter({ afterCreatedAt, inclusive })
        : getFriendPresenceAfter({
              userId,
              afterCreatedAt,
              ownerUserId
          });
}

async function getActivitySyncState(
    userId: unknown
): Promise<ActivitySyncState | null> {
    const normalizedUserId =
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim();
    if (!normalizedUserId) {
        return null;
    }

    const row = await commands.appActivitySyncStateGet(normalizedUserId);

    if (!row) {
        return null;
    }

    return normalizeActivitySyncStateRow(row, normalizedUserId);
}

async function upsertActivitySyncState(entry: ActivitySyncStateEntry) {
    const normalizedUserId =
        typeof entry?.userId === 'string'
            ? entry.userId.trim()
            : String(entry?.userId ?? '').trim();
    if (!normalizedUserId) {
        throw new Error(
            'ActivityRepository.upsertActivitySyncState requires a user id.'
        );
    }

    const input = {
        userId: normalizedUserId,
        updatedAt: entry.updatedAt || '',
        isSelf: Boolean(entry.isSelf),
        sourceLastCreatedAt: entry.sourceLastCreatedAt || '',
        pendingSessionStartAt: entry.pendingSessionStartAt ?? null,
        cachedRangeDays:
            Number.parseInt(String(entry.cachedRangeDays ?? 0), 10) || 0
    } satisfies IpcActivitySyncStateInput;

    await commands.appActivitySyncStateUpsert(input);
}

async function refreshSelfActivitySessions({
    userId,
    mode,
    rangeDays = 0,
    nowMs
}: ActivitySelfSessionsRefreshRequest): Promise<ActivityRefreshResult> {
    const normalizedUserId =
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim();
    if (!normalizedUserId) {
        throw new Error(
            'ActivityRepository.refreshSelfActivitySessions requires a user id.'
        );
    }

    const input = {
        userId: normalizedUserId,
        mode,
        rangeDays,
        ...(Number.isFinite(nowMs) ? { nowMs } : {})
    } satisfies IpcActivitySelfSessionsRefreshInput;
    const result = await commands.appActivitySelfSessionsRefresh(input);
    const sync = normalizeActivitySyncStateRow(
        result?.sync || null,
        normalizedUserId
    );
    const sessions = Array.isArray(result?.sessions)
        ? result.sessions
              .map(normalizeActivitySessionRow)
              .filter(
                  (row): row is ActivityPersistedSession =>
                      Number.isFinite(row?.start) && Number.isFinite(row?.end)
              )
        : [];

    return {
        sync: sync ||
            normalizeActivitySyncStateRow(null, normalizedUserId) || {
                userId: normalizedUserId,
                updatedAt: '',
                isSelf: true,
                sourceLastCreatedAt: '',
                pendingSessionStartAt: null,
                cachedRangeDays: 0
            },
        sessions,
        sourceCount: normalizeInteger(result?.sourceCount)
    };
}

async function getActivitySessions(
    userId: unknown
): Promise<ActivityPersistedSession[]> {
    const normalizedUserId =
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim();
    if (!normalizedUserId) {
        return [];
    }

    const rows = await commands.appActivitySessionsGet(normalizedUserId);

    if (!Array.isArray(rows)) {
        return [];
    }

    return rows
        .map(normalizeActivitySessionRow)
        .filter(
            (row): row is ActivityPersistedSession =>
                Number.isFinite(row?.start) && Number.isFinite(row?.end)
        );
}

async function replaceActivitySessions(
    userId: unknown,
    sessions: ActivitySession[] = []
) {
    const normalizedUserId =
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim();

    await commands.appActivitySessionsReplace(
        normalizedUserId,
        Array.isArray(sessions) ? sessions : []
    );
}

async function appendActivitySessions({
    userId,
    sessions = [],
    replaceFromStartAt = null
}: AppendActivitySessionsInput) {
    const normalizedUserId =
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim();

    await commands.appActivitySessionsAppend(
        normalizedUserId,
        Array.isArray(sessions) ? sessions : [],
        replaceFromStartAt !== null && replaceFromStartAt !== undefined
            ? replaceFromStartAt
            : null
    );
}

async function getActivityBucketCache({
    ownerUserId,
    targetUserId = '',
    rangeDays,
    viewKind,
    excludeKey = ''
}: ActivityBucketCacheQuery): Promise<ActivityBucketCache | null> {
    const query = {
        ownerUserId,
        targetUserId,
        rangeDays,
        viewKind,
        excludeKey
    } satisfies IpcActivityBucketCacheQueryInput;
    const row = await commands.appActivityBucketCacheGet(query);
    if (!row) {
        return null;
    }
    return {
        ownerUserId: normalizeText(row.ownerUserId),
        targetUserId: normalizeText(row.targetUserId),
        rangeDays: normalizeInteger(row.rangeDays),
        viewKind: normalizeText(row.viewKind),
        excludeKey: normalizeText(row.excludeKey),
        bucketVersion: normalizeInteger(row.bucketVersion),
        builtFromCursor: normalizeText(row.builtFromCursor),
        rawBuckets: normalizeNumberArray(row.rawBuckets),
        normalizedBuckets: normalizeNumberArray(row.normalizedBuckets),
        summary: normalizeBucketSummary(row.summary),
        builtAt: normalizeText(row.builtAt)
    };
}

async function upsertActivityBucketCache(entry: ActivityBucketCacheEntry) {
    const input = {
        ownerUserId: entry.ownerUserId,
        targetUserId: entry.targetUserId || '',
        rangeDays: entry.rangeDays,
        viewKind: entry.viewKind,
        excludeKey: entry.excludeKey || '',
        bucketVersion: entry.bucketVersion || 1,
        builtFromCursor: entry.builtFromCursor || '',
        rawBuckets: entry.rawBuckets || [],
        normalizedBuckets: entry.normalizedBuckets || [],
        summary: entry.summary || {},
        builtAt: entry.builtAt || ''
    } satisfies IpcActivityBucketCacheInput;

    await commands.appActivityBucketCacheUpsert(input);
}

const activityPersistenceRepository = Object.freeze({
    ACTIVITY_VIEW_KIND,
    getActivityBucketCache,
    getSelfActivitySourceSlice,
    getSelfActivitySourceAfter,
    getSelfActivitySourceBounds,
    getActivitySourceSlice,
    getActivitySourceAfter,
    getActivitySyncState,
    upsertActivitySyncState,
    refreshSelfActivitySessions,
    getActivitySessions,
    replaceActivitySessions,
    appendActivitySessions,
    upsertActivityBucketCache
});

export {
    ACTIVITY_VIEW_KIND,
    getActivityBucketCache,
    getActivitySourceAfter,
    getActivitySourceSlice,
    getSelfActivitySourceSlice,
    getSelfActivitySourceAfter,
    getSelfActivitySourceBounds,
    getActivitySyncState,
    upsertActivitySyncState,
    refreshSelfActivitySessions,
    getActivitySessions,
    replaceActivitySessions,
    appendActivitySessions,
    upsertActivityBucketCache
};
export default activityPersistenceRepository;
