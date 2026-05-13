import { backend } from '@/platform/index.js';
import type { LegacyVrcxMigrationStatus } from '@/platform/tauri/backend.js';

type ConfirmResult = {
    ok?: boolean;
};
type ConfirmOptions = Record<string, unknown> & {
    title: string;
    description: string;
    confirmText: string;
    cancelText: string;
    destructive?: boolean;
};
type LegacyMigrationPromptOptions = {
    confirm: (options: ConfirmOptions) => Promise<ConfirmResult>;
    t: (key: string, params?: Record<string, unknown>) => string;
    toast: {
        error: (message: string) => unknown;
        warning: (message: string) => unknown;
    };
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

const LEGACY_MIGRATION_I18N_PREFIX =
    'view.settings.advanced.advanced.database_cleanup';

export async function promptLegacyVrcxForceMigration({
    confirm,
    t,
    toast
}: LegacyMigrationPromptOptions): Promise<void> {
    let status: LegacyVrcxMigrationStatus | null = null;
    try {
        status = await backend.app.GetLegacyVrcxForceMigrationStatus();
    } catch (error) {
        toast.error(
            t(`${LEGACY_MIGRATION_I18N_PREFIX}.legacy_migration_failed`, {
                error: errorMessage(error)
            })
        );
        return;
    }

    if (!status?.available) {
        toast.error(
            status?.reason ||
                t(
                    `${LEGACY_MIGRATION_I18N_PREFIX}.legacy_migration_not_available`
                )
        );
        return;
    }

    const result = await confirm({
        title: t(
            `${LEGACY_MIGRATION_I18N_PREFIX}.legacy_migration_confirm_title`
        ),
        description: t(
            `${LEGACY_MIGRATION_I18N_PREFIX}.legacy_migration_confirm_description`,
            {
                path: status.dbPath || '%APPDATA%\\VRCX'
            }
        ),
        confirmText: t(
            `${LEGACY_MIGRATION_I18N_PREFIX}.legacy_migration_confirm`
        ),
        cancelText: t('common.actions.cancel'),
        destructive: true
    });
    if (!result.ok) {
        return;
    }

    try {
        const willRestart = await backend.app.RequestLegacyVrcxForceMigration();
        if (!willRestart) {
            toast.warning(
                t(
                    `${LEGACY_MIGRATION_I18N_PREFIX}.legacy_migration_restart_manually`
                )
            );
        }
    } catch (error) {
        toast.error(
            t(`${LEGACY_MIGRATION_I18N_PREFIX}.legacy_migration_failed`, {
                error: errorMessage(error)
            })
        );
    }
}
