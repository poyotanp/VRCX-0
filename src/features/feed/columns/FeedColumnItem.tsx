import { ArrowRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { FeedTimeDisplayModePreference } from '@/state/preferencesStore';
import { Button } from '@/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/shadcn/tooltip';

import { AvatarInfoLine } from '../components/FeedAvatarInfoLine';
import { formatDifferenceHtml } from '../components/FeedDifferenceHtml';
import { FeedLocationLink } from '../components/FeedLocationLink';
import { FeedStatusBadge } from '../components/FeedStatusBadge';
import { FeedUserAvatarButton, FeedUserLink } from '../components/FeedTableParts';
import type { FeedColumnDensityConfig } from '../feedColumnsDensity';
import { resolveFeedColumnTimeDisplay } from '../feedTimeDisplay';
import type {
    FeedFriendActions,
    FeedLocationActionPayload,
    FeedRow
} from '../feedTypes';

type FeedColumnItemProps = {
    actions: FeedFriendActions;
    animateEntry?: boolean;
    densityConfig: FeedColumnDensityConfig;
    loadingPreviousInstancesKey: string;
    nowMs: number;
    onOpenPreviousInstances(payload?: FeedLocationActionPayload): void;
    row: FeedRow;
    showTypeHint: boolean;
    timeDisplayMode: FeedTimeDisplayModePreference;
};

function FeedColumnDetail({
    actions,
    loadingPreviousInstancesKey,
    onOpenBioDiff,
    onOpenPreviousInstances,
    row
}: FeedColumnItemProps & {
    onOpenBioDiff?(): void;
}) {
    const type = row?.type;

    if (type === 'GPS' || type === 'Online' || type === 'Offline') {
        return (
            <FeedLocationLink
                disableTooltip
                groupName={row?.groupName}
                loadingHistoryKey={loadingPreviousInstancesKey}
                location={row?.location}
                onNewInstance={actions.openFeedNewInstance}
                onOpenPreviousInstances={onOpenPreviousInstances}
                worldName={row?.worldName}
                className="text-xs"
            />
        );
    }

    if (type === 'Status') {
        if (row?.statusDescription === row?.previousStatusDescription) {
            return (
                <span className="flex min-w-0 items-center gap-1.5">
                    <FeedStatusBadge status={row?.previousStatus} />
                    <ArrowRightIcon className="text-muted-foreground size-3.5 shrink-0" />
                    <FeedStatusBadge status={row?.status} />
                </span>
            );
        }

        return (
            <span className="flex min-w-0 items-center gap-1.5">
                <FeedStatusBadge status={row?.status} />
                <span className="min-w-0 truncate">
                    {String(row?.statusDescription || '')}
                </span>
            </span>
        );
    }

    if (type === 'Avatar') {
        return (
            <div className="min-w-0 truncate">
                <AvatarInfoLine
                    avatarName={row?.avatarName}
                    avatarTags={row?.currentAvatarTags}
                    compact
                    imageUrl={row?.currentAvatarImageUrl}
                    ownerId={row?.ownerId}
                    showTags={false}
                    userId={row?.userId}
                />
            </div>
        );
    }

    if (type === 'Bio') {
        return (
            <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground h-auto w-full min-w-0 justify-start p-0 text-left text-xs font-normal"
                onClick={onOpenBioDiff}
            >
                <span className="block min-w-0 truncate">
                    {String(row?.bio || '')}
                </span>
            </Button>
        );
    }

    return (
        <span className="block min-w-0 truncate">
            {String(row?.message || '')}
        </span>
    );
}

function FeedColumnTypeHint({
    type,
    typeLabel
}: {
    type: string;
    typeLabel: string;
}) {
    return (
        <span
            className="bg-muted/70 text-muted-foreground ring-border/40 max-w-24 shrink-0 truncate rounded-sm px-1.5 py-0 text-[10px] leading-4 font-medium ring-1"
            title={typeLabel || type}
        >
            {typeLabel || type}
        </span>
    );
}

function FeedColumnTime({
    label,
    title
}: {
    label: string;
    title: string;
}) {
    return (
        <div className="ml-auto flex shrink-0 items-center">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                        {label}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{title}</TooltipContent>
            </Tooltip>
        </div>
    );
}

export function FeedColumnItem(props: FeedColumnItemProps) {
    const {
        animateEntry = false,
        densityConfig,
        nowMs,
        row,
        showTypeHint,
        timeDisplayMode
    } = props;
    const { t } = useTranslation();
    const [bioDiffOpen, setBioDiffOpen] = useState(false);
    const type = String(row?.type || '');
    const typeLabel = type ? t(`view.feed.filters.${type}`) : '';
    const showAvatar = densityConfig.showAvatar;
    const bioDiffHtml = useMemo(
        () => formatDifferenceHtml(row?.previousBio, row?.bio),
        [row?.bio, row?.previousBio]
    );
    const time = resolveFeedColumnTimeDisplay({
        mode: timeDisplayMode,
        nowMs,
        t,
        value: row?.created_at
    });

    return (
        <>
            <div
                className={cn(
                    'border-border/35 hover:bg-accent/20 group/feed-column-item flex min-w-0 items-start border-b bg-background/20 transition-colors',
                    animateEntry && 'feed-column-row-new',
                    densityConfig.rowPaddingClassName
                )}
                style={{ height: densityConfig.rowHeight }}
            >
                <div
                    className={cn(
                        'min-w-0 flex-1',
                        showAvatar
                            ? 'grid grid-cols-[auto_minmax(0,1fr)]'
                            : 'flex flex-col',
                        densityConfig.itemClassName
                    )}
                >
                    {showAvatar ? (
                        <FeedUserAvatarButton
                            avatarSize={densityConfig.avatarSize}
                            className={densityConfig.avatarClassName}
                            row={row}
                        />
                    ) : null}
                    <div
                        className={cn(
                            'flex min-w-0 flex-col',
                            densityConfig.contentGapClassName
                        )}
                    >
                        <div
                            className={cn(
                                'flex min-w-0 items-center',
                                densityConfig.topRowGapClassName
                            )}
                        >
                            <FeedUserLink
                                actions={props.actions}
                                className={cn(
                                    'min-w-0 flex-1 px-0 py-0',
                                    densityConfig.userLinkClassName
                                )}
                                row={row}
                            />
                            {showTypeHint && type ? (
                                <FeedColumnTypeHint
                                    type={type}
                                    typeLabel={typeLabel}
                                />
                            ) : null}
                            <FeedColumnTime
                                label={time.label}
                                title={time.title}
                            />
                        </div>
                        <div
                            className={cn(
                                'text-muted-foreground min-w-0 truncate',
                                densityConfig.detailClassName
                            )}
                        >
                            <FeedColumnDetail
                                {...props}
                                onOpenBioDiff={() => setBioDiffOpen(true)}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {type === 'Bio' ? (
                <Dialog open={bioDiffOpen} onOpenChange={setBioDiffOpen}>
                    <DialogContent className="w-[min(92vw,42rem)] sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {t('view.feed.columns.bio_diff')}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="bg-muted/20 max-h-[60vh] overflow-auto rounded-md border p-3">
                            <pre
                                className="font-inherit text-xs leading-5 whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{
                                    __html: bioDiffHtml
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            ) : null}
        </>
    );
}
