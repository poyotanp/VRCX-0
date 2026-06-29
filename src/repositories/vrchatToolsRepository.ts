import {
    entityQueryPolicies,
    fetchCachedData,
    invalidateEntityQueries,
    queryKeys
} from '@/lib/entityQueryCache';
import { commands } from '@/platform/tauri/bindings';

import {
    createRequestError,
    notifyVrchatAuthFailure,
    parseJsonResponse,
    type QueryParams,
    unwrapErrorMessage
} from './vrchatRequest';

const PAGE_SIZE = 100;

type PageParams = {
    offset: number;
    n: number;
};
type PageResponse<TRow = unknown> = {
    results?: TRow[];
    json?: TRow[];
    hasNext?: boolean;
    nextCursor?: string;
    totalCount?: number;
};
type CalendarListParams = QueryParams & {
    n?: number;
};
type RepositoryOptions = {
    endpoint?: string;
    force?: boolean;
};
type GroupCalendarIdentity = {
    groupId: string;
};
type GroupCalendarEventIdentity = GroupCalendarIdentity & {
    eventId: string;
};
export type GroupCalendarGroupRecord = Record<string, unknown> & {
    id?: string;
    name?: string;
};
export type GroupCalendarEventRecord = Record<string, unknown> & {
    accessType?: string;
    category?: string;
    closeAfterEndMinutes?: number;
    closeInstanceAfterEndMinutes?: number;
    createdAt?: string;
    deletedAt?: string | null;
    description?: string;
    durationInMs?: number;
    endsAt?: string;
    eventId?: string;
    featured?: boolean;
    group?: GroupCalendarGroupRecord;
    groupId?: string;
    guestEarlyJoinMinutes?: number;
    hostEarlyJoinMinutes?: number;
    id?: string;
    imageId?: string;
    imageUrl?: string;
    interestedUserCount?: number;
    isDraft?: boolean;
    languages?: string[];
    occurrenceKind?: string;
    ownerId?: string;
    platforms?: string[];
    startsAt?: string;
    thumbnailImageUrl?: string;
    title?: string;
    userInterest?: Record<string, unknown>;
};
type GroupCalendarListResponse = PageResponse<GroupCalendarEventRecord>;
export type InviteMessageRecord = Record<string, unknown> & {
    canBeUpdated?: boolean;
    id?: string;
    message?: string;
    messageType?: string;
    remainingCooldownMinutes?: number;
    slot?: number;
    updatedAt?: string;
};
type InviteMessagesRecord = InviteMessageRecord[];
type VrchatApiResult = {
    status: number;
    data: unknown;
    raw: unknown;
};

async function processAllPages<TRow = unknown>(
    fetchPage: (params: PageParams) => Promise<PageResponse<TRow> | TRow[]>,
    { pageSize = PAGE_SIZE }: { pageSize?: number } = {}
): Promise<TRow[]> {
    const results: TRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
        const page = await fetchPage({ offset, n: pageSize });
        const rows = Array.isArray(page)
            ? page
            : Array.isArray(page?.results)
              ? page.results
              : Array.isArray(page?.json)
                ? page.json
                : [];
        const pageInfo = Array.isArray(page) ? null : page;
        results.push(...rows);
        if (
            rows.length === 0 ||
            pageInfo?.hasNext === false ||
            rows.length < pageSize
        ) {
            break;
        }
    }
    return results;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object');
}

function unwrapVrchatToolsResponse<TJson = Record<string, unknown>>(
    response: VrchatApiResult,
    path: string
) {
    const json = parseJsonResponse(response.data);
    if (response.status >= 400 || (isRecord(json) && 'error' in json)) {
        const requestError = createRequestError(
            unwrapErrorMessage(json, response.status, {
                fallbackMessage: 'VRChat tool request failed'
            }),
            response.status,
            path,
            json
        );
        notifyVrchatAuthFailure(requestError);
        throw new Error(requestError.message);
    }

    return {
        json: json as TJson,
        status: response.status,
        raw: response.raw
    };
}

