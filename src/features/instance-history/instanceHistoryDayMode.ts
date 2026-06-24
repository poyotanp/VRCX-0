import {
    createdTime,
    rowDurationValue,
    rowLocation
} from '@/components/dialogs/previous-instances-table/previousInstancesRows';

import { toLocalDayKey } from './instance-activity/instanceActivityDate';

export type InstanceHistoryMode = 'search' | 'day';

export function sanitizeInstanceHistoryMode(
    value: unknown
): InstanceHistoryMode {
    return value === 'day' ? 'day' : 'search';
}

export function previousInstanceLeaveMs(row: any) {
    const groupedLeaveMs = Number(row?.last_ts ?? row?.lastTs ?? 0);
    if (Number.isFinite(groupedLeaveMs) && groupedLeaveMs > 0) {
        return groupedLeaveMs;
    }
    return createdTime(row);
}

export function previousInstanceJoinMs(row: any) {
    const leaveMs = previousInstanceLeaveMs(row);
    return leaveMs - rowDurationValue(row);
}

export function buildAvailableInstanceHistoryDays(rows: any[] = []) {
    return Array.from(
        new Set(
            rows
                .map((row: any) => toLocalDayKey(previousInstanceLeaveMs(row)))
                .filter(Boolean)
        )
    ).sort((left: any, right: any) => right.localeCompare(left));
}

export function selectDefaultInstanceHistoryDay(
    selectedDay: unknown,
    availableDays: any[] = []
) {
    const normalizedSelectedDay = String(selectedDay || '');
    if (
        normalizedSelectedDay &&
        availableDays.includes(normalizedSelectedDay)
    ) {
        return normalizedSelectedDay;
    }
    return availableDays[0] || normalizedSelectedDay || '';
}

export function filterPreviousInstanceRowsForDay(
    rows: any[] = [],
    selectedDay: unknown
) {
    const dayKey = String(selectedDay || '');
    if (!dayKey) {
        return [];
    }
    return rows
        .filter(
            (row: any) => toLocalDayKey(previousInstanceLeaveMs(row)) === dayKey
        )
        .sort(
            (left: any, right: any) =>
                previousInstanceLeaveMs(right) - previousInstanceLeaveMs(left)
        );
}

export function activityRowKey(row: any) {
    const location = row?.location || '';
    const joinMs = Number(row?.joinMs || 0);
    return location && Number.isFinite(joinMs) && joinMs > 0
        ? `${location}:${joinMs}`
        : '';
}

function matchByLocationAndJoin(
    items: any[],
    location: string,
    targetJoinMs: number,
    getLocation: (item: any) => string,
    getJoinMs: (item: any) => number
) {
    if (!location || !Number.isFinite(targetJoinMs)) {
        return null;
    }
    let best: any = null;
    let bestDelta = Infinity;
    for (const item of items) {
        if (getLocation(item) !== location) {
            continue;
        }
        const joinMs = getJoinMs(item);
        if (!Number.isFinite(joinMs)) {
            continue;
        }
        const delta = Math.abs(joinMs - targetJoinMs);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = item;
        }
    }
    return best;
}

export function findPreviousInstanceRowForActivityRow(
    activityRow: any,
    rows: any[] = []
) {
    return matchByLocationAndJoin(
        rows,
        String(activityRow?.location || ''),
        Number(activityRow?.joinMs || 0),
        rowLocation,
        previousInstanceJoinMs
    );
}

export function findActivityRowForPreviousInstanceRow(
    previousRow: any,
    activityRows: any[] = []
) {
    return matchByLocationAndJoin(
        activityRows,
        rowLocation(previousRow),
        previousInstanceJoinMs(previousRow),
        (activityRow: any) => String(activityRow?.location || ''),
        (activityRow: any) => Number(activityRow?.joinMs || 0)
    );
}
