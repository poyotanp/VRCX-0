import {
    getGroupRoleNameMap,
    groupModerationTabPermissions,
    hasGroupPermission,
    type GroupModerationTabValue
} from './groupDialogUtils';

type TranslateFn = (key: string) => string;

export interface GroupModerationTab {
    disabled: boolean;
    label: string;
    value: GroupModerationTabValue;
}

const GROUP_MODERATION_TAB_LABELS: Array<{
    labelKey: string;
    value: GroupModerationTabValue;
}> = [
    {
        value: 'members',
        labelKey: 'dialog.group_member_moderation.members'
    },
    { value: 'bans', labelKey: 'dialog.group_member_moderation.bans' },
    {
        value: 'invites',
        labelKey: 'dialog.group_member_moderation.invites'
    },
    {
        value: 'requests',
        labelKey: 'dialog.group_member_moderation.join_requests'
    },
    {
        value: 'blocked',
        labelKey: 'dialog.group_member_moderation.blocked_requests'
    },
    { value: 'logs', labelKey: 'dialog.group_member_moderation.logs' }
];

export function getGroupModerationTabs(
    t: TranslateFn,
    group?: unknown
): GroupModerationTab[] {
    return GROUP_MODERATION_TAB_LABELS.map((tab) => {
        const permissions = groupModerationTabPermissions(tab.value);
        return {
            value: tab.value,
            label: t(tab.labelKey),
            disabled: Boolean(
                group &&
                permissions.length &&
                !permissions.some((permission) =>
                    hasGroupPermission(group, permission)
                )
            )
        };
    });
}

export function resolveGroupModerationActiveTab(
    activeTab: string,
    tabs: GroupModerationTab[]
) {
    const currentTab = tabs.find((tab) => tab.value === activeTab);
    if (currentTab && !currentTab.disabled) {
        return currentTab.value;
    }
    return tabs.find((tab) => !tab.disabled)?.value || '';
}

export function moderationRowUserId(row: any) {
    return (
        row?.userId || row?.targetUserId || row?.user?.id || row?.actorId || ''
    );
}

export function moderationRowLabel(row: any) {
    if (!row || typeof row !== 'object') {
        return String(row ?? '—');
    }
    return (
        row?.user?.displayName ||
        row?.displayName ||
        row?.targetDisplayName ||
        row?.actorDisplayName ||
        row?.userId ||
        row?.targetUserId ||
        row?.actorId ||
        row?.id ||
        '—'
    );
}

export function moderationRowSubtitle(row: any) {
    return [
        row?.roleIds?.length ? row.roleIds.join(', ') : '',
        row?.action ||
            row?.eventType ||
            row?.type ||
            row?.membershipStatus ||
            '',
        row?.createdAt || row?.updatedAt || row?.joinedAt || ''
    ]
        .filter(Boolean)
        .join(' | ');
}

export function moderationRowRoles(row: any, group: any) {
    const roles = getGroupRoleNameMap(group);
    const roleIds = Array.isArray(row?.roleIds)
        ? row.roleIds
        : Array.isArray(row?.user?.roleIds)
          ? row.user.roleIds
          : [];
    return roleIds
        .map((roleId: any) => roles.get(roleId) || 'Role')
        .filter(Boolean)
        .join(', ');
}

export function moderationRowStatus(row: any) {
    return (
        row?.action ||
        row?.eventType ||
        row?.type ||
        row?.membershipStatus ||
        row?.visibility ||
        '—'
    );
}

export function moderationRowDate(row: any) {
    return (
        row?.createdAt ||
        row?.created_at ||
        row?.updatedAt ||
        row?.updated_at ||
        row?.joinedAt ||
        row?.joined_at ||
        ''
    );
}

export function moderationRowSearchText(row: any, group: any) {
    return [
        moderationRowLabel(row),
        moderationRowUserId(row),
        moderationRowRoles(row, group),
        moderationRowStatus(row),
        moderationRowDate(row),
        row?.description,
        row?.note,
        row?.managerNotes
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export function getGroupModerationActions(tabValue: any, row: any, t: any) {
    const userId = moderationRowUserId(row);
    if (!userId) {
        return [];
    }
    if (tabValue === 'members') {
        return [
            {
                key: 'kick',
                label: t('dialog.group_member_moderation.kick'),
                destructive: true
            },
            {
                key: 'ban',
                label: t('dialog.group_member_moderation.ban'),
                destructive: true
            }
        ];
    }
    if (tabValue === 'bans') {
        return [
            {
                key: 'unban',
                label: t('dialog.group_member_moderation.unban')
            }
        ];
    }
    if (tabValue === 'invites') {
        return [
            {
                key: 'delete-invite',
                label: t('dialog.group_member_moderation.delete'),
                destructive: true
            }
        ];
    }
    if (tabValue === 'requests') {
        return [
            {
                key: 'accept-request',
                label: t('dialog.group_member_moderation.accept')
            },
            {
                key: 'reject-request',
                label: t('dialog.group_member_moderation.reject'),
                destructive: true
            },
            {
                key: 'block-request',
                label: t('dialog.group_member_moderation.block'),
                destructive: true
            }
        ];
    }
    if (tabValue === 'blocked') {
        return [
            {
                key: 'delete-blocked',
                label: t('dialog.group_member_moderation.delete'),
                destructive: true
            }
        ];
    }
    return [];
}
