import type {
    CommunityThemeAccentMode,
    CommunityThemeAuthor,
    CommunityThemeCatalog,
    CommunityThemeManifest
} from '@/features/community-themes/communityThemeTypes';

export const COMMUNITY_THEME_CATALOG_URL =
    'https://raw.githubusercontent.com/Map1en/VRCX-0-Community-Themes/master/themes/index.json';

export const COMMUNITY_THEME_CSS_FILE_NAME = 'theme.css';
export const COMMUNITY_THEME_PREVIEW_FILE_NAME = 'preview.webp';
export const COMMUNITY_THEME_README_FILE_NAME = 'README.md';

type RawCommunityThemeEntry = Record<string, unknown>;

const DEFAULT_COMMUNITY_THEME_LICENSE = 'GPL-3.0-only';
const THEME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireString(
    entry: RawCommunityThemeEntry,
    field: string,
    context: string
): string {
    const value = entry[field];
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Invalid community theme ${context}: missing ${field}.`);
    }
    return value.trim();
}

function optionalString(
    entry: RawCommunityThemeEntry,
    field: string
): string | undefined {
    const value = entry[field];
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined;
}

function normalizeTags(value: unknown, context: string): string[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid community theme ${context}: missing tags.`);
    }
    return value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 3);
}

function normalizeAuthor(value: unknown, context: string): CommunityThemeAuthor {
    if (!value || typeof value !== 'object') {
        throw new Error(`Invalid community theme ${context}: missing author.`);
    }

    const author = value as RawCommunityThemeEntry;
    return {
        name: requireString(author, 'name', `${context} author`),
        github: requireString(author, 'github', `${context} author`),
        url: optionalString(author, 'url')
    };
}

function normalizeAccentMode(value: unknown): CommunityThemeAccentMode {
    return value === true;
}

export function normalizeCommunityThemeCatalogUrl(value?: string | null): string {
    const catalogUrl = String(value || '').trim();
    if (!catalogUrl) {
        return COMMUNITY_THEME_CATALOG_URL;
    }
    return catalogUrl;
}

export function resolveCommunityThemeAssetUrl(
    catalogUrl: string,
    themeId: string,
    fileName: string
): string {
    const safeThemeId = themeId.replace(/^\/+|\/+$/g, '');
    const safeFileName = fileName.replace(/^\/+/, '');
    try {
        return new URL(`${safeThemeId}/${safeFileName}`, catalogUrl).toString();
    } catch {
        const catalogBaseUrl = catalogUrl.replace(/\/[^/]*$/, '/');
        return `${catalogBaseUrl}${safeThemeId}/${safeFileName}`;
    }
}

function normalizeCommunityThemeManifest(
    value: unknown,
    catalogUrl: string
): CommunityThemeManifest {
    if (!value || typeof value !== 'object') {
        throw new Error('Invalid community theme catalog entry.');
    }

    const entry = value as RawCommunityThemeEntry;
    const context = requireString(entry, 'id', 'entry');
    if (!THEME_ID_PATTERN.test(context)) {
        throw new Error(`Invalid community theme ${context}: invalid id.`);
    }

    return {
        id: context,
        name: requireString(entry, 'name', context),
        version: requireString(entry, 'version', context),
        author: normalizeAuthor(entry.author, context),
        license: optionalString(entry, 'license') ?? DEFAULT_COMMUNITY_THEME_LICENSE,
        licenseUrl: optionalString(entry, 'licenseUrl'),
        description: requireString(entry, 'description', context),
        tags: normalizeTags(entry.tags, context),
        testedWith: requireString(entry, 'testedWith', context),
        remoteAssets: entry.remoteAssets === true,
        accentMode: normalizeAccentMode(entry.accentMode),
        previewUrl: resolveCommunityThemeAssetUrl(
            catalogUrl,
            context,
            COMMUNITY_THEME_PREVIEW_FILE_NAME
        ),
        readmeUrl: resolveCommunityThemeAssetUrl(
            catalogUrl,
            context,
            COMMUNITY_THEME_README_FILE_NAME
        )
    };
}

export async function loadCommunityThemeCatalog(
    catalogUrl = COMMUNITY_THEME_CATALOG_URL
): Promise<CommunityThemeCatalog> {
    const normalizedCatalogUrl = normalizeCommunityThemeCatalogUrl(catalogUrl);
    const response = await fetch(normalizedCatalogUrl, {
        cache: 'no-cache'
    });
    if (!response.ok) {
        throw new Error(
            `Failed to load community theme catalog: ${response.status} ${response.statusText}`
        );
    }

    const payload = (await response.json()) as RawCommunityThemeEntry;
    const themes = Array.isArray(payload.themes) ? payload.themes : [];
    return {
        sourceUrl: normalizedCatalogUrl,
        schemaVersion: Number(payload.schemaVersion) || 1,
        themes: themes.map((theme) =>
            normalizeCommunityThemeManifest(theme, normalizedCatalogUrl)
        )
    };
}

export async function loadCommunityThemeCss(
    catalogUrl: string,
    theme: CommunityThemeManifest
): Promise<string> {
    const normalizedCatalogUrl = normalizeCommunityThemeCatalogUrl(catalogUrl);
    const cssUrl = resolveCommunityThemeAssetUrl(
        normalizedCatalogUrl,
        theme.id,
        COMMUNITY_THEME_CSS_FILE_NAME
    );
    const response = await fetch(cssUrl, {
        cache: 'no-cache'
    });
    if (!response.ok) {
        throw new Error(
            `Failed to load community theme CSS: ${response.status} ${response.statusText}`
        );
    }
    return response.text();
}
