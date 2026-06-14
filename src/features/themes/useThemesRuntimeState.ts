import { useBackgroundImageStore } from '@/state/backgroundImageStore';
import { useCommunityThemeStore } from '@/state/communityThemeStore';
import { useShellStore } from '@/state/shellStore';

export function useThemesRuntimeState() {
    const themeMode = useShellStore((state: any) => state.themeMode);
    const themeColor = useShellStore((state: any) => state.themeColor);
    const backgroundImageEnabled = useBackgroundImageStore(
        (state: any) => state.enabled
    );
    const backgroundImageMode = useBackgroundImageStore(
        (state: any) => state.mode
    );
    const backgroundImageCustomSource = useBackgroundImageStore(
        (state: any) => state.customSource
    );
    const catalog = useCommunityThemeStore((state: any) => state.catalog);
    const enabled = useCommunityThemeStore((state: any) => state.enabled);
    const installedTheme = useCommunityThemeStore(
        (state: any) => state.installedTheme
    );
    const installedThemes = useCommunityThemeStore(
        (state: any) => state.installedThemes
    );
    const localPreview = useCommunityThemeStore(
        (state: any) => state.localPreview
    );
    const localPreviewWatch = useCommunityThemeStore(
        (state: any) => state.localPreviewWatch
    );
    const overrideCssLength = useCommunityThemeStore(
        (state: any) => state.overrideCssLength
    );
    const loading = useCommunityThemeStore((state: any) => state.loading);
    const error = useCommunityThemeStore((state: any) => state.error);

    return {
        themeMode,
        themeColor,
        backgroundImageEnabled,
        backgroundImageMode,
        backgroundImageCustomSource,
        catalog,
        enabled,
        installedTheme,
        installedThemes,
        localPreview,
        localPreviewWatch,
        overrideCssLength,
        loading,
        error
    };
}
