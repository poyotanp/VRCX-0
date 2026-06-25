import { beforeEach, describe, expect, it, vi } from 'vitest';

const commandMocks = vi.hoisted(() => ({
    appGetLegacyVrcxForceMigrationStatus: vi.fn(),
    appRequestLegacyVrcxForceMigration: vi.fn()
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: commandMocks
}));

import { promptLegacyVrcxForceMigration } from './legacyVrcxMigrationService';

function createPromptOptions() {
    return {
        confirm: vi.fn(),
        t: vi.fn((key: string, params?: Record<string, unknown>) =>
            params?.error
                ? `${key}:${String(params.error)}`
                : params?.path
                  ? `${key}:${String(params.path)}`
                  : key
        ),
        toast: {
            error: vi.fn(),
            warning: vi.fn()
        }
    };
}

describe('legacyVrcxMigrationService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        commandMocks.appGetLegacyVrcxForceMigrationStatus.mockResolvedValue({
            available: true,
            dbPath: 'C:/Users/about/AppData/Roaming/VRCX/VRCX.sqlite3'
        });
        commandMocks.appRequestLegacyVrcxForceMigration.mockResolvedValue(true);
    });

    it('shows an error when the force-migration status command fails', async () => {
        const options = createPromptOptions();
        commandMocks.appGetLegacyVrcxForceMigrationStatus.mockRejectedValueOnce(
            new Error('status failed')
        );

        await promptLegacyVrcxForceMigration(options);

        expect(options.toast.error).toHaveBeenCalledWith(
            'view.settings.advanced.advanced.database_cleanup.legacy_migration_failed:status failed'
        );
        expect(options.confirm).not.toHaveBeenCalled();
    });

    it('shows the unavailable reason without opening confirmation', async () => {
        const options = createPromptOptions();
        commandMocks.appGetLegacyVrcxForceMigrationStatus.mockResolvedValueOnce({
            available: false,
            reason: 'Legacy DB is too new.'
        });

        await promptLegacyVrcxForceMigration(options);

        expect(options.toast.error).toHaveBeenCalledWith(
            'Legacy DB is too new.'
        );
        expect(options.confirm).not.toHaveBeenCalled();
    });

    it('does not request migration when confirmation is cancelled', async () => {
        const options = createPromptOptions();
        options.confirm.mockResolvedValueOnce({
            ok: false
        });

        await promptLegacyVrcxForceMigration(options);

        expect(options.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                destructive: true,
                description:
                    'view.settings.advanced.advanced.database_cleanup.legacy_migration_confirm_description:C:/Users/about/AppData/Roaming/VRCX/VRCX.sqlite3'
            })
        );
        expect(
            commandMocks.appRequestLegacyVrcxForceMigration
        ).not.toHaveBeenCalled();
    });

    it('warns when a confirmed force migration writes the flag but does not restart', async () => {
        const options = createPromptOptions();
        options.confirm.mockResolvedValueOnce({
            ok: true
        });
        commandMocks.appRequestLegacyVrcxForceMigration.mockResolvedValueOnce(
            false
        );

        await promptLegacyVrcxForceMigration(options);

        expect(
            commandMocks.appRequestLegacyVrcxForceMigration
        ).toHaveBeenCalledTimes(1);
        expect(options.toast.warning).toHaveBeenCalledWith(
            'view.settings.advanced.advanced.database_cleanup.legacy_migration_restart_manually'
        );
    });

    it('reports request failures with the thrown error message', async () => {
        const options = createPromptOptions();
        options.confirm.mockResolvedValueOnce({
            ok: true
        });
        commandMocks.appRequestLegacyVrcxForceMigration.mockRejectedValueOnce(
            new Error('request failed')
        );

        await promptLegacyVrcxForceMigration(options);

        expect(options.toast.error).toHaveBeenCalledWith(
            'view.settings.advanced.advanced.database_cleanup.legacy_migration_failed:request failed'
        );
    });
});
