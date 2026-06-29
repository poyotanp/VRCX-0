import {
    commands,
    type FriendLogCurrentOutput,
    type FriendLogHistoryEntryInput,
    type FriendLogMutationResult as IpcFriendLogMutationResult
} from '@/platform/tauri/bindings';

import type { FriendLogHistoryEntry } from './friendLogHistoryRepository';

export interface FriendLogCurrentRow {
    userId: string;
    displayName: string;
    trustLevel: string;
    friendNumber: number;
}

export interface FriendLogCurrentEntry {
    userId?: string | null;
    displayName?: string | null;
    trustLevel?: string | null;
    friendNumber?: number | string | null;
}

export interface FriendLogCurrentReplaceOptions {
    historyEntries?: FriendLogHistoryEntry[];
    addedHistoryEntries?: FriendLogHistoryEntry[];
}

export interface FriendLogCurrentDeleteOptions {
    historyEntries?: FriendLogHistoryEntry[];
}

export interface FriendLogCurrentUpsertOptions {
    historyEntry?: FriendLogHistoryEntry;
    forceHistory?: boolean;
}

type FriendLogSourceRow = FriendLogCurrentOutput;
type FriendLogMutationResult = {
    userId: string;
    targetUserId?: string;
    count: number;
    inserted?: boolean;
    historyCount: number;
};

function valueAsInt(value: unknown): number {
    return Number.parseInt(String(value ?? 0), 10) || 0;
}

function normalizeTargetUserId(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function normalizeFriendLogRow(row: FriendLogSourceRow): FriendLogCurrentRow {
    return {
        userId: row.userId,
        displayName: row.displayName,
        trustLevel: row.trustLevel || 'Visitor',
        friendNumber: row.friendNumber
    };
}

function normalizeMutationResult(
    result: IpcFriendLogMutationResult
): FriendLogMutationResult {
    return {
        userId: result.userId,
        targetUserId: result.targetUserId || undefined,
        count: result.count,
        inserted:
            typeof result.inserted === 'boolean' ? result.inserted : undefined,
        historyCount: result.historyCount
    };
}

async function getFriendLogCurrent(
    userId: unknown
): Promise<FriendLogCurrentRow[]> {
    const rows = await commands.appFriendLogCurrentList(
        typeof userId === 'string' ? userId.trim() : String(userId ?? '').trim()
    );

    return rows
        .map(normalizeFriendLogRow)
        .filter((row) => typeof row.userId === 'string' && row.userId.trim());
}

function normalizeHistoryEntryForRuntime(
    entry: FriendLogHistoryEntry | null | undefined
): FriendLogHistoryEntryInput {
    return {
        createdAt: entry?.created_at ?? '',
        type: entry?.type ?? '',
        userId: normalizeTargetUserId(entry?.userId),
        displayName: entry?.displayName ?? '',
        previousDisplayName: entry?.previousDisplayName ?? '',
        trustLevel: entry?.trustLevel ?? '',
        previousTrustLevel: entry?.previousTrustLevel ?? '',
        friendNumber: valueAsInt(entry?.friendNumber)
    };
}

function normalizeCurrentEntryForRuntime(
    entry: FriendLogCurrentEntry | null | undefined
) {
    return {
        userId: normalizeTargetUserId(entry?.userId),
        displayName: entry?.displayName ?? '',
        trustLevel: entry?.trustLevel ?? 'Visitor',
        friendNumber: valueAsInt(entry?.friendNumber)
    };
}

async function replaceFriendLogCurrent(
    userId: unknown,
    entries: FriendLogCurrentEntry[] = [],
    options: FriendLogCurrentReplaceOptions = {}
) {
    const historyEntries = Array.isArray(options?.historyEntries)
        ? options.historyEntries
        : [];
    const addedHistoryEntries = Array.isArray(options?.addedHistoryEntries)
        ? options.addedHistoryEntries
        : [];

    const result = await commands.appFriendLogReplaceCurrent(
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim(),
        (Array.isArray(entries) ? entries : []).map(
            normalizeCurrentEntryForRuntime
        ),
        {
            historyEntries: historyEntries.map(normalizeHistoryEntryForRuntime),
            addedHistoryEntries: addedHistoryEntries.map(
                normalizeHistoryEntryForRuntime
            )
        }
    );
    return normalizeMutationResult(result);
}

async function deleteFriendLogCurrentArray(
    userId: unknown,
    targetUserIds: unknown[] = [],
    options: FriendLogCurrentDeleteOptions = {}
) {
    const normalizedTargetUserIds = Array.isArray(targetUserIds)
        ? targetUserIds
              .map((targetUserId) =>
                  typeof targetUserId === 'string'
                      ? targetUserId.trim()
                      : String(targetUserId ?? '').trim()
              )
              .filter(Boolean)
        : [];
    if (!normalizedTargetUserIds.length) {
        return {
            userId:
                typeof userId === 'string'
                    ? userId.trim()
                    : String(userId ?? '').trim(),
            count: 0,
            historyCount: 0
        };
    }

    const historyEntries = Array.isArray(options?.historyEntries)
        ? options.historyEntries
        : [];

    const result = await commands.appFriendLogDeleteCurrentArray(
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim(),
        normalizedTargetUserIds,
        {
            historyEntries: historyEntries.map(normalizeHistoryEntryForRuntime)
        }
    );
    return normalizeMutationResult(result);
}

async function upsertFriendLogCurrent(
    userId: unknown,
    entry: FriendLogCurrentEntry | null | undefined,
    options: FriendLogCurrentUpsertOptions = {}
) {
    if (!entry?.userId) {
        return {
            userId:
                typeof userId === 'string'
                    ? userId.trim()
                    : String(userId ?? '').trim(),
            targetUserId: '',
            count: 0,
            inserted: false,
            historyCount: 0
        };
    }

    const targetUserId =
        typeof entry.userId === 'string'
            ? entry.userId.trim()
            : String(entry.userId ?? '').trim();
    if (!targetUserId) {
        return {
            userId:
                typeof userId === 'string'
                    ? userId.trim()
                    : String(userId ?? '').trim(),
            targetUserId: '',
            count: 0,
            inserted: false,
            historyCount: 0
        };
    }

    const historyEntry = options?.historyEntry;

    const result = await commands.appFriendLogUpsertCurrent(
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim(),
        normalizeCurrentEntryForRuntime({
            ...entry,
            userId: targetUserId
        }),
        {
            historyEntry: historyEntry
                ? normalizeHistoryEntryForRuntime({
                      ...historyEntry,
                      userId: targetUserId
                  })
                : null,
            forceHistory: Boolean(options?.forceHistory)
        }
    );
    return normalizeMutationResult(result);
}

async function deleteFriendLogCurrent(userId: unknown, targetUserId: string) {
    await commands.appFriendLogDeleteCurrent(
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim(),
        targetUserId
    );
}

const friendLogRepository = {
    getFriendLogCurrent,
    deleteFriendLogCurrentArray,
    deleteFriendLogCurrent,
    upsertFriendLogCurrent,
    replaceFriendLogCurrent
};

export {
    deleteFriendLogCurrentArray,
    deleteFriendLogCurrent,
    getFriendLogCurrent,
    replaceFriendLogCurrent,
    upsertFriendLogCurrent
};
export default friendLogRepository;
