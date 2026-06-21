import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    UPDATE_AVAILABLE_TOAST_ID,
    openOrInstallLatestAvailableUpdate
} from '@/services/updateInstallService';
import { useRuntimeStore } from '@/state/runtimeStore';

function getLatestUpdaterDisplayVersion(release: any) {
    return (
        String(
            release?.latestVersion ||
                release?.displayVersion ||
                release?.canonicalVersion ||
                release?.tagName ||
                ''
        ).trim() || '-'
    );
}

function formatUpdateVersionLabel(version: string) {
    if (!version || version === '-') {
        return version;
    }
    return /^v/i.test(version) ? version : `v${version}`;
}

export function showUpdateAvailableToast({
    latestUpdaterRelease,
    t,
    onUpdate
}: {
    latestUpdaterRelease: unknown;
    t: (key: string) => string;
    onUpdate: () => void;
}) {
    toast.info(t('service.background_maintenance.label.vrcx_update_available'), {
        id: UPDATE_AVAILABLE_TOAST_ID,
        icon: null,
        description: formatUpdateVersionLabel(
            getLatestUpdaterDisplayVersion(latestUpdaterRelease)
        ),
        duration: Infinity,
        position: 'bottom-right',
        closeButton: true,
        dismissible: true,
        action: {
            label: t('nav_menu.update'),
            onClick: onUpdate
        }
    });
}

export function UpdateAvailableToastHost() {
    const { t } = useTranslation();
    const hasAvailableUpdate = useRuntimeStore((state: any) =>
        Boolean(state.updateLoop.hasAvailableUpdate)
    );
    const latestUpdaterRelease = useRuntimeStore(
        (state: any) => state.updateLoop.latestUpdaterRelease
    );

    useEffect(() => {
        if (!hasAvailableUpdate || !latestUpdaterRelease) {
            toast.dismiss(UPDATE_AVAILABLE_TOAST_ID);
            return undefined;
        }

        showUpdateAvailableToast({
            latestUpdaterRelease,
            t,
            onUpdate: () => {
                void openOrInstallLatestAvailableUpdate({
                    toastId: UPDATE_AVAILABLE_TOAST_ID
                });
            }
        });

        return undefined;
    }, [hasAvailableUpdate, latestUpdaterRelease, t]);

    return null;
}
