import type { RegistryBackupSnapshot } from '@/platform/tauri/appCommandTypes';
import { tauriClient } from '@/platform/tauri/client';

import { requireHostCapability } from './hostCapabilityService';

async function listVrcRegistryBackups(): Promise<RegistryBackupSnapshot[]> {
    requireHostCapability('registryPrefs');
    return tauriClient.app.RegistryBackupList();
}

async function backupVrcRegistry(
    name: string = 'Manual Backup'
): Promise<RegistryBackupSnapshot[]> {
    requireHostCapability('registryPrefs');
    return tauriClient.app.RegistryBackupCreate(name);
}

async function restoreVrcRegistryBackup(
    key: string
): Promise<RegistryBackupSnapshot> {
    requireHostCapability('registryPrefs');
    return tauriClient.app.RegistryBackupRestore(key);
}

async function saveVrcRegistryBackupToFile(key: string): Promise<unknown> {
    requireHostCapability('registryPrefs');
    const backups = await listVrcRegistryBackups();
    const backup = backups.find((item) => item.key === key);
    if (!backup) {
        throw new Error('Registry backup not found.');
    }
    const json = await tauriClient.app.RegistryBackupExportJson(key);
    return tauriClient.app.SaveVrcRegJsonFile(
        null,
        `${backup.name || 'VRChat Registry Backup'}.json`,
        json
    );
}

async function restoreVrcRegistryBackupFromFile(): Promise<boolean> {
    requireHostCapability('registryPrefs');
    const filePath = await tauriClient.app.OpenFileSelectorDialog(
        null,
        '.json',
        'JSON Files (*.json)|*.json'
    );
    if (!filePath) {
        return false;
    }

    const json = await tauriClient.app.ReadVrcRegJsonFile(filePath);
    await tauriClient.app.RegistryBackupImportJson(String(json));
    return true;
}

async function deleteVrcRegistryFolder(): Promise<unknown> {
    requireHostCapability('registryPrefs');
    return tauriClient.app.DeleteVRChatRegistryFolder();
}

async function deleteVrcRegistryBackup(
    key: string
): Promise<RegistryBackupSnapshot[]> {
    requireHostCapability('registryPrefs');
    return tauriClient.app.RegistryBackupDelete(key);
}

export {
    backupVrcRegistry,
    deleteVrcRegistryBackup,
    deleteVrcRegistryFolder,
    listVrcRegistryBackups,
    restoreVrcRegistryBackup,
    restoreVrcRegistryBackupFromFile,
    saveVrcRegistryBackupToFile
};