async function getGroupCalendars(
    params: CalendarListParams = {},
    { endpoint = '', force = false }: RepositoryOptions = {}
) {
    return fetchCachedData({
        queryKey: queryKeys.groupCalendarList('all', params, endpoint),
        policy: entityQueryPolicies.groupCollection,
        force,
        queryFn: async () => {
            const response = await commands.appVrchatToolsCalendarsGet({
                endpoint,
                params
            });
            return unwrapVrchatToolsResponse<GroupCalendarListResponse>(
                response,
                'calendar'
            ).json;
        }
    });
}

async function getGroupCalendar(
    { groupId }: GroupCalendarIdentity,
    { endpoint = '', force = false }: RepositoryOptions = {}
) {
    return fetchCachedData({
        queryKey: queryKeys.groupCalendarList('group', { groupId }, endpoint),
        policy: entityQueryPolicies.groupCollection,
        force,
        queryFn: async () => {
            const response = await commands.appVrchatToolsGroupCalendarGet({
                endpoint,
                groupId
            });
            return unwrapVrchatToolsResponse<GroupCalendarListResponse>(
                response,
                `calendar/${encodeURIComponent(groupId)}`
            ).json;
        }
    });
}

async function getFollowingGroupCalendars(
    params: CalendarListParams = {},
    { endpoint = '', force = false }: RepositoryOptions = {}
) {
    return fetchCachedData({
        queryKey: queryKeys.groupCalendarList('following', params, endpoint),
        policy: entityQueryPolicies.groupCollection,
        force,
        queryFn: async () => {
            const response = await commands.appVrchatToolsFollowingCalendarsGet(
                {
                    endpoint,
                    params
                }
            );
            return unwrapVrchatToolsResponse<GroupCalendarListResponse>(
                response,
                'calendar/following'
            ).json;
        }
    });
}

async function getFeaturedGroupCalendars(
    params: CalendarListParams = {},
    { endpoint = '', force = false }: RepositoryOptions = {}
) {
    return fetchCachedData({
        queryKey: queryKeys.groupCalendarList('featured', params, endpoint),
        policy: entityQueryPolicies.groupCollection,
        force,
        queryFn: async () => {
            const response = await commands.appVrchatToolsFeaturedCalendarsGet({
                endpoint,
                params
            });
            return unwrapVrchatToolsResponse<GroupCalendarListResponse>(
                response,
                'calendar/featured'
            ).json;
        }
    });
}

async function getAllGroupCalendars(
    params: CalendarListParams = {},
    options: RepositoryOptions = {}
) {
    return processAllPages<GroupCalendarEventRecord>(
        (pageParams: PageParams) =>
            getGroupCalendars({ ...params, ...pageParams }, options),
        { pageSize: params.n ?? PAGE_SIZE }
    );
}

async function getAllFollowingGroupCalendars(
    params: CalendarListParams = {},
    options: RepositoryOptions = {}
) {
    return processAllPages<GroupCalendarEventRecord>(
        (pageParams: PageParams) =>
            getFollowingGroupCalendars({ ...params, ...pageParams }, options),
        { pageSize: params.n ?? PAGE_SIZE }
    );
}

async function getAllFeaturedGroupCalendars(
    params: CalendarListParams = {},
    options: RepositoryOptions = {}
) {
    return processAllPages<GroupCalendarEventRecord>(
        (pageParams: PageParams) =>
            getFeaturedGroupCalendars({ ...params, ...pageParams }, options),
        { pageSize: params.n ?? PAGE_SIZE }
    );
}

async function followGroupEvent(
    {
        groupId,
        eventId,
        isFollowing
    }: GroupCalendarEventIdentity & { isFollowing: boolean },
    { endpoint = '' }: RepositoryOptions = {}
) {
    const response = await commands.appVrchatToolsGroupEventFollow({
        endpoint,
        groupId,
        eventId,
        isFollowing: Boolean(isFollowing)
    });
    invalidateEntityQueries(['calendar']);
    return unwrapVrchatToolsResponse<GroupCalendarEventRecord>(
        response,
        `calendar/${encodeURIComponent(groupId)}/${encodeURIComponent(eventId)}/follow`
    ).json;
}

