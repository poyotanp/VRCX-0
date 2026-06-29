import { useEffect, useState } from 'react';

import configRepository from '@/repositories/configRepository';

const groupToggleKeys: any = {
    me: 'isFriendsGroupMe',
    favorites: 'isFriendsGroupFavorites',
    online: 'isFriendsGroupOnline',
    active: 'isFriendsGroupActive',
    offline: 'isFriendsGroupOffline',
    sameInstance: 'sidebarGroupByInstanceCollapsed'
};

const defaultGroupState: any = {
    me: true,
    favorites: true,
    online: true,
    active: false,
    offline: true,
    sameInstance: true
};

export function useFriendsSidebarPreferences() {
    const [openGroups, setOpenGroups] = useState(defaultGroupState);
    const [statusPresets, setStatusPresets] = useState<unknown[]>([]);

    useEffect(() => {
        let active = true;
        Promise.all([
            configRepository.getBool(groupToggleKeys.me, true),
            configRepository.getBool(groupToggleKeys.favorites, true),
            configRepository.getBool(groupToggleKeys.online, true),
            configRepository.getBool(groupToggleKeys.active, false),
            configRepository.getBool(groupToggleKeys.offline, true),
            configRepository.getBool(groupToggleKeys.sameInstance, false)
        ])
            .then(
                ([
                    me,
                    favorites,
                    online,
                    activeFriends,
                    offline,
                    sameInstanceCollapsed
                ]: any) => {
                    if (!active) {
                        return;
                    }
                    setOpenGroups({
                        me: Boolean(me),
                        favorites: Boolean(favorites),
                        online: Boolean(online),
                        active: Boolean(activeFriends),
                        offline: Boolean(offline),
                        sameInstance: !sameInstanceCollapsed
                    });
                }
            )
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        configRepository
            .getArray('VRCX_statusPresets', [])
            .then((nextPresets: any) => {
                if (active) {
                    setStatusPresets(
                        Array.isArray(nextPresets) ? nextPresets : []
                    );
                }
            })
            .catch(() => {
                if (active) {
                    setStatusPresets([]);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    function toggleSection(id: any) {
        setOpenGroups((current: any) => {
            const next: any = {
                ...current,
                [id]: !current[id]
            };
            const configKey = groupToggleKeys[id];
            if (configKey) {
                configRepository.setBool(
                    configKey,
                    id === 'sameInstance' ? !next[id] : next[id]
                );
            }
            return next;
        });
    }

    return { openGroups, statusPresets, toggleSection };
}
