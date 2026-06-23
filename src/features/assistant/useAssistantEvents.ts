import { useEffect } from 'react';

import { tauriClient } from '@/platform/tauri/client';
import {
    recordAssistantToolError,
    recordAssistantTurnError
} from '@/services/telemetry/telemetryAssistantHealth';
import { useAssistantChatStore } from '@/state/assistantChatStore';

import type {
    AssistantDeltaEvent,
    AssistantDoneEvent,
    AssistantErrorEvent,
    AssistantToolCallEvent,
    AssistantToolResultEvent,
    AssistantTurnEntitiesEvent
} from './assistantTypes';

const EVENT_NAMES = [
    'assistantDelta',
    'assistantToolCall',
    'assistantToolResult',
    'assistantTurnEntities',
    'assistantDone',
    'assistantError'
] as const;

export function useAssistantEvents(): void {
    useEffect(() => {
        const store = useAssistantChatStore.getState();
        const unsubscribers: Array<() => void> = [];
        let active = true;

        const handlers: Record<string, (payload: unknown) => void> = {
            assistantDelta: (payload) =>
                store.applyDelta(payload as AssistantDeltaEvent),
            assistantToolCall: (payload) =>
                store.applyToolCall(payload as AssistantToolCallEvent),
            assistantToolResult: (payload) => {
                const event = payload as AssistantToolResultEvent;
                store.applyToolResult(event);
                if (!event.ok) {
                    recordAssistantToolError();
                }
            },
            assistantTurnEntities: (payload) =>
                store.applyTurnEntities(payload as AssistantTurnEntitiesEvent),
            assistantDone: (payload) =>
                store.applyDone(payload as AssistantDoneEvent),
            assistantError: (payload) => {
                const event = payload as AssistantErrorEvent;
                store.applyError(event);
                recordAssistantTurnError(event.code);
            }
        };

        for (const name of EVENT_NAMES) {
            tauriClient.events
                .subscribe<unknown>(name, handlers[name])
                .then((unsubscribe) => {
                    if (active) {
                        unsubscribers.push(unsubscribe);
                    } else {
                        unsubscribe();
                    }
                })
                .catch(() => {});
        }

        return () => {
            active = false;
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        };
    }, []);
}
