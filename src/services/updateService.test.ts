import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchGithubReleases: vi.fn(),
    checkTauriUpdate: vi.fn(),
    downloadAndInstallTauriUpdate: vi.fn(),
    getStorageString: vi.fn()
}));

vi.mock('@/repositories/externalApiRepository', () => ({
    default: {
        fetchGithubReleases: mocks.fetchGithubReleases
    }
}));

vi.mock('@/repositories/storageRepository', () => ({
    default: {
        getString: mocks.getStorageString
    }
}));

vi.mock('@/platform/tauri/updater', () => ({
    checkTauriUpdate: mocks.checkTauriUpdate,
    downloadAndInstallTauriUpdate: mocks.downloadAndInstallTauriUpdate
}));

import {
    getPreviewStableReleaseUpdateMode,
    handlePreviewStableReleaseUpdateCheck
} from './updateService';

function release({
    publishedAt
}: {
    publishedAt: string;
}) {
    return {
        tag_name: 'v2.7.0',
        assets: [],
        html_url: 'https://github.com/Map1en/VRCX-0/releases/tag/v2.7.0',
        name: 'VRCX-0 2.7.0',
        prerelease: false,
        published_at: publishedAt,
        body: ''
    };
}

describe('updateService preview stable update checks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('VRCX_0_BUILD_LABEL', 'preview');
        vi.stubGlobal('VRCX_0_BUILD_BADGE', 'Preview 20260621-1530');
        mocks.fetchGithubReleases.mockResolvedValue({
            status: 200,
            data: [release({ publishedAt: '2026-06-21T07:00:00Z' })]
        });
    });

    it('returns the latest stable release when it was published after the preview build timestamp', async () => {
        const update = await handlePreviewStableReleaseUpdateCheck({
            hostPlatform: 'windows',
            hostArch: 'x86_64',
            linuxPackageKind: ''
        });

        expect(update.handled).toBe(true);
        expect(update.release?.tagName).toBe('v2.7.0');
        expect(update.release?.updaterType).toBe('manual');
    });

    it('does not return a stable release published before the preview build timestamp', async () => {
        mocks.fetchGithubReleases.mockResolvedValue({
            status: 200,
            data: [release({ publishedAt: '2026-06-21T06:29:59Z' })]
        });

        await expect(
            handlePreviewStableReleaseUpdateCheck({
                hostPlatform: 'windows',
                hostArch: 'x86_64',
                linuxPackageKind: ''
            })
        ).resolves.toEqual({
            handled: true,
            release: null
        });
    });

    it('does not check GitHub when the build is not a timestamped preview build', async () => {
        vi.stubGlobal('VRCX_0_BUILD_LABEL', 'devkit');
        vi.stubGlobal('VRCX_0_BUILD_BADGE', 'Dev Kit 20260621-1530');

        await expect(
            handlePreviewStableReleaseUpdateCheck({
                hostPlatform: 'windows',
                hostArch: 'x86_64',
                linuxPackageKind: ''
            })
        ).resolves.toEqual({
            handled: false,
            release: null
        });
        expect(mocks.fetchGithubReleases).not.toHaveBeenCalled();
    });

    it('does not check GitHub when the preview badge timestamp cannot be parsed', async () => {
        vi.stubGlobal('VRCX_0_BUILD_BADGE', 'Preview latest');

        expect(getPreviewStableReleaseUpdateMode().enabled).toBe(true);
        await expect(
            handlePreviewStableReleaseUpdateCheck({
                hostPlatform: 'windows',
                hostArch: 'x86_64',
                linuxPackageKind: ''
            })
        ).resolves.toEqual({
            handled: true,
            release: null
        });
        expect(mocks.fetchGithubReleases).not.toHaveBeenCalled();
    });
});
