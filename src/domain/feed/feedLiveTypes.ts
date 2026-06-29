export type FeedLiveEntryPayload = Record<string, unknown> & {
    id?: unknown;
    rowId?: unknown;
    row_id?: unknown;
    sourceRank?: unknown;
    source_rank?: unknown;
    type?: unknown;
    created_at?: unknown;
    createdAt?: unknown;
    userId?: unknown;
    senderUserId?: unknown;
    ownerUserId?: unknown;
    displayName?: unknown;
    details?: unknown;
    location?: unknown;
    message?: unknown;
    groupName?: unknown;
    previousLocation?: unknown;
    time?: unknown;
    worldId?: unknown;
    worldName?: unknown;
    displayLocation?: unknown;
    avatarName?: unknown;
    currentAvatarImageUrl?: unknown;
    currentAvatarTags?: unknown;
    currentAvatarThumbnailImageUrl?: unknown;
    ownerId?: unknown;
    previousAvatarName?: unknown;
    previousCurrentAvatarImageUrl?: unknown;
    previousCurrentAvatarTags?: unknown;
    previousCurrentAvatarThumbnailImageUrl?: unknown;
    previousOwnerId?: unknown;
};

export type FeedLiveAvatarEntryPayload = FeedLiveEntryPayload & {
    type?: 'Avatar' | string;
    avatarName?: string;
    created_at?: string;
    currentAvatarImageUrl?: string;
    currentAvatarTags?: string[];
    currentAvatarThumbnailImageUrl?: string;
    displayName?: string;
    ownerId?: string;
    previousAvatarName?: string;
    previousCurrentAvatarImageUrl?: string;
    previousCurrentAvatarTags?: string[];
    previousCurrentAvatarThumbnailImageUrl?: string;
    previousOwnerId?: string;
    userId?: string;
};

export type FeedLiveLocationEntryPayload = FeedLiveEntryPayload & {
    type?: 'GPS' | string;
    created_at?: string;
    displayLocation?: string;
    displayName?: string;
    groupName?: string;
    location?: string;
    previousLocation?: string;
    time?: string;
    userId?: string;
    worldId?: string;
    worldName?: string;
};

export type FeedLiveEntry = {
    sequence: number;
    ownerUserId?: string;
    entry: FeedLiveEntryPayload;
};

export type FeedEntryPatchInput = Record<string, unknown> & {
    displayName?: unknown;
    worldName?: unknown;
    displayLocation?: unknown;
};

export type FeedEntryPatch = Partial<{
    displayName: string;
    worldName: string;
    displayLocation: string;
}>;
