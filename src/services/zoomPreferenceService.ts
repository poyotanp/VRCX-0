import { useShellStore } from '@/state/shellStore.js';

import { setZoomLevelPreference } from './preferencesService.js';
import { normalizeZoomLevel } from './themeService.js';

type ZoomErrorHandler = (error: unknown) => void;
type ZoomPreferenceOptions = {
    onError?: unknown;
};

let applyingZoom = false;
let pendingZoom: number | null = null;
let targetZoom: number | null = null;
let latestErrorHandler: ZoomErrorHandler | null = null;

function getCurrentZoomLevel(): number {
    return normalizeZoomLevel(useShellStore.getState().zoomLevel);
}

async function flushPendingZoom(): Promise<void> {
    if (applyingZoom) {
        return;
    }

    applyingZoom = true;
    try {
        while (pendingZoom !== null) {
            const nextZoom = pendingZoom;
            pendingZoom = null;
            try {
                await setZoomLevelPreference(nextZoom);
                targetZoom = getCurrentZoomLevel();
            } catch (error) {
                targetZoom = getCurrentZoomLevel();
                latestErrorHandler?.(error);
            }
        }
    } finally {
        applyingZoom = false;
        if (pendingZoom !== null) {
            void flushPendingZoom();
        }
    }
}

export function syncQueuedZoomLevel(value: unknown): void {
    if (applyingZoom || pendingZoom !== null) {
        return;
    }

    targetZoom = normalizeZoomLevel(value);
}

export function queueZoomLevelPreference(
    value: unknown,
    { onError }: ZoomPreferenceOptions = {}
): number {
    if (typeof onError === 'function') {
        latestErrorHandler = onError as ZoomErrorHandler;
    }

    targetZoom = normalizeZoomLevel(value);
    pendingZoom = targetZoom;
    void flushPendingZoom();
    return targetZoom;
}

export function stepQueuedZoomLevelPreference(
    delta: number,
    { onError }: ZoomPreferenceOptions = {}
): number {
    const baseZoom = targetZoom ?? getCurrentZoomLevel();
    return queueZoomLevelPreference(baseZoom + delta, { onError });
}
