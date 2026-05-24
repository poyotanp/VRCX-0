import { describe, expect, it } from 'vitest';

import rustLibSource from '../../../src-tauri/src/lib.rs?raw';
import mediaFileRepositorySource from '../../repositories/mediaFileRepository.ts?raw';
import errorLogServiceSource from '../../services/errorLogService.ts?raw';
import toolActionServiceSource from '../../services/toolActionService.ts?raw';
import toolsSource from '../../shared/constants/tools.ts?raw';
import appCommandTypesSource from './appCommandTypes.ts?raw';
import { toCommandName, toNamedArgs } from './commands';
import commandSource from './commands.ts?raw';
import updaterSource from './updater.ts?raw';
import rustExternalApiSource from '../../../src-tauri/src/commands/integrations/external_api/service.rs?raw';
import rustHostGameSource from '../../../src-tauri/src/commands/host/game.rs?raw';
import rustHostAppLauncherSource from '../../../src-tauri/src/commands/host/app_launcher.rs?raw';
import rustHostRegistrySource from '../../../src-tauri/src/commands/host/registry.rs?raw';
import rustHostScreenshotsSource from '../../../src-tauri/src/commands/host/screenshots.rs?raw';
import rustHostShellSource from '../../../src-tauri/src/commands/host/shell.rs?raw';
import rustHostUpdaterSource from '../../../src-tauri/src/commands/host/updater.rs?raw';
import rustApplicationRegistryBackupSource from '../../../src-tauri/src/commands/application/registry_backup.rs?raw';
import rustLocalConfigSource from '../../../src-tauri/src/commands/local/config.rs?raw';
import rustWebSource from '../../../src-tauri/src/commands/web.rs?raw';
import tauriDefaultCapabilitySource from '../../../src-tauri/capabilities/default.json?raw';
import rustApplicationRegistryBackupServiceSource from '../../../crates/application/src/registry_backup.rs?raw';
import rustIntegrationExternalApiSource from '../../../crates/integrations/src/external_api.rs?raw';
import rustVrchatHttpApiSource from '../../../crates/vrchat-client/src/http_api.rs?raw';
import rustVrchatRealtimeSource from '../../../crates/vrchat-client/src/realtime.rs?raw';

const repoFiles: Record<string, string> = {
    'src-tauri/src/lib.rs': rustLibSource,
    'src/platform/tauri/commands.ts': commandSource,
    'src/platform/tauri/appCommandTypes.ts': appCommandTypesSource,
    'src/platform/tauri/updater.ts': updaterSource,
    'src/repositories/mediaFileRepository.ts': mediaFileRepositorySource,
    'src/shared/constants/tools.ts': toolsSource,
    'src/services/errorLogService.ts': errorLogServiceSource,
    'src/services/toolActionService.ts': toolActionServiceSource,
    'src-tauri/src/commands/integrations/external_api/service.rs':
        rustExternalApiSource,
    'src-tauri/src/commands/host/game.rs': rustHostGameSource,
    'src-tauri/src/commands/host/app_launcher.rs': rustHostAppLauncherSource,
    'src-tauri/src/commands/host/registry.rs': rustHostRegistrySource,
    'src-tauri/src/commands/host/screenshots.rs': rustHostScreenshotsSource,
    'src-tauri/src/commands/host/shell.rs': rustHostShellSource,
    'src-tauri/src/commands/host/updater.rs': rustHostUpdaterSource,
    'src-tauri/src/commands/application/registry_backup.rs':
        rustApplicationRegistryBackupSource,
    'crates/application/src/registry_backup.rs':
        rustApplicationRegistryBackupServiceSource,
    'src-tauri/src/commands/local/config.rs': rustLocalConfigSource,
    'crates/integrations/src/external_api.rs': rustIntegrationExternalApiSource,
    'crates/vrchat-client/src/http_api.rs': rustVrchatHttpApiSource,
    'crates/vrchat-client/src/realtime.rs': rustVrchatRealtimeSource,
    'src-tauri/src/commands/web.rs': rustWebSource,
    'src-tauri/capabilities/default.json': tauriDefaultCapabilitySource
};

function readRepoFile(path: string): string {
    const source = repoFiles[path];
    if (source === undefined) {
        throw new Error(`Missing command audit fixture: ${path}`);
    }
    return source;
}

function rustRegisteredCommands(): Set<string> {
    const lib = readRepoFile('src-tauri/src/lib.rs');
    return new Set(
        Array.from(lib.matchAll(/commands::[A-Za-z0-9_:]+::([A-Za-z0-9_]+)/g), (match) => match[1])
    );
}

