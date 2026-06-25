import { useCallback, useMemo, useState } from 'react';

const DATA_TABLE_STORAGE_PREFIX = 'vrcx-0:table:';

function getBrowserLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    return window.localStorage;
}

export function getDataTableStorageKey(tableId: any) {
    return `${DATA_TABLE_STORAGE_PREFIX}${tableId}`;
}

export function safeJsonParse(value: any) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function readPersistedTableState(storageKey: any) {
    if (!storageKey) {
        return {};
    }

    const localStorage = getBrowserLocalStorage();
    if (!localStorage) {
        return {};
    }

    try {
        return safeJsonParse(localStorage.getItem(storageKey)) ?? {};
    } catch {
        return {};
    }
}

export function writePersistedTableState(storageKey: any, patch: any) {
    if (!storageKey) {
        return;
    }

    const localStorage = getBrowserLocalStorage();
    if (!localStorage) {
        return;
    }

    try {
        const current = readPersistedTableState(storageKey);
        localStorage.setItem(
            storageKey,
            JSON.stringify({
                ...current,
                ...patch,
                updatedAt: Date.now()
            })
        );
    } catch {
        // Persisted table state is optional.
    }
}

export function sanitizeTableColumnSizing(value: any, columnIds: any) {
    const sizing: any = {};
    if (!value || typeof value !== 'object' || !Array.isArray(columnIds)) {
        return sizing;
    }

    for (const columnId of columnIds) {
        const width = Number.parseInt(value[columnId], 10);
        if (Number.isFinite(width) && width > 0) {
            sizing[columnId] = width;
        }
    }
    return sizing;
}

export function sanitizeTableColumnVisibility(value: any, columnIds: any) {
    const visibility: any = {};
    if (!value || typeof value !== 'object' || !Array.isArray(columnIds)) {
        return visibility;
    }

    for (const columnId of columnIds) {
        if (typeof value[columnId] === 'boolean') {
            visibility[columnId] = value[columnId];
        }
    }
    return visibility;
}

export function sanitizeTableColumnOrder(
    value: any,
    columnIds: any,
    fallback: any[] = []
) {
    if (!Array.isArray(value) || !Array.isArray(columnIds)) {
        return fallback;
    }

    return value.filter((columnId: any) => columnIds.includes(columnId));
}

export function createPersistedTableStateHelpers(tableId: any) {
    const storageKey = getDataTableStorageKey(tableId);

    return {
        storageKey,
        read: () => readPersistedTableState(storageKey),
        write: (patch: any) => writePersistedTableState(storageKey, patch)
    };
}

export function usePersistedDataTableLayout({
    tableId,
    columnIds = [],
    initialColumnOrder = [],
    initialColumnVisibility = {}
}: any = {}) {
    const storageKey = useMemo(
        () => (tableId ? getDataTableStorageKey(tableId) : null),
        [tableId]
    );
    const [persistedState] = useState(() =>
        readPersistedTableState(storageKey)
    );
    const [columnVisibility, setColumnVisibility] = useState(() => ({
        ...initialColumnVisibility,
        ...sanitizeTableColumnVisibility(
            persistedState.columnVisibility,
            columnIds
        )
    }));
    const [columnOrder, setColumnOrder] = useState(() => {
        const persistedOrder = sanitizeTableColumnOrder(
            persistedState.columnOrder,
            columnIds,
            []
        );
        return persistedOrder.length ? persistedOrder : initialColumnOrder;
    });
    const [columnSizing, setColumnSizing] = useState(() =>
        sanitizeTableColumnSizing(persistedState.columnSizing, columnIds)
    );
    const [columnOrderLocked, setColumnOrderLocked] = useState(
        () => persistedState.columnOrderLocked === true
    );
    const writePersistedState = useCallback(
        (patch: any) => writePersistedTableState(storageKey, patch),
        [storageKey]
    );

    return {
        columnOrder,
        columnOrderLocked,
        columnSizing,
        columnVisibility,
        persistedState,
        setColumnOrder,
        setColumnOrderLocked,
        setColumnSizing,
        setColumnVisibility,
        storageKey,
        writePersistedState
    };
}
