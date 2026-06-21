import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    downloadAndInstallUpdate: vi.fn(),
    openExternalLink: vi.fn(),
    restartApplication: vi.fn(),
    toastError: vi.fn(),
    toastLoading: vi.fn(),
    toastSuccess: vi.fn(),
    toastCustom: vi.fn()
}));

vi.mock('@/services/updateService', () => ({
    downloadAndInstallUpdate: mocks.downloadAndInstallUpdate,
    formatReleaseDisplayVersion: (value: unknown) => String(value || '')
}));

vi.mock('@/services/entityMediaService', () => ({
    openExternalLink: mocks.openExternalLink
}));

vi.mock('@/services/shellIntegrationService', () => ({
    restartApplication: mocks.restartApplication
}));

vi.mock('@/services/i18nService', () => ({
    default: {
        t: (key: string, values?: Record<string, unknown>) =>
            values ? `${key}:${JSON.stringify(values)}` : key
    }
}));

vi.mock('sonner', () => ({
    toast: {
        error: mocks.toastError,
        loading: mocks.toastLoading,
        success: mocks.toastSuccess,
        custom: mocks.toastCustom
    }
}));

import { useRuntimeStore } from '@/state/runtimeStore';

import { openOrInstallLatestAvailableUpdate } from './updateInstallService';

describe('openOrInstallLatestAvailableUpdate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeStore.getState().resetRuntimeState();
        useRuntimeStore.getState().setHostCapabilities({
            platform: 'windows',
            arch: 'x86_64',
            linuxPackageKind: ''
        });
    });

    it('opens GitHub for a manual preview update release', async () => {
        useRuntimeStore.getState().setUpdateLoopState({
            latestUpdaterRelease: {
                updaterType: 'manual',
                htmlUrl: 'https://github.com/Map1en/VRCX-0/releases/tag/v2.7.0',
                canonicalVersion: '2.7.0',
                displayVersion: '2.7.0',
                tagName: 'v2.7.0',
                displayName: 'VRCX-0 2.7.0'
            }
        });

        await openOrInstallLatestAvailableUpdate();

        expect(mocks.openExternalLink).toHaveBeenCalledWith(
            'https://github.com/Map1en/VRCX-0/releases/tag/v2.7.0'
        );
        expect(mocks.downloadAndInstallUpdate).not.toHaveBeenCalled();
        expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it('keeps installing when the latest update has Tauri updater metadata', async () => {
        useRuntimeStore.getState().setUpdateLoopState({
            latestUpdaterRelease: {
                updaterType: 'tauri',
                manifestUrl:
                    'https://github.com/Map1en/VRCX-0/releases/latest/download/latest_windows.json',
                target: 'windows-x86_64-stable',
                htmlUrl: 'https://github.com/Map1en/VRCX-0/releases/tag/v2.7.0',
                canonicalVersion: '2.7.0',
                displayVersion: '2.7.0',
                tagName: 'v2.7.0',
                displayName: 'VRCX-0 2.7.0'
            }
        });
        mocks.downloadAndInstallUpdate.mockResolvedValue({});

        await openOrInstallLatestAvailableUpdate();

        expect(mocks.downloadAndInstallUpdate).toHaveBeenCalled();
        expect(mocks.openExternalLink).not.toHaveBeenCalled();
    });
});
