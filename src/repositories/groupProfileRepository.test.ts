import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauriMock = vi.hoisted(() => ({
    commands: {
        appVrchatGroupGet: vi.fn(),
        appVrchatGroupLogsGet: vi.fn()
    }
}));

vi.mock('@/platform/tauri/bindings', () => ({ commands: tauriMock.commands }));

import groupProfileRepository, { normalize } from './groupProfileRepository';

describe('GroupProfileRepository', () => {
    beforeEach(() => {
        for (const command of Object.values(tauriMock.commands)) {
            command.mockReset();
            command.mockResolvedValue({
                status: 200,
                data: '{"ok":true}',
                raw: {}
            });
        }
    });

    it('normalizes group profile fields, counts, roles, and public group URL', () => {
        expect(
            normalize({
                groupId: ' grp_123 ',
                name: ' Test Group ',
                description: '  Description  ',
                rules: '  Rules  ',
                shortCode: 'VRCX',
                discriminator: '1234',
                bannerUrl: ' banner.png ',
                iconUrl: ' icon.png ',
                memberCount: '42',
                onlineMemberCount: '7',
                ownerId: ' usr_owner ',
                privacy: ' public ',
                membershipStatus: ' member ',
                languages: [' eng ', '', null],
                links: [' https://example.test ', undefined],
                tags: [' tag ', ''],
                roles: [
                    {
                        id: ' role_1 ',
                        name: ' Admin ',
                        description: ' Full access ',
                        permissions: [' group-members-manage ', null, '']
                    },
                    null
                ]
            })
        ).toMatchObject({
            id: 'grp_123',
            name: 'Test Group',
            description: 'Description',
            rules: 'Rules',
            shortCode: 'VRCX',
            discriminator: '1234',
            url: 'https://vrc.group/VRCX.1234',
            bannerUrl: 'banner.png',
            iconUrl: 'icon.png',
            memberCount: 42,
            onlineMemberCount: 7,
            ownerId: 'usr_owner',
            privacy: 'public',
            membershipStatus: 'member',
            languages: ['eng'],
            links: ['https://example.test'],
            tags: ['tag'],
            roles: [
                {
                    id: 'role_1',
                    name: 'Admin',
                    description: 'Full access',
                    permissions: ['group-members-manage']
                }
            ]
        });
    });

    it('unwraps string error bodies from failed group requests', async () => {
        tauriMock.commands.appVrchatGroupGet.mockResolvedValue({
            status: 403,
            data: '"Forbidden"',
            raw: {}
        });

        await expect(
            groupProfileRepository.getGroupProfile({
                groupId: 'grp_123',
                force: true
            })
        ).rejects.toMatchObject({
            message: 'Forbidden',
            status: 403,
            endpoint: 'groups/grp_123',
            payload: 'Forbidden'
        });
    });

    it('collects group logs by hasNext and deduplicates by id', async () => {
        tauriMock.commands.appVrchatGroupLogsGet
            .mockResolvedValueOnce({
                status: 200,
                data: JSON.stringify({
                    hasNext: true,
                    results: [
                        {
                            id: 'log_1',
                            description: 'first page'
                        }
                    ],
                    totalCount: 3
                }),
                raw: {}
            })
            .mockResolvedValueOnce({
                status: 200,
                data: JSON.stringify({
                    hasNext: false,
                    results: [
                        {
                            id: 'log_1',
                            description: 'duplicate'
                        },
                        {
                            id: 'log_2',
                            description: 'second page'
                        }
                    ],
                    totalCount: 3
                }),
                raw: {}
            });

        const rows = await groupProfileRepository.getAllGroupLogs({
            groupId: 'grp_123',
            eventTypes: ['group.member.ban', 'group.member.kick']
        });

        expect(rows.map((row) => row.id)).toEqual(['log_1', 'log_2']);
        expect(tauriMock.commands.appVrchatGroupLogsGet).toHaveBeenCalledTimes(
            2
        );
        expect(
            tauriMock.commands.appVrchatGroupLogsGet
        ).toHaveBeenNthCalledWith(1, {
            groupId: 'grp_123',
            n: 100,
            offset: 0,
            eventTypes: 'group.member.ban,group.member.kick',
            endpoint: ''
        });
        expect(
            tauriMock.commands.appVrchatGroupLogsGet
        ).toHaveBeenNthCalledWith(2, {
            groupId: 'grp_123',
            n: 100,
            offset: 100,
            eventTypes: 'group.member.ban,group.member.kick',
            endpoint: ''
        });
    });

    it('keeps getGroupLogs compatible with row-array callers', async () => {
        tauriMock.commands.appVrchatGroupLogsGet.mockResolvedValue({
            status: 200,
            data: JSON.stringify({
                hasNext: false,
                results: [
                    {
                        id: 'log_rows',
                        eventType: 'group.member.remove'
                    }
                ],
                totalCount: 1
            }),
            raw: {}
        });

        await expect(
            groupProfileRepository.getGroupLogs({
                groupId: 'grp_123',
                eventTypes: ['group.member.remove']
            })
        ).resolves.toEqual([
            {
                id: 'log_rows',
                eventType: 'group.member.remove'
            }
        ]);

        expect(tauriMock.commands.appVrchatGroupLogsGet).toHaveBeenCalledWith({
            groupId: 'grp_123',
            n: 100,
            offset: 0,
            eventTypes: 'group.member.remove',
            endpoint: ''
        });
    });
});
