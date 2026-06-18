import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getConfigString: vi.fn(),
    setConfigString: vi.fn(),
    isHostCapabilityAvailable: vi.fn(),
    canInstallUpdatesOnPlatform: vi.fn(),
    checkInstallableUpdate: vi.fn(),
    defaultBranchForVersion: vi.fn(),
    fetchLatestBranchRelease: vi.fn(),
    formatReleaseDisplayVersion: vi.fn(),
    hasUpdateForBranch: vi.fn(),
    runRuntimeTelemetryJob: vi.fn(),
    recordRuntimeJobTelemetry: vi.fn()
}));

vi.mock('@/repositories/configRepository', () => ({
    default: {
        getString: mocks.getConfigString,
        setString: mocks.setConfigString
    }
}));

vi.mock('./hostCapabilityService', () => ({
    isHostCapabilityAvailable: mocks.isHostCapabilityAvailable
}));

vi.mock('./runtimeJobTelemetryService', () => ({
    recordRuntimeJobTelemetry: mocks.recordRuntimeJobTelemetry,
    runRuntimeTelemetryJob: mocks.runRuntimeTelemetryJob
}));

vi.mock('./updateService', () => ({
    canInstallUpdatesOnPlatform: mocks.canInstallUpdatesOnPlatform,
    checkInstallableUpdate: mocks.checkInstallableUpdate,
    defaultBranchForVersion: mocks.defaultBranchForVersion,
    fetchLatestBranchRelease: mocks.fetchLatestBranchRelease,
    formatReleaseDisplayVersion: mocks.formatReleaseDisplayVersion,
    hasUpdateForBranch: mocks.hasUpdateForBranch,
    sanitizeBranch: (branch: unknown) => String(branch || 'Stable')
}));

vi.mock('./i18nService', () => ({
    default: {
        t: (key: string, values?: Record<string, unknown>) =>
            values ? `${key}:${JSON.stringify(values)}` : key
    }
}));

import { useRuntimeStore } from '@/state/runtimeStore';

import { runStartupMaintenance } from './backgroundMaintenanceService';

describe('backgroundMaintenanceService update checks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('VERSION', '2.6.0');
        useRuntimeStore.getState().resetRuntimeState();
        useRuntimeStore.getState().setHostCapabilities({
            platform: 'windows',
            arch: 'x86_64',
            linuxPackageKind: ''
        });
        mocks.getConfigString.mockImplementation(
            async (key: string, defaultValue: string) => {
                if (key === 'autoUpdateVRCX') {
                    return 'Off';
                }
                return defaultValue;
            }
        );
        mocks.setConfigString.mockResolvedValue(undefined);
        mocks.isHostCapabilityAvailable.mockReturnValue(false);
        mocks.canInstallUpdatesOnPlatform.mockReturnValue(true);
        mocks.defaultBranchForVersion.mockReturnValue('Stable');
        mocks.formatReleaseDisplayVersion.mockImplementation((value: unknown) =>
            String(value || '')
        );
        mocks.checkInstallableUpdate.mockResolvedValue({
            canonicalVersion: '2.7.0',
            displayVersion: '2.7.0',
            htmlUrl: 'https://example.test/release',
            tagName: 'v2.7.0',
            displayName: 'VRCX-0 2.7.0',
            prerelease: false,
            publishedAt: '2026-06-18T00:00:00Z',
            body: '',
            updaterType: 'tauri',
            manifestUrl: 'https://github.com/Map1en/VRCX-0/releases/latest/download/latest_windows.json',
            target: 'windows-x86_64-stable',
            currentVersion: '2.6.0',
            version: '2.7.0',
            date: null,
            rawJson: {}
        });
        mocks.fetchLatestBranchRelease.mockResolvedValue(null);
        mocks.hasUpdateForBranch.mockReturnValue(false);
        mocks.runRuntimeTelemetryJob.mockImplementation(
            async (_metadata: unknown, task: () => Promise<unknown>) => task()
        );
    });

    it('checks for updates even when migrated config disabled old update mode', async () => {
        await runStartupMaintenance();

        expect(mocks.checkInstallableUpdate).toHaveBeenCalledWith('Stable', {
            hostArch: 'x86_64',
            linuxPackageKind: '',
            hostPlatform: 'windows'
        });
        expect(mocks.getConfigString).not.toHaveBeenCalledWith(
            'autoUpdateVRCX',
            expect.anything()
        );
        expect(mocks.setConfigString).not.toHaveBeenCalledWith(
            'autoUpdateVRCX',
            expect.anything()
        );
        expect(useRuntimeStore.getState().updateLoop.hasAvailableUpdate).toBe(
            true
        );
    });
});
