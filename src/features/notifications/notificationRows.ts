import type {
    NotificationResponse,
    NotificationRow
} from '@/repositories/notificationPersistenceRepository';
import { convertFileUrlToImageUrl } from '@/services/entityMediaService';
import { HOUR_MS, MINUTE_MS } from '@/shared/constants/time';
import { hasGroupIdPrefix } from '@/shared/constants/vrchatIds';
import { parseLocation } from '@/shared/utils/location';
export { resolveCurrentInviteLocation } from '@/shared/utils/invite';

type FileImageLike = {
    versions?: { file?: { url?: string | null } | null }[] | null;
    url?: string | null;
    imageUrl?: string | null;
};
type CachedInstanceLike = Record<string, unknown> & {
    closedAt?: unknown;
    instance?: CachedInstanceLike;
    instanceId?: string;
    location?: string;
};
type InviteMessageRow = Record<string, unknown> & {
    message: string;
    messageType: string;
    slot: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function getNotificationCreatedAt(notification: NotificationRow) {
    return notification?.createdAt || notification?.created_at || '';
}

export function getNotificationMessage(notification: NotificationRow): string {
    const generatedInviteMessage = notification.details?.worldName
        ? `This is a generated invite to ${notification.details.worldName}`
        : '';
    const message =
        notification.message === generatedInviteMessage
            ? ''
            : notification.message;
    return [
        notification.title,
        message,
        notification.details?.inviteMessage,
        notification.details?.requestMessage,
        notification.details?.responseMessage
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(notification.title && notification.message ? ', ' : ' ');
}

export function getNotificationGroupLabel(
    notification: NotificationRow,
    includeLinkText = false
): string {
    return (
        notification.data?.groupName ||
        notification.details?.groupName ||
        notification.groupName ||
        (includeLinkText ? notification.linkText : '') ||
        ''
    );
}

export function getNotificationGroupColumnLabel(
    notification: NotificationRow
): string {
    const isGroupLink =
        notification?.link?.startsWith('group:') ||
        notification?.link?.startsWith('event:');
    const explicitGroupLabel = getNotificationGroupLabel(
        notification,
        isGroupLink
    );
    if (
        hasGroupIdPrefix(notification?.senderUserId) ||
        notification?.type === 'groupChange'
    ) {
        return notification?.senderUsername || explicitGroupLabel || '';
    }
    return explicitGroupLabel;
}

export function getNotificationSenderLabel(notification: NotificationRow) {
    return (
        notification?.senderDisplayName ||
        notification?.details?.senderDisplayName ||
        notification?.data?.senderDisplayName ||
        notification?.senderUsername ||
        notification?.senderUserId ||
        ''
    );
}

export function matchesNotificationSearch(
    notification: NotificationRow,
    search: unknown
): boolean {
    const query = String(search || '')
        .trim()
        .toLowerCase();
    if (!query) {
        return true;
    }

    return [
        notification.type,
        notification.senderDisplayName,
        notification.senderUsername,
        notification.senderUserId,
        notification.title,
        notification.message,
        notification.linkText,
        notification.link,
        notification.details?.worldName,
        notification.details?.worldId,
        notification.details?.inviteMessage,
        notification.details?.requestMessage,
        notification.details?.responseMessage,
        notification.data?.groupName
    ].some((value) =>
        String(value || '')
            .toLowerCase()
            .includes(query)
    );
}

export function filterNotificationRows(
    rows: readonly NotificationRow[] | null | undefined,
    filters: readonly string[] | null | undefined,
    search: unknown
): NotificationRow[] {
    const activeFilters = Array.isArray(filters) ? filters : [];
    const inputRows = Array.isArray(rows) ? rows : [];
    return inputRows.filter((notification) => {
        if (
            activeFilters.length &&
            !activeFilters.includes(String(notification.type || ''))
        ) {
            return false;
        }
        return matchesNotificationSearch(notification, search);
    });
}

export function normalizeWorldTarget(value: unknown): string {
    const text =
        typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return parseLocation(text).worldId || text.split(':')[0] || text;
}

export function canDeclineNotification(
    notification: NotificationRow | null | undefined
): boolean {
    const type = notification?.type || '';
    const link = notification?.link || '';
    return (
        type !== 'requestInviteResponse' &&
        type !== 'inviteResponse' &&
        type !== 'message' &&
        type !== 'boop' &&
        type !== 'groupChange' &&
        !type.includes('group.') &&
        !type.includes('moderation.') &&
        !type.includes('instance.') &&
        !link.startsWith('economy.')
    );
}

export function getResponseLabel(response?: NotificationResponse | null) {
    return response?.text || response?.type || 'Respond';
}

export function getFileImageUrl(file: FileImageLike | null | undefined) {
    const versions = Array.isArray(file?.versions) ? file.versions : [];
    const version = versions.at(-1);
    const url = version?.file?.url || file?.url || file?.imageUrl || '';
    return url ? convertFileUrlToImageUrl(url, 128) : '';
}

export function getCachedInstanceLocation(instance: unknown) {
    if (!isRecord(instance)) {
        return '';
    }
    const nestedInstance = isRecord(instance.instance)
        ? instance.instance
        : null;
    return String(
        instance.location ||
            nestedInstance?.location ||
            instance.instanceId ||
            ''
    ).trim();
}

export function buildCachedInstanceMap(
    instances: readonly unknown[] | null | undefined
) {
    const map = new Map<string, CachedInstanceLike>();
    for (const instance of Array.isArray(instances) ? instances : []) {
        if (!isRecord(instance)) {
            continue;
        }
        const location = getCachedInstanceLocation(instance);
        if (location) {
            const nestedInstance = isRecord(instance.instance)
                ? instance.instance
                : null;
            map.set(location, nestedInstance || instance);
        }
    }
    return map;
}

function getInviteMessageSourceRows(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        return value.filter(isRecord);
    }
    if (!isRecord(value)) {
        return [];
    }
    if (Array.isArray(value.messages)) {
        return value.messages.filter(isRecord);
    }
    return Object.values(value).filter(isRecord);
}

export function normalizeInviteMessageRows(
    value: unknown,
    messageType: string
): InviteMessageRow[] {
    const rows = getInviteMessageSourceRows(value);

    return rows
        .map((row, index) => ({
            ...row,
            slot: Number.parseInt(String(row.slot ?? index), 10),
            message: String(row?.message || row?.text || ''),
            messageType
        }))
        .filter((row) => Number.isFinite(row.slot))
        .sort((left, right) => left.slot - right.slot);
}

export function getInviteCooldownLabel(updatedAt: unknown, nowMs: unknown) {
    if (!updatedAt) {
        return '';
    }
    const updatedTime =
        typeof updatedAt === 'string' ||
        typeof updatedAt === 'number' ||
        updatedAt instanceof Date
            ? new Date(updatedAt).getTime()
            : Number.NaN;
    if (!Number.isFinite(updatedTime)) {
        return String(updatedAt);
    }
    const remainingMs = updatedTime + HOUR_MS - Number(nowMs);
    if (remainingMs <= 0) {
        return '';
    }
    const minutes = Math.ceil(remainingMs / MINUTE_MS);
    return minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`;
}
