import { Channel, invoke } from '@tauri-apps/api/core';

import { storageRepository, webRepository } from '@/repositories/index.js';
import { branches } from '@/shared/constants/settings.js';
import {
    compareReleaseVersions,
    formatReleaseDisplayVersion,
    parseReleaseVersion
} from '@/shared/utils/releaseVersion.js';

const INSTALLABLE_PLATFORMS = new Set(['windows', 'linux']);
let updateInstallInFlight = null;

function platformIdForHost(hostPlatform) {
    return hostPlatform === 'linux'
        ? 'linux-x86_64'
        : hostPlatform === 'windows'
          ? 'windows-x86_64'
          : '';
}

function getUpdaterTarget(hostPlatform) {
    const platformId = platformIdForHost(hostPlatform);
    return platformId ? `${platformId}-stable` : '';
}

function getUpdaterManifestAssetName(hostPlatform) {
    const target = getUpdaterTarget(hostPlatform);
    return target ? `vrcx-0-updater-${target}.json` : '';
}

function canInstallUpdatesOnPlatform(hostPlatform) {
    return INSTALLABLE_PLATFORMS.has(hostPlatform);
}

function getTauriManifestAssetOfInterest(assets = [], hostPlatform) {
    const manifestName = getUpdaterManifestAssetName(hostPlatform);
    if (!manifestName) {
        return null;
    }

    const asset = assets.find(
        (item) => item?.state === 'uploaded' && item.name === manifestName
    );
    if (!asset?.browser_download_url) {
        return null;
    }

    return {
        manifestUrl: asset.browser_download_url,
        target: getUpdaterTarget(hostPlatform),
        updaterType: 'tauri'
    };
}

function normalizeGitHubRelease(
    release,
    { hostPlatform = 'unknown', requireInstallerAsset = true } = {}
) {
    const parsedVersion = parseReleaseVersion(release?.tag_name);
    if (!parsedVersion) {
        return null;
    }

    const tauriAsset = getTauriManifestAssetOfInterest(
        release.assets,
        hostPlatform
    );
    const asset = tauriAsset;
    if (requireInstallerAsset && !asset) {
        return null;
    }

    return {
        ...(asset || {}),
        canonicalVersion: parsedVersion.canonicalVersion,
        channel: 'Stable',
        displayVersion: parsedVersion.displayVersion,
        htmlUrl: release.html_url || '',
        tagName: release.tag_name,
        displayName: release.name || `VRCX-0 ${parsedVersion.displayVersion}`,
        prerelease: Boolean(release.prerelease),
        publishedAt: release.published_at || '',
        body: release.body || '',
        updaterType: asset?.updaterType || 'manual'
    };
}

function normalizeReleaseList(branch, releases, options = {}) {
    const normalizedBranch = sanitizeBranch(branch);
    return (Array.isArray(releases) ? releases : [releases])
        .map((release) =>
            normalizeGitHubRelease(release, {
                ...options
            })
        )
        .filter(
            (release) =>
                release &&
                release.channel === normalizedBranch &&
                release.prerelease === false
        )
        .sort((left, right) =>
            compareReleaseVersions(
                right.canonicalVersion,
                left.canonicalVersion
            )
        );
}

function sanitizeBranch() {
    return 'Stable';
}

function defaultBranchForVersion() {
    return 'Stable';
}

function hasUpdateForBranch(branch, currentVersion, latestReleaseVersion) {
    const currentParsed = parseReleaseVersion(currentVersion);
    const latestParsed = parseReleaseVersion(latestReleaseVersion);

    if (!currentParsed || !latestParsed) {
        return false;
    }

    const normalizedBranch = sanitizeBranch(branch);
    if (normalizedBranch !== 'Stable') {
        return false;
    }

    return (
        compareReleaseVersions(latestParsed.canonicalVersion, currentParsed) > 0
    );
}

async function fetchBranchReleases(branch, options = {}) {
    const normalizedBranch = sanitizeBranch(branch);
    const response = await webRepository.execute({
        url: branches[normalizedBranch].urlReleases,
        method: 'GET',
        headers: {
            Accept: 'application/vnd.github+json'
        }
    });
    if (response.status && response.status !== 200) {
        throw new Error(`GitHub release request failed (${response.status}).`);
    }

    const data =
        typeof response.data === 'string'
            ? JSON.parse(response.data)
            : response.data;
    if (data?.message) {
        throw new Error(data.message);
    }

    return normalizeReleaseList(normalizedBranch, data, options);
}