function commandArgNames(): Set<string> {
    const commands = readRepoFile('src/platform/tauri/commands.ts');
    const [, objectBody = ''] =
        commands.match(/const commandArgs: Record<string, string\[]> = \{([\s\S]*?)\n\};/) ?? [];
    return new Set(
        Array.from(objectBody.matchAll(/^\s{4}([A-Za-z0-9_]+):/gm), (match) => match[1])
    );
}

function appNamespaceCommandNames(): Set<string> {
    const source = readRepoFile('src/platform/tauri/appCommandTypes.ts');
    const [, interfaceBody = ''] =
        source.match(
            /export interface AppTauriCommandNamespace extends TauriCommandNamespace \{([\s\S]*?)\n\}/
        ) ?? [];
    return new Set(
        Array.from(
            interfaceBody.matchAll(
                /^\s{4}([A-Za-z0-9_]+)(?:\(|:\s*TauriCommand)/gm
            ),
            (match) => toCommandName('app', match[1])
        )
    );
}

function directInvokeCommandNames(): Set<string> {
    const commands = new Set<string>();
    for (const file of ['src/platform/tauri/updater.ts', 'src/services/errorLogService.ts']) {
        const source = readRepoFile(file);
        for (const match of source.matchAll(/invokeTauri\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
            commands.add(match[1]);
        }
    }
    return commands;
}

function invokeAppCommandNames(): Set<string> {
    const source = readRepoFile('src/repositories/mediaFileRepository.ts');
    return new Set(
        Array.from(
            source.matchAll(/invokeApp(?:<[^>]+>)?\(\s*['"]([A-Za-z0-9_]+)['"]/g),
            (match) => toCommandName('app', match[1])
        )
    );
}

function toolAppApiCommandNames(): Set<string> {
    const source = readRepoFile('src/shared/constants/tools.ts');
    return new Set(
        Array.from(
            source.matchAll(/type:\s*'app-api'[\s\S]*?method:\s*'([A-Za-z0-9_]+)'/g),
            (match) => toCommandName('app', match[1])
        )
    );
}

function dynamicAppMethodSourceNames(): Set<string> {
    const source = readRepoFile('src/services/toolActionService.ts');
    const usesToolActionMethods = /tauriClient\.app\[action\.method\]/.test(source);
    return usesToolActionMethods ? toolAppApiCommandNames() : new Set();
}

const highRiskCommands = [
    'web__get_cookies',
    'web__set_cookies',
    'app__config_set_values',
    'app__check_tauri_update',
    'app__download_and_install_tauri_update',
    'app__get_file_base64',
    'app__get_file_bytes',
    'app__open_file_selector_dialog',
    'app__open_folder_selector_dialog',
    'app__app_launcher_target_pick',
    'app__app_launcher_entry_test',
    'app__app_launcher_test_run_stop',
    'app__save_vrc_reg_json_file',
    'app__save_image_file',
    'app__open_folder_and_select_item',
    'app__start_game_from_path',
    'app__set_vrchat_registry_key',
    'app__set_vrchat_registry',
    'app__delete_vrchat_registry_folder',
    'app__registry_backup_restore',
    'app__registry_backup_import_json',
    'app__registry_backup_maintenance_run',
    'app__external_api_avatar_search_get',
    'app__external_api_image_data_url_get',
    'app__external_api_translation_request',
    'app__get_screenshot_metadata',
    'app__delete_screenshot_metadata',
    'app__add_screenshot_metadata',
    'app__vrchat_auth_current_user_get',
    'app__vrchat_auth_session_get',
    'app__vrchat_auth_login_basic',
    'app__start_realtime_transport',
    'app__sync_realtime_friend_snapshot',
    'app__sync_realtime_current_user_snapshot',
    'app__vrchat_media_file_put'
];

describe('tauri command mapping', () => {
    it('maps Tauri namespaces and method names to Rust command names', () => {
        expect(toCommandName('app', 'CurrentCulture')).toBe(
            'app__current_culture'
        );
        expect(toCommandName('assetBundle', 'CheckVRChatCache')).toBe(
            'asset_bundle__check_vrchat_cache'
        );
        expect(toCommandName('logWatcher', 'SetDateTill')).toBe(
            'log_watcher__set_date_till'
        );
        expect(toCommandName('app', 'GetHostCapabilities')).toBe(
            'app__get_host_capabilities'
        );
        expect(toCommandName('app', 'GetLegacyVrcxMigrationStatus')).toBe(
            'app__get_legacy_vrcx_migration_status'
        );
        expect(toCommandName('app', 'GetLegacyVrcxForceMigrationStatus')).toBe(
            'app__get_legacy_vrcx_force_migration_status'
        );
        expect(toCommandName('app', 'RequestLegacyVrcxForceMigration')).toBe(
            'app__request_legacy_vrcx_force_migration'
        );
        expect(toCommandName('app', 'RuntimeBackgroundJobRecord')).toBe(
            'app__runtime_background_job_record'
        );
    });

    it('uses explicit named args for known command contracts', () => {
        expect(toNamedArgs('storage__set', ['key', 'value'])).toEqual({
            key: 'key',
            value: 'value'
        });
        expect(
            toNamedArgs('app__app_launcher_enabled_set', [true])
        ).toEqual({ enabled: true });
        expect(
            toNamedArgs('app__app_launcher_entry_test', ['entry-1'])
        ).toEqual({ entryId: 'entry-1' });
        expect(
            toNamedArgs('app__app_launcher_entries_set', [[{ id: 'entry-1' }]])
        ).toEqual({ entries: [{ id: 'entry-1' }] });
        expect(toNamedArgs('app__get_host_capabilities', [])).toEqual({});
        expect(
            toNamedArgs('app__get_legacy_vrcx_migration_status', [])
        ).toEqual({});
        expect(
            toNamedArgs('app__get_legacy_vrcx_force_migration_status', [])
        ).toEqual({});
        expect(
            toNamedArgs('app__request_legacy_vrcx_force_migration', [])
        ).toEqual({});
        expect(
            toNamedArgs('app__runtime_background_job_record', [{ id: 'job' }])
        ).toEqual({
            input: { id: 'job' }
        });
        expect(
            toNamedArgs('asset_bundle__check_vrchat_cache', [
                'file_abc',
                1,
                'security',
                2
            ])
        ).toEqual({
            fileId: 'file_abc',
            fileVersion: 1,
            variant: 'security',
            variantVersion: 2
        });
    });

    it('falls back to object payloads or positional arg names for unknown commands', () => {
        expect(toNamedArgs('unknown__command', [{ ok: true }])).toEqual({
            ok: true
        });
        expect(toNamedArgs('unknown__command', ['a', 'b'])).toEqual({
            arg0: 'a',
            arg1: 'b'
        });
        expect(toNamedArgs('unknown__command', [])).toEqual({});
    });

    it('keeps named frontend command contracts registered in Rust', () => {
        const rustCommands = rustRegisteredCommands();
        const missing = Array.from(commandArgNames()).filter(
            (command) => !rustCommands.has(command)
        );
        expect(missing).toEqual([]);
    });

    it('keeps AppTauriCommandNamespace methods registered in Rust', () => {
        const rustCommands = rustRegisteredCommands();
        const appNamespaceCommands = appNamespaceCommandNames();
        expect(appNamespaceCommands.size).toBeGreaterThan(100);
        const missing = Array.from(appNamespaceCommands).filter(
            (command) => !rustCommands.has(command)
        );
        expect(missing).toEqual([]);
    });

    it('keeps direct invokeTauri command strings registered in Rust', () => {
        const rustCommands = rustRegisteredCommands();
        const missing = Array.from(directInvokeCommandNames()).filter(
            (command) => !rustCommands.has(command)
        );
        expect(missing).toEqual([]);
    });

    it('keeps invokeApp command strings registered in Rust', () => {
        const rustCommands = rustRegisteredCommands();
        const missing = Array.from(invokeAppCommandNames()).filter(
            (command) => !rustCommands.has(command)
        );
        expect(missing).toEqual([]);
    });

    it('keeps tool app-api action methods registered in Rust', () => {
        const rustCommands = rustRegisteredCommands();
        const missing = Array.from(toolAppApiCommandNames()).filter(
            (command) => !rustCommands.has(command)
        );
        expect(missing).toEqual([]);
    });

    it('exposes VRChat Startup Apps as a system tool dialog with host capabilities', () => {
        expect(toolsSource).toContain(`key: 'app-launcher'`);
        expect(toolsSource).toContain(`category: 'system'`);
        expect(toolsSource).toContain(`navIcon: 'lucide:Rocket'`);
        expect(toolsSource).toContain(
            `requiredCapabilities: ['gameProcessMonitor', 'gameLaunch']`
        );
        expect(toolsSource).toContain(`dialogKey: 'app-launcher'`);
        expect(toolActionServiceSource).toContain(
            `'app-launcher': 'appLauncherOpen'`
        );
    });

    it('keeps dynamic tauriClient.app method sources registered in Rust', () => {
        const rustCommands = rustRegisteredCommands();
        const missing = Array.from(dynamicAppMethodSourceNames()).filter(
            (command) => !rustCommands.has(command)
        );
        expect(missing).toEqual([]);
    });

    it('keeps runtime background job telemetry on the single public command name', () => {
        const rustCommands = rustRegisteredCommands();
        const namedArgs = commandArgNames();
        expect(rustCommands.has('app__runtime_background_job_record')).toBe(true);
        expect(namedArgs.has('app__runtime_background_job_record')).toBe(true);
        expect(rustCommands.has('app__runtime_job_record')).toBe(false);
        expect(namedArgs.has('app__runtime_job_record')).toBe(false);
    });

    it('keeps high-risk commands behind backend policy checks', () => {
        const rustCommands = rustRegisteredCommands();
        expect(highRiskCommands.filter((command) => !rustCommands.has(command))).toEqual([]);

        expect(readRepoFile('src-tauri/src/commands/web.rs')).toContain(
            'validate_vrchat_cookies_b64'
        );
        expect(readRepoFile('src-tauri/src/commands/host/updater.rs')).toContain(
            'validate_update_request'
        );
        expect(readRepoFile('src-tauri/src/commands/host/shell.rs')).toContain(
            'ensure_read_allowed'
        );
        expect(
            readRepoFile('src-tauri/src/commands/host/app_launcher.rs')
        ).toContain('require_app_launcher_supported');
        expect(
            readRepoFile('src-tauri/src/commands/host/app_launcher.rs')
        ).toContain('require_host_capability');
        expect(readRepoFile('src-tauri/src/commands/host/game.rs')).toContain(
            'ensure_vrchat_launch_path_allowed'
        );
        expect(readRepoFile('src-tauri/src/commands/host/registry.rs')).toContain(
            'ALLOWED_REGISTRY_TYPES'
        );
        expect(readRepoFile('src-tauri/src/commands/host/registry.rs')).toContain(
            'blocking_show'
        );
        expect(
            readRepoFile(
                'src-tauri/src/commands/application/registry_backup.rs'
            )
        ).toContain('RegistryBackupMaintenanceMode::Foreground');
        expect(
            readRepoFile(
                'src-tauri/src/commands/application/registry_backup.rs'
            )
        ).toContain('require_host_capability');
        expect(readRepoFile('crates/application/src/registry_backup.rs')).toContain(
            'ALLOWED_REGISTRY_TYPES'
        );
        expect(readRepoFile('src-tauri/src/commands/local/config.rs')).toContain(
            'validate_config_writes'
        );
        expect(readRepoFile('src-tauri/src/commands/host/screenshots.rs')).toContain(
            'is_vrchat_screenshot_file_path'
        );
        expect(readRepoFile('src-tauri/src/commands/host/screenshots.rs')).toContain(
            'ensure_write_allowed'
        );
        expect(
            readRepoFile(
                'src-tauri/src/commands/integrations/external_api/service.rs'
            )
        ).toContain('ExternalApiPolicy');
        expect(
            readRepoFile('crates/integrations/src/external_api.rs')
        ).toContain('is_public_host');
        expect(readRepoFile('crates/vrchat-client/src/http_api.rs')).toContain(
            'validated_vrchat_api_endpoint'
        );
        expect(readRepoFile('crates/vrchat-client/src/http_api.rs')).toContain(
            'validate_vrchat_media_upload_url'
        );
        expect(readRepoFile('crates/vrchat-client/src/realtime.rs')).toContain(
            'validated_websocket_domain'
        );
    });

    it('does not expose raw Tauri updater plugin commands to the renderer', () => {
        expect(readRepoFile('src-tauri/capabilities/default.json')).not.toContain(
            `updater${':'}default`
        );
        expect(readRepoFile('src/platform/tauri/updater.ts')).not.toContain(
            `@tauri-apps/${'plugin-updater'}`
        );
    });

    it('does not expose raw Tauri autostart plugin commands to the renderer', () => {
        const defaultCapability = readRepoFile('src-tauri/capabilities/default.json');
        expect(defaultCapability).not.toContain(`autostart${':'}allow-`);
        expect(commandSource).not.toContain(
            `@tauri-apps/${'plugin-autostart'}`
        );
    });
});
