import { RefreshCwIcon, SproutIcon, TractorIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import configRepository from '@/repositories/configRepository';
import worldProfileRepository from '@/repositories/worldProfileRepository';
import { getResolvedThemeMode } from '@/services/themeService';
import { userActivityViewService } from '@/services/userActivityViewService';
import { parseLocation } from '@/shared/utils/locationParser';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useShellStore } from '@/state/shellStore';
import { Alert, AlertDescription } from '@/ui/shadcn/alert';
import { Button } from '@/ui/shadcn/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/ui/shadcn/select';
import { Spinner } from '@/ui/shadcn/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/shadcn/tooltip';

import {
    ActivityEmptyState,
    getWorldThumbnailUrl,
    HeatmapChart
} from './user-dialog/components/UserActivityPanelParts';
import {
    UserActivityOverlapSection,
    UserActivityTopWorldsSection
} from './user-dialog/components/UserActivityPanelSections';
import {
    ACTIVITY_FRIEND_PERIOD_KEY,
    ACTIVITY_SELF_EXCLUDE_HOME_WORLD_KEY,
    ACTIVITY_SELF_PERIOD_KEY,
    ACTIVITY_SELF_TOP_WORLDS_SORT_KEY,
    getDisplayDayLabels,
    getRangeDays,
    normalizeActivityPeriod,
    normalizeTopWorldsSort,
    OVERLAP_EXCLUDE_ENABLED_KEY,
    OVERLAP_EXCLUDE_END_KEY,
    OVERLAP_EXCLUDE_START_KEY,
    OVERLAP_LOADING_DELAY,
    TOP_WORLDS_LOADING_DELAY,
    USER_ACTIVITY_HOUR_LABELS
} from './user-dialog/userActivityPanelModel';

export {
    getDisplayDayLabels,
    getRangeDays
} from './user-dialog/userActivityPanelModel';

