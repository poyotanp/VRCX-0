import { useTranslation } from 'react-i18next';

import {
    confirmLegacyDatabaseMigration,
    skipLegacyDatabaseMigration
} from '@/services/databaseUpgradeService';
import { useRuntimeStore } from '@/state/runtimeStore';
import { Button } from '@/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';

function getDatabaseUpgradeTitleKey(phase: any) {
    switch (phase) {
        case 'confirm-legacy-migration':
            return 'message.database.migration_found_title';
        case 'running':
            return 'message.database.upgrade_in_progress_title';
        case 'restarting':
            return 'message.database.migration_restarting_title';
        case 'error':
            return 'message.database.upgrade_failed_title';
        default:
            return 'message.database.upgrade_in_progress_title';
    }
}

export function DatabaseUpgradeDialog({ open }: any) {
    const { t } = useTranslation();

    const databaseUpgrade = useRuntimeStore((state) => state.databaseUpgrade);
    const setDatabaseUpgradeState = useRuntimeStore(
        (state) => state.setDatabaseUpgradeState
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && databaseUpgrade.phase === 'running') {
                    return;
                }
                setDatabaseUpgradeState({ open: nextOpen });
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t(getDatabaseUpgradeTitleKey(databaseUpgrade.phase))}
                    </DialogTitle>
                    <DialogDescription>
                        {databaseUpgrade.detail ||
                            t(
                                'message.database.upgrade_in_progress_initializing'
                            )}
                    </DialogDescription>
                </DialogHeader>
                {databaseUpgrade.phase !== 'confirm-legacy-migration' &&
                (databaseUpgrade.fromVersion || databaseUpgrade.toVersion) ? (
                    <div className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-sm">
                        {t('message.database.upgrade_in_progress_description', {
                            from: databaseUpgrade.fromVersion || 0,
                            to: databaseUpgrade.toVersion || 0
                        })}
                    </div>
                ) : null}
                <DialogFooter>
                    {databaseUpgrade.phase === 'confirm-legacy-migration' ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    skipLegacyDatabaseMigration();
                                }}
                            >
                                {t('message.database.migration_skip')}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    confirmLegacyDatabaseMigration();
                                }}
                            >
                                {t('dialog.system.action.migrate_and_restart')}
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={databaseUpgrade.phase === 'running'}
                            onClick={() =>
                                setDatabaseUpgradeState({ open: false })
                            }
                        >
                            {t('common.actions.close')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
