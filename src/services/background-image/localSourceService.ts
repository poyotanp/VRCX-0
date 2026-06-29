import { convertFileSrc } from '@/platform/tauri/assets';
import {
    commands,
    type BackgroundImageFilesResolveInput
} from '@/platform/tauri/bindings';

import type {
    BackgroundImageCustomSource,
    BackgroundImageRotationInterval,
    BackgroundImageSnapshot
} from './types';

export const BACKGROUND_IMAGE_SUPPORTED_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'webp'
] as const;

function currentLocalDate(): string {
    const date = new Date();
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function currentLocalHour(): string {
    return `${currentLocalDate()}T${String(new Date().getHours()).padStart(2, '0')}`;
}

function stableHash(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function fileNameFromPath(path: string): string {
    return (
        String(path || '')
            .split(/[\\/]/)
            .filter(Boolean)
            .pop() || path
    );
}

function uniquePaths(paths: string[]): string[] {
    return Array.from(
        new Set(paths.map((path) => String(path || '').trim()).filter(Boolean))
    );
}

function pathKey(path: string): string {
    return String(path || '')
        .trim()
        .toLowerCase();
}

function rotationKey(interval: BackgroundImageRotationInterval): string {
    return interval === 'hourly' ? currentLocalHour() : currentLocalDate();
}

function sourceHashKey(source: BackgroundImageCustomSource): string {
    if (source.kind === 'folder') {
        return `folder:${source.folderPath}`;
    }
    return `files:${source.paths.join('|')}`;
}

function normalizeRotationInterval(
    value: unknown
): BackgroundImageRotationInterval {
    return value === 'hourly' ? 'hourly' : 'daily';
}

export function normalizeBackgroundImageCustomSource(
    value: unknown
): BackgroundImageCustomSource | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const entry = value as Record<string, unknown>;
    const kind = entry.kind === 'folder' ? 'folder' : 'files';
    const paths = Array.isArray(entry.paths)
        ? uniquePaths(entry.paths.map((path) => String(path || '')))
        : [];
    const folderPath = String(entry.folderPath || '').trim();

    if (kind === 'folder' && !folderPath) {
        return null;
    }
    if (kind === 'files' && !paths.length) {
        return null;
    }

    return {
        kind,
        paths: kind === 'files' ? paths : [],
        folderPath: kind === 'folder' ? folderPath : '',
        rotationInterval: normalizeRotationInterval(entry.rotationInterval)
    };
}

export function isBackgroundImageCustomSourceRotating(
    source: BackgroundImageCustomSource | null,
    imageCount?: number
): boolean {
    if (!source) {
        return false;
    }
    if (typeof imageCount === 'number') {
        return imageCount > 1;
    }
    return source.kind === 'folder' || source.paths.length > 1;
}

export function createBackgroundImageFilesSource(
    paths: string[],
    rotationInterval: BackgroundImageRotationInterval = 'daily'
): BackgroundImageCustomSource {
    return {
        kind: 'files',
        paths: uniquePaths(paths),
        folderPath: '',
        rotationInterval
    };
}

export function createBackgroundImageFolderSource(
    folderPath: string,
    rotationInterval: BackgroundImageRotationInterval = 'daily'
): BackgroundImageCustomSource {
    return {
        kind: 'folder',
        paths: [],
        folderPath: String(folderPath || '').trim(),
        rotationInterval
    };
}

export async function pickBackgroundImageFiles(
    defaultPath?: string | null
): Promise<string[]> {
    return commands.appOpenBackgroundImageFilesSelectorDialog(
        defaultPath || null
    );
}

async function resolveCustomSourceFiles(
    source: BackgroundImageCustomSource
): Promise<string[]> {
    const input: BackgroundImageFilesResolveInput =
        source.kind === 'folder'
            ? { paths: null, folderPath: source.folderPath }
            : { paths: source.paths, folderPath: null };
    const files = await commands.appBackgroundImageFilesResolve(input);
    return uniquePaths(files);
}

function assertSelectedFilesStillAvailable(
    source: BackgroundImageCustomSource,
    files: string[]
): void {
    if (source.kind !== 'files') {
        return;
    }

    const available = new Set(files.map(pathKey));
    const missing = source.paths.find((path) => !available.has(pathKey(path)));
    if (missing) {
        throw new Error('A selected background image is no longer available.');
    }
}

function assertPreviousImageStillAvailable(
    source: BackgroundImageCustomSource,
    files: string[],
    previousSnapshot?: BackgroundImageSnapshot | null
): void {
    if (
        !previousSnapshot?.imagePath ||
        previousSnapshot.mode !== 'custom' ||
        previousSnapshot.sourceKind !== source.kind
    ) {
        return;
    }

    const available = new Set(files.map(pathKey));
    if (!available.has(pathKey(previousSnapshot.imagePath))) {
        throw new Error('The current background image is no longer available.');
    }
}

export async function resolveBackgroundImageFolderFiles(
    folderPath: string
): Promise<string[]> {
    return commands.appBackgroundImageFilesResolve({
        paths: null,
        folderPath
    });
}

export async function resolveBackgroundImageCustomSnapshot(
    source: BackgroundImageCustomSource,
    previousSnapshot?: BackgroundImageSnapshot | null
): Promise<BackgroundImageSnapshot> {
    const normalizedSource = normalizeBackgroundImageCustomSource(source);
    if (!normalizedSource) {
        throw new Error('No custom image source selected.');
    }

    const files = await resolveCustomSourceFiles(normalizedSource);
    assertSelectedFilesStillAvailable(normalizedSource, files);
    assertPreviousImageStillAvailable(
        normalizedSource,
        files,
        previousSnapshot
    );
    if (!files.length) {
        throw new Error(
            'No supported images were found in the selected source.'
        );
    }

    const key =
        files.length <= 1
            ? 'static'
            : rotationKey(normalizedSource.rotationInterval);
    const index =
        files.length <= 1
            ? 0
            : stableHash(`${sourceHashKey(normalizedSource)}:${key}`) %
              files.length;
    const imagePath = files[index];
    const imageUrl = `${convertFileSrc(imagePath, 'vrcx-0-bg-img')}?v=${encodeURIComponent(
        key
    )}`;

    return {
        mode: 'custom',
        sourceKind: normalizedSource.kind,
        imageUrl,
        imagePath,
        imageCount: files.length,
        title: fileNameFromPath(imagePath),
        author: 'Custom image source',
        license: 'Local file',
        source:
            normalizedSource.kind === 'folder'
                ? normalizedSource.folderPath
                : `${files.length} selected image${files.length === 1 ? '' : 's'}`,
        resolvedAt: new Date().toISOString(),
        resolvedForKey: key
    };
}