export function UserActivityPanel({
    profile,
    isCurrentUser,
    active = false
}: any) {
    const { t } = useTranslation();
    const locale = useShellStore((state: any) => state.locale);
    const currentUserId = useRuntimeStore(
        (state: any) => state.auth.currentUserId
    );
    const currentUserSnapshot = useRuntimeStore(
        (state: any) => state.auth.currentUserSnapshot
    );
    const weekStartsOn = usePreferencesStore(
        (state: any) => state.weekStartsOn
    );
    const themeMode = useShellStore((state: any) => state.themeMode);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('30');
    const [hasAnyData, setHasAnyData] = useState(false);
    const [filteredEventCount, setFilteredEventCount] = useState(0);
    const [peakDayText, setPeakDayText] = useState('');
    const [peakTimeText, setPeakTimeText] = useState('');
    const [mainHeatmap, setMainHeatmap] = useState<any>({
        rawBuckets: [],
        normalizedBuckets: []
    });
    const [topWorlds, setTopWorlds] = useState<any[]>([]);
    const [topWorldsLoading, setTopWorldsLoading] = useState(false);
    const [topWorldsLoadingVisible, setTopWorldsLoadingVisible] =
        useState(false);
    const [topWorldsSortBy, setTopWorldsSortBy] = useState('time');
    const [excludeHomeWorldEnabled, setExcludeHomeWorldEnabled] =
        useState(false);
    const [overlapLoading, setOverlapLoading] = useState(false);
    const [overlapLoadingVisible, setOverlapLoadingVisible] = useState(false);
    const [hasOverlapData, setHasOverlapData] = useState(false);
    const [overlapPercent, setOverlapPercent] = useState(0);
    const [bestOverlapTime, setBestOverlapTime] = useState('');
    const [overlapHeatmap, setOverlapHeatmap] = useState<any>({
        rawBuckets: [],
        normalizedBuckets: []
    });
    const [excludeHoursEnabled, setExcludeHoursEnabled] = useState(false);
    const [excludeStartHour, setExcludeStartHour] = useState('1');
    const [excludeEndHour, setExcludeEndHour] = useState('6');
    const activityRequestIdRef = useRef(0);
    const overlapRequestIdRef = useRef(0);
    const topWorldRequestIdRef = useRef(0);
    const topWorldsLoadingTimerRef = useRef(null);
    const overlapLoadingTimerRef = useRef(null);
    const easterEggTimerRef = useRef(null);
    const pendingWorldThumbnailFetchesRef = useRef(new Set());
    const lastLoadedContextRef = useRef('');
    const userId = profile?.id || '';
    const activityContextKey = `${currentUserId || ''}:${isCurrentUser ? 'self' : 'friend'}:${userId}`;
    const isDarkMode = getResolvedThemeMode(themeMode) === 'dark';
    const dayLabels = useMemo(
        () => [
            t('dialog.user.activity.days.sun'),
            t('dialog.user.activity.days.mon'),
            t('dialog.user.activity.days.tue'),
            t('dialog.user.activity.days.wed'),
            t('dialog.user.activity.days.thu'),
            t('dialog.user.activity.days.fri'),
            t('dialog.user.activity.days.sat')
        ],
        [locale, t]
    );
    const currentHomeLocation = currentUserSnapshot?.homeLocation || '';
    const currentHomeWorldId =
        parseLocation(currentHomeLocation).worldId || currentHomeLocation;
    const displayDayLabels = useMemo(
        () => getDisplayDayLabels(dayLabels, weekStartsOn),
        [dayLabels, weekStartsOn]
    );

    function clearTopWorldsLoadingTimer() {
        if (topWorldsLoadingTimerRef.current !== null) {
            clearTimeout(topWorldsLoadingTimerRef.current);
            topWorldsLoadingTimerRef.current = null;
        }
    }

    function clearOverlapLoadingTimer() {
        if (overlapLoadingTimerRef.current !== null) {
            clearTimeout(overlapLoadingTimerRef.current);
            overlapLoadingTimerRef.current = null;
        }
    }

    function beginTopWorldsLoading(requestId: any) {
        setTopWorldsLoading(true);
        setTopWorldsLoadingVisible(false);
        clearTopWorldsLoadingTimer();
        topWorldsLoadingTimerRef.current = setTimeout(() => {
            topWorldsLoadingTimerRef.current = null;
            if (requestId === topWorldRequestIdRef.current) {
                setTopWorldsLoadingVisible(true);
            }
        }, TOP_WORLDS_LOADING_DELAY);
    }

    function finishTopWorldsLoading(requestId: any) {
        if (requestId !== topWorldRequestIdRef.current) {
            return;
        }
        clearTopWorldsLoadingTimer();
        setTopWorldsLoading(false);
        setTopWorldsLoadingVisible(false);
    }

    function beginOverlapLoading(requestId: any) {
        setOverlapLoading(true);
        setOverlapLoadingVisible(false);
        clearOverlapLoadingTimer();
        overlapLoadingTimerRef.current = setTimeout(() => {
            overlapLoadingTimerRef.current = null;
            if (requestId === overlapRequestIdRef.current) {
                setOverlapLoadingVisible(true);
            }
        }, OVERLAP_LOADING_DELAY);
    }

    function finishOverlapLoading(requestId: any) {
        if (requestId !== overlapRequestIdRef.current) {
            return;
        }
        clearOverlapLoadingTimer();
        setOverlapLoading(false);
        setOverlapLoadingVisible(false);
    }

    function resetActivityState() {
        clearTopWorldsLoadingTimer();
        clearOverlapLoadingTimer();
        topWorldRequestIdRef.current += 1;
        overlapRequestIdRef.current += 1;
        setLoading(false);
        setError('');
        setSelectedPeriod('30');
        setHasAnyData(false);
        setFilteredEventCount(0);
        setPeakDayText('');
        setPeakTimeText('');
        setMainHeatmap({ rawBuckets: [], normalizedBuckets: [] });
        setTopWorlds([]);
        setTopWorldsLoading(false);
        setTopWorldsLoadingVisible(false);
        setTopWorldsSortBy('time');
        setHasOverlapData(false);
        setOverlapPercent(0);
        setBestOverlapTime('');
        setOverlapHeatmap({ rawBuckets: [], normalizedBuckets: [] });
        setOverlapLoading(false);
        setOverlapLoadingVisible(false);
    }

    async function fetchMissingTopWorldThumbnails(worlds: any) {
        const pendingWorldThumbnailFetches =
            pendingWorldThumbnailFetchesRef.current;
        const missingWorlds = worlds.filter((world: any) => {
            if (
                !world.worldId ||
                getWorldThumbnailUrl(world) ||
                pendingWorldThumbnailFetches.has(world.worldId)
            ) {
                return false;
            }
            pendingWorldThumbnailFetches.add(world.worldId);
            return true;
        });
        if (!missingWorlds.length) {
            return;
        }

        let results = [];
        try {
            results = await Promise.allSettled(
                missingWorlds.map((world: any) =>
                    worldProfileRepository.getWorldProfile({
                        worldId: world.worldId
                    })
                )
            );
        } finally {
            for (const world of missingWorlds) {
                pendingWorldThumbnailFetches.delete(world.worldId);
            }
        }
        const profileByWorldId = new Map();
        results.forEach((result: any, index: any) => {
            if (result.status === 'fulfilled' && result.value?.id) {
                profileByWorldId.set(
                    missingWorlds[index].worldId,
                    result.value
                );
            }
        });
        if (!profileByWorldId.size) {
            return;
        }

        setTopWorlds((currentRows: any) =>
            currentRows.map((world: any) => {
                const profileWorld = profileByWorldId.get(world.worldId);
                if (!profileWorld) {
                    return world;
                }
                return {
                    ...world,
                    worldName: profileWorld.name || world.worldName,
                    imageUrl: profileWorld.imageUrl || world.imageUrl || '',
                    thumbnailImageUrl:
                        profileWorld.thumbnailImageUrl ||
                        world.thumbnailImageUrl ||
                        ''
                };
            })
        );
    }

    async function loadTopWorlds({
        rangeDays,
        sortBy,
        excludeHomeWorld,
        requestId
    }: any) {
        if (!isCurrentUser || !userId) {
            return;
        }
        const topWorldRequestId = ++topWorldRequestIdRef.current;
        beginTopWorldsLoading(topWorldRequestId);
        try {
            const rows = await userActivityViewService.loadTopWorldsView({
                rangeDays,
                limit: 5,
                sortBy,
                excludeWorldId: excludeHomeWorld ? currentHomeWorldId : ''
            });
            if (
                requestId !== activityRequestIdRef.current ||
                topWorldRequestId !== topWorldRequestIdRef.current
            ) {
                return;
            }
            setTopWorlds(rows);
            fetchMissingTopWorldThumbnails(rows);
        } finally {
            finishTopWorldsLoading(topWorldRequestId);
        }
    }

    function applyOverlapView(overlapView: any) {
        setHasOverlapData(overlapView.hasOverlapData);
        setOverlapPercent(overlapView.overlapPercent || 0);
        setBestOverlapTime(overlapView.bestOverlapTime || '');
        setOverlapHeatmap({
            rawBuckets: overlapView.rawBuckets || [],
            normalizedBuckets: overlapView.normalizedBuckets || []
        });
    }

    async function refreshTopWorldsOnly({
        sortBy = topWorldsSortBy,
        excludeHomeWorld = excludeHomeWorldEnabled,
        period = selectedPeriod
    }: any = {}) {
        if (!active || !isCurrentUser || !hasAnyData || !userId) {
            return;
        }
        await loadTopWorlds({
            rangeDays: getRangeDays(period),
            sortBy,
            excludeHomeWorld,
            requestId: activityRequestIdRef.current
        });
    }

    async function refreshOverlapOnly({
        excludeOverlap = excludeHoursEnabled,
        excludeStart = excludeStartHour,
        excludeEnd = excludeEndHour
    }: any = {}) {
        if (
            !active ||
            isCurrentUser ||
            !hasAnyData ||
            !currentUserId ||
            !userId
        ) {
            return;
        }

        const requestId = ++overlapRequestIdRef.current;
        beginOverlapLoading(requestId);
        try {
            const overlapView = await userActivityViewService.loadOverlapView({
                currentUserId,
                targetUserId: userId,
                ownerUserId: currentUserId,
                rangeDays: getRangeDays(selectedPeriod),
                dayLabels,
                forceRefresh: false,
                excludeHours: {
                    enabled: excludeOverlap,
                    startHour: Number.parseInt(excludeStart, 10),
                    endHour: Number.parseInt(excludeEnd, 10)
                }
            });
            if (requestId !== overlapRequestIdRef.current) {
                return;
            }
            applyOverlapView(overlapView);
        } catch (nextError) {
            if (requestId !== overlapRequestIdRef.current) {
                return;
            }
            const message =
                nextError instanceof Error
                    ? nextError.message
                    : t(
                          'dialog.user.activity.failed_to_load',
                          'Failed to load activity.'
                      );
            toast.error(message);
        } finally {
            finishOverlapLoading(requestId);
        }
    }

    async function refreshData({
        forceRefresh = false,
        period = selectedPeriod,
        sortBy = topWorldsSortBy,
        excludeHomeWorld = excludeHomeWorldEnabled,
        excludeOverlap = excludeHoursEnabled,
        excludeStart = excludeStartHour,
        excludeEnd = excludeEndHour
    }: any = {}) {
        if (!active || !userId) {
            return;
        }

        const requestId = ++activityRequestIdRef.current;
        const overlapRequestId = ++overlapRequestIdRef.current;
        const rangeDays = getRangeDays(period);
        setLoading(true);
        setError('');
        try {
            const activityView = await userActivityViewService.loadActivityView(
                {
                    userId,
                    ownerUserId: currentUserId,
                    isSelf: isCurrentUser,
                    rangeDays,
                    dayLabels,
                    forceRefresh
                }
            );
            if (requestId !== activityRequestIdRef.current) {
                return;
            }

            setHasAnyData(activityView.hasAnyData);
            setFilteredEventCount(activityView.filteredEventCount || 0);
            setPeakDayText(activityView.peakDay || '');
            setPeakTimeText(activityView.peakTime || '');
            setMainHeatmap({
                rawBuckets: activityView.rawBuckets || [],
                normalizedBuckets: activityView.normalizedBuckets || []
            });
            lastLoadedContextRef.current = activityContextKey;

            if (!activityView.hasAnyData) {
                setTopWorlds([]);
                setTopWorldsLoading(false);
                setTopWorldsLoadingVisible(false);
                setHasOverlapData(false);
                setOverlapHeatmap({ rawBuckets: [], normalizedBuckets: [] });
                return;
            }

            if (isCurrentUser) {
                await loadTopWorlds({
                    rangeDays,
                    sortBy,
                    excludeHomeWorld,
                    requestId
                });
                if (requestId !== activityRequestIdRef.current) {
                    return;
                }
                setHasOverlapData(false);
                return;
            }

            if (!currentUserId) {
                setHasOverlapData(false);
                return;
            }

            beginOverlapLoading(overlapRequestId);
            const overlapView = await userActivityViewService.loadOverlapView({
                currentUserId,
                targetUserId: userId,
                ownerUserId: currentUserId,
                rangeDays,
                dayLabels,
                forceRefresh,
                excludeHours: {
                    enabled: excludeOverlap,
                    startHour: Number.parseInt(excludeStart, 10),
                    endHour: Number.parseInt(excludeEnd, 10)
                }
            });
            if (requestId !== activityRequestIdRef.current) {
                return;
            }
            applyOverlapView(overlapView);
        } catch (nextError) {
            if (requestId !== activityRequestIdRef.current) {
                return;
            }
            const message =
                nextError instanceof Error
                    ? nextError.message
                    : t(
                          'dialog.user.activity.failed_to_load',
                          'Failed to load activity.'
                      );
            setError(message);
            toast.error(message);
        } finally {
            if (requestId === activityRequestIdRef.current) {
                setLoading(false);
            }
            finishOverlapLoading(overlapRequestId);
        }
    }

    useEffect(() => {
        if (!active) {
            activityRequestIdRef.current += 1;
            overlapRequestIdRef.current += 1;
            topWorldRequestIdRef.current += 1;
            clearTopWorldsLoadingTimer();
            clearOverlapLoadingTimer();
            setLoading(false);
            setOverlapLoading(false);
            setOverlapLoadingVisible(false);
            setTopWorldsLoading(false);
            setTopWorldsLoadingVisible(false);
            return undefined;
        }

        let isMounted = true;
        const baseRequestId = ++activityRequestIdRef.current;
        const contextChanged =
            lastLoadedContextRef.current !== activityContextKey;
        if (contextChanged) {
            resetActivityState();
        } else if (hasAnyData || loading) {
            setError('');
            return () => {
                isMounted = false;
            };
        } else {
            setError('');
        }

        async function loadSettingsAndData() {
            const [
                period,
                sortBy,
                excludeHomeWorld,
                overlapExcludeEnabled,
                overlapExcludeStart,
                overlapExcludeEnd
            ] = await Promise.all([
                configRepository.getString(
                    isCurrentUser
                        ? ACTIVITY_SELF_PERIOD_KEY
                        : ACTIVITY_FRIEND_PERIOD_KEY,
                    '30'
                ),
                configRepository.getString(
                    ACTIVITY_SELF_TOP_WORLDS_SORT_KEY,
                    'time'
                ),
                configRepository.getBool(
                    ACTIVITY_SELF_EXCLUDE_HOME_WORLD_KEY,
                    false
                ),
                configRepository.getBool(OVERLAP_EXCLUDE_ENABLED_KEY, false),
                configRepository.getString(OVERLAP_EXCLUDE_START_KEY, '1'),
                configRepository.getString(OVERLAP_EXCLUDE_END_KEY, '6')
            ]);
            if (!isMounted || baseRequestId !== activityRequestIdRef.current) {
                return;
            }

            const nextPeriod = normalizeActivityPeriod(period);
            const nextSortBy = normalizeTopWorldsSort(sortBy);
            const nextExcludeStart = String(overlapExcludeStart);
            const nextExcludeEnd = String(overlapExcludeEnd);
            const nextExcludeHomeWorld = Boolean(excludeHomeWorld);
            const nextExcludeOverlap = Boolean(overlapExcludeEnabled);
            setSelectedPeriod(nextPeriod);
            setTopWorldsSortBy(nextSortBy);
            setExcludeHomeWorldEnabled(nextExcludeHomeWorld);
            setExcludeHoursEnabled(nextExcludeOverlap);
            setExcludeStartHour(nextExcludeStart);
            setExcludeEndHour(nextExcludeEnd);
            activityRequestIdRef.current = baseRequestId - 1;
            await refreshData({
                period: nextPeriod,
                sortBy: nextSortBy,
                excludeHomeWorld: nextExcludeHomeWorld,
                excludeOverlap: nextExcludeOverlap,
                excludeStart: nextExcludeStart,
                excludeEnd: nextExcludeEnd
            });
        }

        loadSettingsAndData();
        return () => {
            isMounted = false;
        };
    }, [active, activityContextKey]);

    useEffect(
        () => () => {
            clearTopWorldsLoadingTimer();
            clearOverlapLoadingTimer();
            if (easterEggTimerRef.current !== null) {
                clearTimeout(easterEggTimerRef.current);
                easterEggTimerRef.current = null;
            }
        },
        []
    );

    useEffect(() => {
        if (active && isCurrentUser && excludeHomeWorldEnabled && hasAnyData) {
            refreshTopWorldsOnly();
        }
    }, [currentHomeWorldId]);

    async function changePeriod(value: any) {
        const nextPeriod = normalizeActivityPeriod(value);
        setSelectedPeriod(nextPeriod);
        await configRepository.setString(
            isCurrentUser
                ? ACTIVITY_SELF_PERIOD_KEY
                : ACTIVITY_FRIEND_PERIOD_KEY,
            nextPeriod
        );
        await refreshData({ period: nextPeriod });
    }

    async function changeTopWorldsSort(value: any) {
        const nextSortBy = normalizeTopWorldsSort(value);
        setTopWorldsSortBy(nextSortBy);
        await configRepository.setString(
            ACTIVITY_SELF_TOP_WORLDS_SORT_KEY,
            nextSortBy
        );
        await refreshTopWorldsOnly({ sortBy: nextSortBy });
    }

    async function changeExcludeHomeWorld(value: any) {
        setExcludeHomeWorldEnabled(value);
        await configRepository.setBool(
            ACTIVITY_SELF_EXCLUDE_HOME_WORLD_KEY,
            value
        );
        await refreshTopWorldsOnly({ excludeHomeWorld: value });
    }

    async function changeExcludeHours(value: any) {
        setExcludeHoursEnabled(value);
        await configRepository.setBool(OVERLAP_EXCLUDE_ENABLED_KEY, value);
        await refreshOverlapOnly({ excludeOverlap: value });
    }

    async function changeExcludeRange(kind: any, value: any) {
        const nextStart = kind === 'start' ? value : excludeStartHour;
        const nextEnd = kind === 'end' ? value : excludeEndHour;
        if (kind === 'start') {
            setExcludeStartHour(value);
        } else {
            setExcludeEndHour(value);
        }
        await Promise.all([
            configRepository.setString(OVERLAP_EXCLUDE_START_KEY, nextStart),
            configRepository.setString(OVERLAP_EXCLUDE_END_KEY, nextEnd)
        ]);
        await refreshOverlapOnly({
            excludeStart: nextStart,
            excludeEnd: nextEnd
        });
    }

    function onActivityChartRightClick() {
        toast(t('dialog.user.activity.chart_hint'), {
            position: 'bottom-center',
            icon: <TractorIcon className="size-4" />
        });
        if (easterEggTimerRef.current !== null) {
            clearTimeout(easterEggTimerRef.current);
        }
        easterEggTimerRef.current = setTimeout(() => {
            easterEggTimerRef.current = null;
        }, 5000);
    }

    function onOverlapChartRightClick() {
        if (!easterEggTimerRef.current) {
            return;
        }
        toast(t('dialog.user.activity.chart_hint_reply'), {
            position: 'bottom-center',
            icon: <SproutIcon className="size-4" />
        });
    }

    const activityScaleColors = useMemo(
        () =>
            isDarkMode
                ? [
                      'hsl(160, 40%, 24%)',
                      'hsl(150, 48%, 32%)',
                      'hsl(142, 55%, 38%)',
                      'hsl(142, 65%, 46%)',
                      'hsl(142, 80%, 55%)'
                  ]
                : [
                      'hsl(160, 40%, 82%)',
                      'hsl(155, 45%, 68%)',
                      'hsl(142, 55%, 55%)',
                      'hsl(142, 65%, 40%)',
                      'hsl(142, 76%, 30%)'
                  ],
        [isDarkMode]
    );
    const overlapScaleColors = useMemo(
        () =>
            isDarkMode
                ? [
                      'hsl(260, 30%, 26%)',
                      'hsl(260, 42%, 36%)',
                      'hsl(260, 50%, 45%)',
                      'hsl(260, 60%, 54%)',
                      'hsl(260, 70%, 62%)'
                  ]
                : [
                      'hsl(260, 35%, 85%)',
                      'hsl(260, 42%, 70%)',
                      'hsl(260, 48%, 58%)',
                      'hsl(260, 55%, 48%)',
                      'hsl(260, 60%, 38%)'
                  ],
        [isDarkMode]
    );
    const emptyColor = isDarkMode ? 'hsl(220, 15%, 12%)' : 'hsl(210, 30%, 95%)';

    return (
        <div
            className="flex min-w-0 flex-col overflow-x-hidden"
            style={{ minHeight: 200 }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-full"
                                disabled={loading}
                                aria-label={'Refresh activity data'}
                                onClick={() => {
                                    refreshData({ forceRefresh: true });
                                }}
                            >
                                {loading ? (
                                    <Spinner data-icon="inline-start" />
                                ) : (
                                    <RefreshCwIcon data-icon="inline-start" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {t('dialog.user.activity.refresh_hint')}
                        </TooltipContent>
                    </Tooltip>
                    {filteredEventCount > 0 ? (
                        <span className="text-accent-foreground ml-1 text-sm">
                            {t('dialog.user.activity.total_events', {
                                count: filteredEventCount
                            })}
                        </span>
                    ) : null}
                </div>
                {hasAnyData ? (
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                            {t('dialog.user.activity.period')}
                        </span>
                        <Select
                            value={selectedPeriod}
                            onValueChange={(value: any) => {
                                changePeriod(value);
                            }}
                            disabled={loading}
                        >
                            <SelectTrigger size="sm" className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="90">
                                        {t('dialog.user.activity.period_90')}
                                    </SelectItem>
                                    <SelectItem value="30">
                                        {t('dialog.user.activity.period_30')}
                                    </SelectItem>
                                    <SelectItem value="7">
                                        {t('dialog.user.activity.period_7')}
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                ) : null}
            </div>

            {peakDayText || peakTimeText ? (
                <div className="mt-2 mb-1 flex gap-4 text-sm">
                    {peakDayText ? (
                        <div>
                            <span className="text-muted-foreground">
                                {t('dialog.user.activity.most_active_day')}
                            </span>
                            <span className="ml-1 font-medium">
                                {peakDayText}
                            </span>
                        </div>
                    ) : null}
                    {peakTimeText ? (
                        <div>
                            <span className="text-muted-foreground">
                                {t('dialog.user.activity.most_active_time')}
                            </span>
                            <span className="ml-1 font-medium">
                                {peakTimeText}
                            </span>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {loading && !hasAnyData ? (
                <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-2">
                    <Spinner className="size-5" />
                    <span className="text-muted-foreground text-sm">
                        {t('dialog.user.activity.preparing_data')}
                    </span>
                    <span className="text-muted-foreground text-xs">
                        {t('dialog.user.activity.preparing_data_hint')}
                    </span>
                </div>
            ) : null}
            {!loading && error ? (
                <Alert variant="destructive" className="mt-8">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            {!loading && !error && !hasAnyData ? (
                <ActivityEmptyState title={t('common.no_data')} />
            ) : null}
            {!loading && hasAnyData && filteredEventCount === 0 ? (
                <ActivityEmptyState
                    title={t('dialog.user.activity.no_data_in_period')}
                />
            ) : null}

            {filteredEventCount > 0 ? (
                <HeatmapChart
                    rawBuckets={mainHeatmap.rawBuckets}
                    normalizedBuckets={mainHeatmap.normalizedBuckets}
                    dayLabels={displayDayLabels}
                    hourLabels={USER_ACTIVITY_HOUR_LABELS}
                    weekStartsOn={weekStartsOn}
                    isDarkMode={isDarkMode}
                    emptyColor={emptyColor}
                    scaleColors={activityScaleColors}
                    unitLabel={t('dialog.user.activity.minutes_online')}
                    onContextMenu={onActivityChartRightClick}
                />
            ) : null}

            {!isCurrentUser && hasAnyData ? (
                <UserActivityOverlapSection
                    bestOverlapTime={bestOverlapTime}
                    changeExcludeHours={changeExcludeHours}
                    changeExcludeRange={changeExcludeRange}
                    dayLabels={displayDayLabels}
                    emptyColor={emptyColor}
                    excludeEndHour={excludeEndHour}
                    excludeHoursEnabled={excludeHoursEnabled}
                    excludeStartHour={excludeStartHour}
                    hasOverlapData={hasOverlapData}
                    isDarkMode={isDarkMode}
                    onOverlapChartRightClick={onOverlapChartRightClick}
                    overlapHeatmap={overlapHeatmap}
                    overlapLoading={overlapLoading}
                    overlapLoadingVisible={overlapLoadingVisible}
                    overlapPercent={overlapPercent}
                    overlapScaleColors={overlapScaleColors}
                    weekStartsOn={weekStartsOn}
                />
            ) : null}

            {isCurrentUser && hasAnyData ? (
                <UserActivityTopWorldsSection
                    changeExcludeHomeWorld={changeExcludeHomeWorld}
                    changeTopWorldsSort={changeTopWorldsSort}
                    currentHomeWorldId={currentHomeWorldId}
                    excludeHomeWorldEnabled={excludeHomeWorldEnabled}
                    loading={loading}
                    topWorlds={topWorlds}
                    topWorldsLoading={topWorldsLoading}
                    topWorldsLoadingVisible={topWorldsLoadingVisible}
                    topWorldsSortBy={topWorldsSortBy}
                />
            ) : null}
        </div>
    );
}
