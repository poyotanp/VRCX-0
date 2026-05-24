import { tauriClient } from '@/platform/tauri/client';
import type {
    AppLauncherEntry,
    AppLauncherPickedTarget,
    AppLauncherSnapshot
} from '@/platform/tauri/appCommandTypes';

const appLauncherRepository = {
    snapshot(): Promise<AppLauncherSnapshot> {
        return tauriClient.app.AppLauncherSnapshotGet();
    },

    setEnabled(enabled: boolean): Promise<AppLauncherSnapshot> {
        return tauriClient.app.AppLauncherEnabledSet(enabled);
    },

    setEntries(entries: AppLauncherEntry[]): Promise<AppLauncherSnapshot> {
        return tauriClient.app.AppLauncherEntriesSet(entries);
    },

    pickTarget(): Promise<AppLauncherPickedTarget | null> {
        return tauriClient.app.AppLauncherTargetPick('auto');
    }
};

export default appLauncherRepository;
