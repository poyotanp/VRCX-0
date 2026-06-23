import configRepository from '@/repositories/configRepository';

import { postTelemetry } from './telemetryClient';
import {
    TELEMETRY_CONFIG_REPORTED_VERSION_CONFIG_KEY,
    isAnonymousUsageTelemetryEnabled
} from './telemetryConfig';
import { buildTelemetryContext } from './telemetryPayload';
import type {
    TelemetryConfigSnapshot,
    TelemetrySessionState
} from './telemetryTypes';

const ENUM_VALUE_MAX_LENGTH = 32;

const THEME_MODE_CONFIG_KEY = 'ThemeMode';
const COMMUNITY_THEME_ENABLED_CONFIG_KEY = 'VRCX_communityThemeEnabled';
const BACKGROUND_IMAGE_ENABLED_CONFIG_KEY = 'VRCX_backgroundImageEnabled';
const BACKGROUND_IMAGE_LEGACY_ENABLED_CONFIG_KEY =
    'VRCX_officialBackgroundEnabled';
const BACKGROUND_IMAGE_MODE_CONFIG_KEY = 'VRCX_backgroundImageMode';

function currentTelemetryVersion(): string {
    return typeof VERSION === 'string' && VERSION ? VERSION : 'unknown';
}

function normalizeEnum(value: string): string {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, ENUM_VALUE_MAX_LENGTH);
    return normalized || 'unknown';
}

function resolveBuiltInThemeMode(themeMode: string): 'dark' | 'light' {
    const normalized = themeMode.trim().toLowerCase();
    if (normalized === 'dark' || normalized === 'midnight') {
        return 'dark';
    }
    if (normalized === 'light') {
        return 'light';
    }
    // 'system' or any legacy value: resolve against the OS preference so the
    // reported value is always a plain dark / light bucket.
    return typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

// Reports the active appearance as a coarse category instead of the raw theme
// name. Community themes are reported as a single anonymous bucket so theme
// names never ride along in telemetry.
async function resolveThemeCategory(): Promise<string> {
    const communityThemeEnabled = await configRepository.getBool(
        COMMUNITY_THEME_ENABLED_CONFIG_KEY,
        false
    );
    if (communityThemeEnabled) {
        return 'community';
    }

    const backgroundImageEnabled =
        (await configRepository.getBool(
            BACKGROUND_IMAGE_ENABLED_CONFIG_KEY,
            false
        )) ||
        (await configRepository.getBool(
            BACKGROUND_IMAGE_LEGACY_ENABLED_CONFIG_KEY,
            false
        ));
    if (backgroundImageEnabled) {
        const mode = (
            await configRepository.getString(
                BACKGROUND_IMAGE_MODE_CONFIG_KEY,
                'daily'
            )
        )
            .trim()
            .toLowerCase();
        return mode === 'custom' ? 'background_custom' : 'background_image';
    }

    const themeMode = await configRepository.getString(
        THEME_MODE_CONFIG_KEY,
        'system'
    );
    return resolveBuiltInThemeMode(themeMode);
}

export async function buildConfigSnapshot(): Promise<TelemetryConfigSnapshot> {
    const [
        backgroundModeEnabled,
        wristOverlayEnabled,
        xsNotifications,
        ovrtHudNotifications,
        ovrtWristNotifications,
        discordActive,
        mcpServerEnabled,
        webhookEnabled,
        autoStateChangeEnabled,
        autoAcceptInviteRequests,
        avatarAutoCleanup,
        themeMode
    ] = await Promise.all([
        configRepository.getBool('backgroundModeEnabled', false),
        configRepository.getBool('wristOverlayEnabled', false),
        configRepository.getBool('xsNotifications', true),
        configRepository.getBool('ovrtHudNotifications', true),
        configRepository.getBool('ovrtWristNotifications', false),
        configRepository.getBool('discordActive', false),
        configRepository.getBool('mcpServerEnabled', false),
        configRepository.getBool('webhookEnabled', false),
        configRepository.getBool('autoStateChangeEnabled', false),
        configRepository.getString('autoAcceptInviteRequests', 'Off'),
        configRepository.getString('avatarAutoCleanup', 'Off'),
        resolveThemeCategory()
    ]);

    return {
        backgroundModeEnabled,
        wristOverlayEnabled,
        xsNotifications,
        ovrtHudNotifications,
        ovrtWristNotifications,
        discordActive,
        mcpServerEnabled,
        webhookEnabled,
        autoStateChangeEnabled,
        autoAcceptInviteRequests: normalizeEnum(autoAcceptInviteRequests),
        avatarAutoCleanup: normalizeEnum(avatarAutoCleanup),
        themeMode
    };
}

export async function sendConfigSnapshot(
    session: TelemetrySessionState
): Promise<void> {
    if (!isAnonymousUsageTelemetryEnabled()) {
        return;
    }

    const version = currentTelemetryVersion();
    const reportedVersion = await configRepository.getString(
        TELEMETRY_CONFIG_REPORTED_VERSION_CONFIG_KEY,
        ''
    );
    if (reportedVersion === version) {
        return;
    }

    const config = await buildConfigSnapshot();
    await postTelemetry('/api/v1/telemetry/config', {
        ...buildTelemetryContext(session),
        config
    });
    await configRepository.setString(
        TELEMETRY_CONFIG_REPORTED_VERSION_CONFIG_KEY,
        version
    );
}
