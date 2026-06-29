import {
    getDataTableStorageKey,
    readPersistedTableState,
    safeJsonParse,
    sanitizeTableColumnSizing,
    writePersistedTableState
} from '@/components/data-table/dataTablePersistence';

export { safeJsonParse };

export const NOTIFICATION_TABLE_DEFAULT_PAGE_SIZES = [10, 15, 20, 25, 50, 100];
export const NOTIFICATION_TABLE_DEFAULT_SORTING = [
    { id: 'created_at', desc: true }
];
export const NOTIFICATION_TABLE_COLUMN_IDS = [
    'created_at',
    'type',
    'senderUsername',
    'groupName',
    'photo',
    'message',
    'action',
    'trailing'
];

const STORAGE_KEY = getDataTableStorageKey('notifications');
const LEGACY_COLUMN_ID_MAP: Record<string, string> = {
    createdAt: 'created_at',
    sender: 'senderUsername',
    group: 'groupName',
    actions: 'action'
};
const NOTIFICATION_TABLE_COLUMN_ID_SET = new Set<string>(
    NOTIFICATION_TABLE_COLUMN_IDS
);

type NotificationSortingEntry = {
    desc: boolean;
    id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function readPersistedNotificationTableState() {
    return readPersistedTableState(STORAGE_KEY);
}

export function writePersistedNotificationTableState(
    patch: Record<string, unknown>
) {
    writePersistedTableState(STORAGE_KEY, patch);
}

export function normalizeNotificationColumnId(columnId: unknown): string {
    const normalizedColumnId = String(columnId || '').trim();
    return LEGACY_COLUMN_ID_MAP[normalizedColumnId] || normalizedColumnId;
}

export function sanitizeNotificationSorting(
    value: unknown
): NotificationSortingEntry[] {
    if (!Array.isArray(value)) {
        return NOTIFICATION_TABLE_DEFAULT_SORTING;
    }

    const allowedIds = new Set([
        'created_at',
        'type',
        'senderUsername',
        'groupName'
    ]);
    const filtered = value
        .map((entry) => {
            if (!isRecord(entry)) {
                return null;
            }
            return {
                desc: entry.desc === true,
                id: normalizeNotificationColumnId(entry.id)
            };
        })
        .filter((entry): entry is NotificationSortingEntry =>
            Boolean(entry && allowedIds.has(entry.id))
        );
    return filtered.length ? filtered : NOTIFICATION_TABLE_DEFAULT_SORTING;
}

export function sanitizeNotificationFilters(
    value: unknown,
    allowedTypes: readonly string[]
): string[] {
    const allowedTypeSet = new Set(
        Array.isArray(allowedTypes) ? allowedTypes : []
    );
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(
        (type): type is string =>
            typeof type === 'string' && allowedTypeSet.has(type)
    );
}

export function sanitizeNotificationPageSizes(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return NOTIFICATION_TABLE_DEFAULT_PAGE_SIZES;
    }

    const normalized = Array.from(
        new Set(
            value
                .map((entry) => Number.parseInt(String(entry), 10))
                .filter(
                    (entry) =>
                        Number.isFinite(entry) && entry > 0 && entry <= 1000
                )
        )
    ).sort((left, right) => left - right);

    return normalized.length
        ? normalized
        : NOTIFICATION_TABLE_DEFAULT_PAGE_SIZES;
}

export function sanitizeNotificationColumnVisibility(value: unknown) {
    const visibility: Record<string, boolean> = {};
    if (!isRecord(value)) {
        return visibility;
    }

    for (const [columnId, visible] of Object.entries(value)) {
        const normalizedColumnId = normalizeNotificationColumnId(columnId);
        if (
            NOTIFICATION_TABLE_COLUMN_ID_SET.has(normalizedColumnId) &&
            typeof visible === 'boolean'
        ) {
            visibility[normalizedColumnId] = visible;
        }
    }
    return visibility;
}

export function sanitizeNotificationColumnOrder(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const order: string[] = [];
    for (const columnId of value) {
        const normalizedColumnId = normalizeNotificationColumnId(columnId);
        if (
            NOTIFICATION_TABLE_COLUMN_ID_SET.has(normalizedColumnId) &&
            !order.includes(normalizedColumnId)
        ) {
            order.push(normalizedColumnId);
        }
    }
    return order;
}

export function sanitizeNotificationColumnSizing(value: unknown) {
    if (!isRecord(value)) {
        return {};
    }

    const normalizedSizing: Record<string, unknown> = {};
    for (const [columnId, rawSize] of Object.entries(value)) {
        const normalizedColumnId = normalizeNotificationColumnId(columnId);
        if (NOTIFICATION_TABLE_COLUMN_ID_SET.has(normalizedColumnId)) {
            normalizedSizing[normalizedColumnId] = rawSize;
        }
    }

    return sanitizeTableColumnSizing(
        normalizedSizing,
        NOTIFICATION_TABLE_COLUMN_IDS
    );
}

export function resolveNotificationPageSize(
    candidate: unknown,
    allowed: readonly number[] = NOTIFICATION_TABLE_DEFAULT_PAGE_SIZES,
    fallback: unknown = 20
) {
    const pageSizes = Array.isArray(allowed)
        ? allowed.filter((size) => Number.isFinite(size) && size > 0)
        : NOTIFICATION_TABLE_DEFAULT_PAGE_SIZES;
    const fallbackPageSize = pageSizes.length
        ? pageSizes[0]
        : NOTIFICATION_TABLE_DEFAULT_PAGE_SIZES[0];
    const nearestPageSize = (value: number) =>
        pageSizes.length
            ? pageSizes.reduce((previous, size) =>
                  Math.abs(size - value) < Math.abs(previous - value)
                      ? size
                      : previous
              )
            : fallbackPageSize;
    const parsed = Number.parseInt(String(candidate), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return pageSizes.includes(parsed) ? parsed : nearestPageSize(parsed);
    }
    return pageSizes.includes(fallback)
        ? fallback
        : nearestPageSize(Number(fallback) || fallbackPageSize);
}
