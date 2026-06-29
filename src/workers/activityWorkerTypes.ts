import type {
    ActivityNormalizeConfig,
    ActivitySession,
    ActivityView,
    ActivityViewInput,
    OverlapView,
    OverlapViewInput
} from '@/shared/utils/activityEngine';

export type ComputeSessionsSnapshotPayload =
    | {
          sourceType: 'self_gamelog';
          rows: ActivityWorkerSourceEvent[];
          mergeGapMs?: number;
          nowMs?: number;
          mayHaveOpenTail?: boolean;
          sourceRevision?: unknown;
      }
    | {
          sourceType?: string;
          events: ActivityWorkerSourceEvent[];
          initialStart?: number | null;
          nowMs?: number;
          mayHaveOpenTail?: boolean;
          sourceRevision?: unknown;
      };

export type ActivityWorkerSourceEvent = {
    created_at: unknown;
    type?: unknown;
    time?: unknown;
};

export type SessionsSnapshotResult = {
    pendingSessionStartAt: number | null;
    sessions: ActivitySession[];
};

export type ActivityWorkerTaskMap = {
    computeSessionsSnapshot: {
        payload: ComputeSessionsSnapshotPayload;
        result: SessionsSnapshotResult;
    };
    computeActivityView: {
        payload: ActivityViewInput;
        result: ActivityView;
    };
    computeOverlapView: {
        payload: OverlapViewInput;
        result: OverlapView;
    };
    buildSessionsFromGamelog: {
        payload: {
            rows?: ActivityWorkerSourceEvent[];
            mergeGapMs?: number;
            nowMs?: number;
        };
        result: {
            sessions: ActivitySession[];
        };
    };
    buildSessionsFromEvents: {
        payload: {
            events?: ActivityWorkerSourceEvent[];
            initialStart?: number | null;
        };
        result: SessionsSnapshotResult;
    };
    buildHeatmapBuckets: {
        payload: {
            sessions?: ActivitySession[];
            windowStartMs: number;
            nowMs: number;
            maxSessionMs?: number;
        };
        result: {
            buckets: number[];
        };
    };
    buildOverlapBuckets: {
        payload: {
            selfSessions?: ActivitySession[];
            friendSessions?: ActivitySession[];
            windowStartMs: number;
            nowMs: number;
            maxSessionMs?: number;
        };
        result: {
            buckets: number[];
        };
    };
    normalizeHeatmapBuckets: {
        payload: {
            buckets?: number[];
            config?: ActivityNormalizeConfig;
            thresholdMinutes?: unknown;
            mode?: unknown;
        };
        result: {
            normalized: number[];
        };
    };
    computeDailySummary: {
        payload: {
            sessions?: ActivitySession[];
            rangeStartMs: number;
            rangeEndMs?: number;
        };
        result: {
            dailySummary: Array<{ date: string; totalMs: number }>;
        };
    };
};

export type ActivityWorkerTaskType = keyof ActivityWorkerTaskMap;

export type ActivityWorkerPayload<TTask extends ActivityWorkerTaskType> =
    ActivityWorkerTaskMap[TTask]['payload'];

export type ActivityWorkerResult<TTask extends ActivityWorkerTaskType> =
    ActivityWorkerTaskMap[TTask]['result'];

export type ActivityWorkerRequest<TTask extends ActivityWorkerTaskType> = {
    type: TTask;
    seq: number;
    payload: ActivityWorkerPayload<TTask>;
};

export type ActivityWorkerResultMessage<TTask extends ActivityWorkerTaskType> =
    {
        type: 'result';
        seq: number;
        payload: ActivityWorkerResult<TTask>;
    };

export type ActivityWorkerErrorMessage = {
    type: 'error';
    seq: number;
    payload: {
        message: string;
    };
};

export type ActivityWorkerResponse<TTask extends ActivityWorkerTaskType> =
    | ActivityWorkerResultMessage<TTask>
    | ActivityWorkerErrorMessage;
