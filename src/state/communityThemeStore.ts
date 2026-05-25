import { create } from 'zustand';

import type {
    CommunityThemeInstallMetadata,
    CommunityThemeLocalPreview,
    CommunityThemeManifest
} from '@/features/community-themes/communityThemeTypes';

interface CommunityThemeStore {
    catalogUrl: string;
    catalog: CommunityThemeManifest[];
    enabled: boolean;
    installedTheme: CommunityThemeInstallMetadata | null;
    installedThemes: CommunityThemeInstallMetadata[];
    localPreview: CommunityThemeLocalPreview | null;
    overrideCssLength: number;
    loading: boolean;
    error: string | null;
    setCatalog(catalogUrl: string, catalog: CommunityThemeManifest[]): void;
    hydrate(options: {
        catalogUrl: string;
        enabled: boolean;
        installedTheme: CommunityThemeInstallMetadata | null;
        installedThemes?: CommunityThemeInstallMetadata[];
        overrideCssLength: number;
        localPreview?: CommunityThemeLocalPreview | null;
    }): void;
    setInstalledState(options: {
        enabled: boolean;
        installedTheme: CommunityThemeInstallMetadata | null;
        installedThemes?: CommunityThemeInstallMetadata[];
    }): void;
    setLocalPreview(localPreview: CommunityThemeLocalPreview | null): void;
    setOverrideCssLength(length: number): void;
    setLoading(loading: boolean): void;
    setError(error: string | null): void;
}

export function communityThemeControlsAccent(
    enabled: boolean,
    installedTheme: CommunityThemeInstallMetadata | null,
    localPreview: CommunityThemeLocalPreview | null = null
): boolean {
    if (localPreview) {
        return !localPreview.accentMode;
    }
    return Boolean(enabled && installedTheme && !installedTheme.accentMode);
}

export function communityThemeControlsAppearance(
    enabled: boolean,
    installedTheme: CommunityThemeInstallMetadata | null,
    localPreview: CommunityThemeLocalPreview | null = null
): boolean {
    return Boolean(localPreview || (enabled && installedTheme));
}

export const useCommunityThemeStore = create<CommunityThemeStore>(
    (set: any) => ({
        catalogUrl: '',
        catalog: [],
        enabled: false,
        installedTheme: null,
        installedThemes: [],
        localPreview: null,
        overrideCssLength: 0,
        loading: false,
        error: null,
        setCatalog(catalogUrl, catalog) {
            set({ catalogUrl, catalog: Array.isArray(catalog) ? catalog : [] });
        },
        hydrate({
            catalogUrl,
            enabled,
            installedTheme,
            installedThemes,
            overrideCssLength,
            localPreview
        }) {
            set({
                catalogUrl,
                enabled: Boolean(enabled && installedTheme),
                installedTheme,
                installedThemes: Array.isArray(installedThemes)
                    ? installedThemes
                    : installedTheme
                      ? [installedTheme]
                      : [],
                localPreview: localPreview ?? null,
                overrideCssLength: Math.max(0, Number(overrideCssLength) || 0)
            });
        },
        setInstalledState({ enabled, installedTheme, installedThemes }) {
            set({
                enabled: Boolean(enabled && installedTheme),
                installedTheme,
                ...(installedThemes
                    ? { installedThemes: installedThemes.filter(Boolean) }
                    : {})
            });
        },
        setLocalPreview(localPreview) {
            set({ localPreview });
        },
        setOverrideCssLength(length) {
            set({ overrideCssLength: Math.max(0, Number(length) || 0) });
        },
        setLoading(loading) {
            set({ loading: Boolean(loading) });
        },
        setError(error) {
            set({ error });
        }
    })
);
