import { useEffect, useState } from 'react';

import { commands } from '@/platform/tauri/bindings';
import { useAssistantChatStore } from '@/state/assistantChatStore';

export type AssistantHealth = 'checking' | 'ok' | 'error' | 'unconfigured';

export function useAssistantHealth(configured: boolean): AssistantHealth {
    const open = useAssistantChatStore((state) => state.open);
    const [health, setHealth] = useState<AssistantHealth>('unconfigured');

    useEffect(() => {
        if (!open) {
            return;
        }
        if (!configured) {
            setHealth('unconfigured');
            return;
        }
        let active = true;
        setHealth('checking');
        commands
            .appAssistantListModels('', null)
            .then(() => {
                if (active) {
                    setHealth('ok');
                }
            })
            .catch(() => {
                if (active) {
                    setHealth('error');
                }
            });
        return () => {
            active = false;
        };
    }, [open, configured]);

    return health;
}