async function getGroupCalendarIcs(
    { groupId, eventId }: GroupCalendarEventIdentity,
    { endpoint = '', force = false }: RepositoryOptions = {}
) {
    return fetchCachedData({
        queryKey: queryKeys.groupCalendarEvent({ groupId, eventId }, endpoint),
        policy: entityQueryPolicies.groupCalendarEvent,
        force,
        queryFn: async () => {
            const response = await commands.appVrchatToolsGroupCalendarIcsGet({
                endpoint,
                groupId,
                eventId
            });
            return unwrapVrchatToolsResponse<string>(
                response,
                `calendar/${encodeURIComponent(groupId)}/${encodeURIComponent(eventId)}.ics`
            ).json;
        }
    });
}

async function saveUserNote(
    { targetUserId, note }: { targetUserId: string; note: string },
    { endpoint = '' }: RepositoryOptions = {}
) {
    const response = await commands.appVrchatToolsUserNoteSave({
        endpoint,
        targetUserId,
        note
    });
    return unwrapVrchatToolsResponse(response, 'userNotes').json;
}

async function reportUser(
    {
        userId,
        contentType = 'user',
        reason,
        type = 'report'
    }: {
        userId: string;
        contentType?: string;
        reason: string;
        type?: string;
    },
    { endpoint = '' }: RepositoryOptions = {}
) {
    const response = await commands.appVrchatToolsUserReport({
        endpoint,
        userId,
        contentType,
        reason,
        type
    });
    return unwrapVrchatToolsResponse(
        response,
        `feedback/${encodeURIComponent(userId)}/user`
    ).json;
}

async function getInviteMessages(
    {
        currentUserId,
        messageType
    }: { currentUserId: string; messageType: string },
    { endpoint = '' }: RepositoryOptions = {}
) {
    const response = await commands.appVrchatToolsInviteMessagesGet({
        endpoint,
        currentUserId,
        messageType
    });
    return unwrapVrchatToolsResponse<InviteMessagesRecord>(
        response,
        `message/${encodeURIComponent(currentUserId)}/${encodeURIComponent(messageType)}`
    ).json;
}

async function editInviteMessage(
    {
        currentUserId,
        messageType,
        slot,
        message
    }: {
        currentUserId: string;
        messageType: string;
        slot: number | string;
        message: string;
    },
    { endpoint = '' }: RepositoryOptions = {}
) {
    const response = await commands.appVrchatToolsInviteMessageEdit({
        endpoint,
        currentUserId,
        messageType,
        slot: String(slot),
        message
    });
    return unwrapVrchatToolsResponse<InviteMessagesRecord>(
        response,
        `message/${encodeURIComponent(currentUserId)}/${encodeURIComponent(messageType)}/${encodeURIComponent(slot)}`
    ).json;
}

const vrchatToolsRepository = Object.freeze({
    getGroupCalendar,
    getGroupCalendars,
    getFollowingGroupCalendars,
    getFeaturedGroupCalendars,
    getAllGroupCalendars,
    getAllFollowingGroupCalendars,
    getAllFeaturedGroupCalendars,
    followGroupEvent,
    getGroupCalendarIcs,
    saveUserNote,
    reportUser,
    getInviteMessages,
    editInviteMessage
});

export {
    getGroupCalendar,
    getGroupCalendars,
    getFollowingGroupCalendars,
    getFeaturedGroupCalendars,
    getAllGroupCalendars,
    getAllFollowingGroupCalendars,
    getAllFeaturedGroupCalendars,
    followGroupEvent,
    getGroupCalendarIcs,
    saveUserNote,
    reportUser,
    getInviteMessages,
    editInviteMessage
};
export default vrchatToolsRepository;
