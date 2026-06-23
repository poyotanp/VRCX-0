import { useEffect, useState } from 'react';

import { commands } from '@/platform/tauri/bindings';
import { useAssistantChatStore } from '@/state/assistantChatStore';

import type { AssistantConfigStatus } from './assistantTypes';

export function useAssistantConfigStatus(): AssistantConfigStatus | null {
    const open = useAssistantChatStore((state) => state.open);
    const [status, setStatus] = useState<AssistantConfigStatus | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        let active = true;
        commands
            .appAssistantConfigStatus()
            .then((next) => {
                if (active) {
                    setStatus(next);
                }
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [open]);

    return status;
}
