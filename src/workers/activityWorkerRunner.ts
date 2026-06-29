import ActivityWorker from './activityWorker.js?worker&inline';
import type {
    ActivityWorkerPayload,
    ActivityWorkerResponse,
    ActivityWorkerResult,
    ActivityWorkerTaskType
} from './activityWorkerTypes';

let worker: Worker | null = null;
let workerSeq = 0;
const pendingWorkerCallbacks = new Map<
    number,
    {
        resolve: (value: unknown) => void;
        reject: (reason: unknown) => void;
    }
>();

function getWorker() {
    if (!worker) {
        worker = new ActivityWorker();
        worker.onmessage = (
            event: MessageEvent<ActivityWorkerResponse<ActivityWorkerTaskType>>
        ) => {
            const { type, seq, payload } = event.data;
            const callback = pendingWorkerCallbacks.get(seq);
            if (!callback) {
                return;
            }
            pendingWorkerCallbacks.delete(seq);
            if (type === 'error') {
                callback.reject(new Error(payload.message));
                return;
            }
            callback.resolve(payload);
        };
    }
    return worker;
}

export function runActivityWorkerTask<TTask extends ActivityWorkerTaskType>(
    type: TTask,
    payload: ActivityWorkerPayload<TTask>
): Promise<ActivityWorkerResult<TTask>> {
    return new Promise((resolve, reject) => {
        const seq = ++workerSeq;
        pendingWorkerCallbacks.set(seq, {
            resolve: (value: unknown) =>
                resolve(value as ActivityWorkerResult<TTask>),
            reject
        });
        getWorker().postMessage({ type, seq, payload });
    });
}