async function fetchLatestBranchRelease(branch, options = {}) {
    const releases = await fetchBranchReleases(branch, options);
    return releases[0] || null;
}

async function getUpdaterProxy() {
    const proxy = await storageRepository
        .getString('VRCX_ProxyServer', '')
        .catch(() => '');
    return String(proxy || '').trim();
}

function shouldAllowDowngradesForBranch() {
    return false;
}

async function buildTauriUpdaterRequest(release, hostPlatform) {
    if (!canInstallUpdatesOnPlatform(hostPlatform)) {
        throw new Error(`Updates are not installable on ${hostPlatform}.`);
    }

    const target = release?.target || getUpdaterTarget(hostPlatform);
    if (!target) {
        throw new Error('No Tauri updater target is available.');
    }
    if (!release?.manifestUrl) {
        throw new Error('Selected release has no Tauri updater manifest.');
    }

    const proxy = await getUpdaterProxy();
    return {
        manifestUrl: release.manifestUrl,
        target,
        allowDowngrades: shouldAllowDowngradesForBranch(),
        ...(proxy ? { proxy } : {})
    };
}

async function checkTauriUpdateForRelease(release, options = {}) {
    const request = await buildTauriUpdaterRequest(
        release,
        options.hostPlatform || 'unknown'
    );
    return invoke('app__check_tauri_update', request);
}

function handleTauriDownloadEvent(event, onProgress) {
    if (event.event === 'Started') {
        return {
            downloaded: 0,
            contentLength: Number(event.data?.contentLength) || 0
        };
    }
    if (event.event === 'Finished') {
        onProgress?.(100);
    }
    return null;
}

async function checkInstallableUpdate(
    branch,
    { hostPlatform = 'unknown' } = {}
) {
    if (!canInstallUpdatesOnPlatform(hostPlatform)) {
        return null;
    }

    const release = await fetchLatestBranchRelease(branch, {
        hostPlatform,
        requireInstallerAsset: true
    });
    if (!release) {
        return null;
    }

    return checkTauriUpdateForRelease(release, { branch, hostPlatform });
}

async function downloadAndInstallUpdate(release, options = {}) {
    if (updateInstallInFlight) {
        throw new Error('An update install is already in progress.');
    }
    const hostPlatform = options.hostPlatform || 'unknown';
    if (!release?.target) {
        throw new Error('Selected release has no Tauri updater target.');
    }

    updateInstallInFlight = (async () => {
        let downloaded = 0;
        let contentLength = 0;
        const request = await buildTauriUpdaterRequest(release, hostPlatform);
        const onEvent = new Channel((event) => {
            const state = handleTauriDownloadEvent(event, options.onProgress);
            if (state) {
                downloaded = state.downloaded;
                contentLength = state.contentLength;
                options.onProgress?.(0);
                return;
            }
            if (event.event === 'Progress') {
                downloaded += Number(event.data?.chunkLength) || 0;
                if (contentLength > 0) {
                    options.onProgress?.(
                        Math.min(
                            100,
                            Math.round((downloaded / contentLength) * 100)
                        )
                    );
                }
                return;
            }
        });

        const update = await invoke('app__download_and_install_tauri_update', {
            ...request,
            onEvent
        });
        if (!update) {
            throw new Error('No Tauri update is available.');
        }

        return update;
    })();

    try {
        return await updateInstallInFlight;
    } finally {
        updateInstallInFlight = null;
    }
}

export {
    canInstallUpdatesOnPlatform,
    checkInstallableUpdate,
    defaultBranchForVersion,
    downloadAndInstallUpdate,
    fetchBranchReleases,
    fetchLatestBranchRelease,
    formatReleaseDisplayVersion,
    getUpdaterManifestAssetName,
    getUpdaterTarget,
    hasUpdateForBranch,
    normalizeGitHubRelease,
    normalizeReleaseList,
    sanitizeBranch
};
