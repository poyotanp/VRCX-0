import {
    buildDailySummary,
    buildSessionsFromEvents,
    buildSessionsFromGamelog,
    buildHeatmapBuckets,
    buildOverlapBuckets,
    computeActivityView,
    computeOverlapView,
    normalizeBuckets
} from '../shared/utils/activityEngine';
import type { ActivityEvent } from '../shared/utils/activityEngine';
import type {
    ActivityWorkerRequest,
    ActivityWorkerResponse,
    ActivityWorkerResult,
    ActivityWorkerSourceEvent,
    ActivityWorkerTaskType,
    ComputeSessionsSnapshotPayload,
    SessionsSnapshotResult
} from './activityWorkerTypes';

const ACTIVITY_WORKER_TASK_TYPES: ActivityWorkerTaskType[] = [
    'computeSessionsSnapshot',
    'computeActivityView',
    'computeOverlapView',
    'buildSessionsFromGamelog',
    'buildSessionsFromEvents',
    'buildHeatmapBuckets',
    'buildOverlapBuckets',
    'normalizeHeatmapBuckets',
    'computeDailySummary'
];
const ACTIVITY_WORKER_TASK_TYPE_SET: ReadonlySet<string> = new Set(
    ACTIVITY_WORKER_TASK_TYPES
);

function isActivityWorkerTaskType(
    value: unknown
): value is ActivityWorkerTaskType {
    return (
        typeof value === 'string' && ACTIVITY_WORKER_TASK_TYPE_SET.has(value)
    );
}

function postWorkerResponse(
    response: ActivityWorkerResponse<ActivityWorkerTaskType>
): void {
    self.postMessage(response);
}

function asActivityEvents(
    events: ActivityWorkerSourceEvent[]
): ActivityEvent[] {
    return events as ActivityEvent[];
}

self.addEventListener(
    'message',
    (
        event: MessageEvent<
            Partial<ActivityWorkerRequest<ActivityWorkerTaskType>>
        >
    ) => {
        const { type, seq = 0, payload } = event.data;

        try {
            if (!isActivityWorkerTaskType(type)) {
                throw new Error(
                    `Unknown activity worker task: ${String(type)}`
                );
            }

            const result = executeActivityWorkerTask(type, payload);
            postWorkerResponse({ type: 'result', seq, payload: result });
        } catch (error) {
            postWorkerResponse({
                type: 'error',
                seq,
                payload: {
                    message:
                        error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
);

function executeActivityWorkerTask(
    type: ActivityWorkerTaskType,
    payload: unknown
): ActivityWorkerResult<ActivityWorkerTaskType> {
    switch (type) {
        case 'computeSessionsSnapshot':
            return computeSessionsSnapshot(
                payload as ComputeSessionsSnapshotPayload
            );
        case 'computeActivityView':
            return computeActivityView(
                payload as ActivityWorkerRequest<'computeActivityView'>['payload']
            );
        case 'computeOverlapView':
            return computeOverlapView(
                payload as ActivityWorkerRequest<'computeOverlapView'>['payload']
            );
        case 'buildSessionsFromGamelog': {
            const taskPayload =
                payload as ActivityWorkerRequest<'buildSessionsFromGamelog'>['payload'];
            return {
                sessions: buildSessionsFromGamelog(
                    asActivityEvents(taskPayload.rows || []),
                    taskPayload.mergeGapMs,
                    taskPayload.nowMs
                )
            };
        }
        case 'buildSessionsFromEvents': {
            const taskPayload =
                payload as ActivityWorkerRequest<'buildSessionsFromEvents'>['payload'];
            return buildSessionsFromEvents(
                asActivityEvents(taskPayload.events || []),
                taskPayload.initialStart ?? null
            );
        }
        case 'buildHeatmapBuckets': {
            const taskPayload =
                payload as ActivityWorkerRequest<'buildHeatmapBuckets'>['payload'];
            return {
                buckets: buildHeatmapBuckets(
                    taskPayload.sessions || [],
                    taskPayload.windowStartMs,
                    taskPayload.nowMs,
                    taskPayload.maxSessionMs
                )
            };
        }
        case 'buildOverlapBuckets': {
            const taskPayload =
                payload as ActivityWorkerRequest<'buildOverlapBuckets'>['payload'];
            return {
                buckets: buildOverlapBuckets(
                    taskPayload.selfSessions || [],
                    taskPayload.friendSessions || [],
                    taskPayload.windowStartMs,
                    taskPayload.nowMs,
                    taskPayload.maxSessionMs
                )
            };
        }
        case 'normalizeHeatmapBuckets': {
            const taskPayload =
                payload as ActivityWorkerRequest<'normalizeHeatmapBuckets'>['payload'];
            if ('thresholdMinutes' in taskPayload || 'mode' in taskPayload) {
                console.warn(
                    '[activityWorker] normalizeHeatmapBuckets received legacy payload fields (thresholdMinutes/mode). Use payload.config instead.'
                );
            }
            return {
                normalized: normalizeBuckets(
                    taskPayload.buckets || [],
                    taskPayload.config || {}
                )
            };
        }
        case 'computeDailySummary': {
            const taskPayload =
                payload as ActivityWorkerRequest<'computeDailySummary'>['payload'];
            return {
                dailySummary: buildDailySummary(
                    taskPayload.sessions || [],
                    taskPayload.rangeStartMs,
                    taskPayload.rangeEndMs
                )
            };
        }
    }
}

function computeSessionsSnapshot(
    payload: ComputeSessionsSnapshotPayload
): SessionsSnapshotResult {
    const sourceRevision =
        typeof payload.sourceRevision === 'string'
            ? payload.sourceRevision
            : String(payload.sourceRevision ?? '');
    if ('rows' in payload) {
        const sessions = buildSessionsFromGamelog(
            asActivityEvents(payload.rows),
            payload.mergeGapMs,
            payload.nowMs
        ).map((session, index, list) => ({
            ...session,
            isOpenTail:
                index === list.length - 1 && payload.mayHaveOpenTail === true,
            sourceRevision
        }));
        return {
            sessions,
            pendingSessionStartAt: null
        };
    }

    const result = buildSessionsFromEvents(
        asActivityEvents(payload.events),
        payload.initialStart
    );
    return {
        pendingSessionStartAt: result.pendingSessionStartAt,
        sessions: result.sessions.map((session) => ({
            ...session,
            isOpenTail: false,
            sourceRevision
        }))
    };
}
