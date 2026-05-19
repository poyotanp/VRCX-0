import { tauriClient } from '@/platform/tauri/client';
import { useRuntimeStore } from '@/state/runtimeStore';

import { stopRuntimeUpdateLoopAndWaitForIdle } from './updateLoopService';

function currentAuthScope() {
    const auth = useRuntimeStore.getState().auth;
    return {
        userId: auth.currentUserId ?? auth.currentUserSnapshot?.id ?? '',
        endpoint: auth.currentUserEndpoint ?? ''
    };
}

export async function startBackgroundModeForCurrentSession() {
    const { userId, endpoint } = currentAuthScope();
    await stopRuntimeUpdateLoopAndWaitForIdle();
    await tauriClient.app.RuntimeAuthScopeSet({ userId, endpoint });
    return tauriClient.app.StartBackgroundMode();
}
