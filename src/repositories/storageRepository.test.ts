import { beforeEach, describe, expect, it, vi } from 'vitest';

const commandMocks = vi.hoisted(() => ({
    storageGet: vi.fn(),
    storageSet: vi.fn(),
    storageRemove: vi.fn(),
    storageGetAll: vi.fn(),
    storageFlush: vi.fn()
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: commandMocks
}));

import { StorageRepository } from './storageRepository';

describe('StorageRepository', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        commandMocks.storageGet.mockResolvedValue(null);
        commandMocks.storageSet.mockResolvedValue(undefined);
        commandMocks.storageRemove.mockResolvedValue(undefined);
        commandMocks.storageGetAll.mockResolvedValue({});
        commandMocks.storageFlush.mockResolvedValue(undefined);
    });

    it('applies nested prefixes to reads, writes, and JSON values', async () => {
        const repository = new StorageRepository('tool:').withPrefix('gallery:');
        commandMocks.storageGet.mockResolvedValueOnce('{"columns":["name"]}');

        await expect(
            repository.getJson('state', { columns: [] })
        ).resolves.toEqual({
            columns: ['name']
        });
        await repository.setJson('state', { columns: ['updated'] });

        expect(commandMocks.storageGet).toHaveBeenCalledWith(
            'tool:gallery:state'
        );
        expect(commandMocks.storageSet).toHaveBeenCalledWith(
            'tool:gallery:state',
            '{"columns":["updated"]}'
        );
    });

    it('uses fallbacks for undefined sentinel values and invalid JSON', async () => {
        const repository = new StorageRepository();
        commandMocks.storageGet
            .mockResolvedValueOnce('undefined')
            .mockResolvedValueOnce('{bad-json');

        await expect(repository.getString('missing', 'fallback')).resolves.toBe(
            'fallback'
        );
        await expect(repository.getJson('broken', ['fallback'])).resolves.toEqual(
            ['fallback']
        );
    });

    it('checks existence without treating the string undefined as present', async () => {
        const repository = new StorageRepository();
        commandMocks.storageGet
            .mockResolvedValueOnce('value')
            .mockResolvedValueOnce('undefined');

        await expect(repository.has('present')).resolves.toBe(true);
        await expect(repository.has('missing')).resolves.toBe(false);
    });

    it('clears only keys under its prefix and flushes storage', async () => {
        const repository = new StorageRepository('tool:');
        commandMocks.storageGetAll.mockResolvedValueOnce({
            'tool:a': '1',
            'tool:b': '2',
            other: '3'
        });

        await repository.clear();

        expect(commandMocks.storageRemove).toHaveBeenCalledTimes(2);
        expect(commandMocks.storageRemove).toHaveBeenCalledWith('tool:a');
        expect(commandMocks.storageRemove).toHaveBeenCalledWith('tool:b');
        expect(commandMocks.storageFlush).toHaveBeenCalledTimes(1);
    });
});
