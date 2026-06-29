import { create } from 'zustand';

import type {
    BackgroundImageCustomSource,
    BackgroundImageMode,
    BackgroundImageProviderId,
    BackgroundImageSnapshot
} from '@/services/background-image/types';

interface BackgroundImageStore {
    mode: BackgroundImageMode;
    enabled: boolean;
    providerId: BackgroundImageProviderId;
    customSource: BackgroundImageCustomSource | null;
    snapshot: BackgroundImageSnapshot | null;
    loading: boolean;
    error: string | null;
    hydrate(options: {
        mode: BackgroundImageMode;
        enabled: boolean;
        providerId: BackgroundImageProviderId;
        customSource: BackgroundImageCustomSource | null;
        snapshot: BackgroundImageSnapshot | null;
    }): void;
    setStateSnapshot(options: {
        mode: BackgroundImageMode;
        enabled: boolean;
        providerId: BackgroundImageProviderId;
        customSource: BackgroundImageCustomSource | null;
        snapshot: BackgroundImageSnapshot | null;
    }): void;
    setLoading(loading: boolean): void;
    setError(error: string | null): void;
}

export const useBackgroundImageStore = create<BackgroundImageStore>((set) => ({
    mode: 'off',
    enabled: false,
    providerId: 'nasa-epic',
    customSource: null,
    snapshot: null,
    loading: false,
    error: null,
    hydrate({ mode, enabled, providerId, customSource, snapshot }) {
        set({
            mode,
            enabled: Boolean(enabled),
            providerId,
            customSource,
            snapshot
        });
    },
    setStateSnapshot({ mode, enabled, providerId, customSource, snapshot }) {
        set({
            mode,
            enabled: Boolean(enabled),
            providerId,
            customSource,
            snapshot
        });
    },
    setLoading(loading) {
        set({ loading: Boolean(loading) });
    },
    setError(error) {
        set({ error });
    }
}));
