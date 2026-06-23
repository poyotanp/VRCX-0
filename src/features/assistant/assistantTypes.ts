import type {
    AssistantConfigStatus,
    SessionSummary
} from '@/platform/tauri/bindings';

export type { AssistantConfigStatus, SessionSummary };

export interface Entity {
    kind: 'user' | 'world' | string;
    id: string;
    displayName: string;
}

export type ToolCallStatus = 'pending' | 'done' | 'error';

export interface UIToolCall {
    id: string;
    name: string;
    args: string;
    status: ToolCallStatus;
    summary: string;
    entities: Entity[];
}

export interface UIMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    turnId?: string;
    streaming: boolean;
    toolCalls: UIToolCall[];
    error?: string;
}

export interface AssistantDeltaEvent {
    sessionId: string;
    turnId: string;
    seq: number;
    text: string;
}

export interface AssistantToolCallEvent {
    sessionId: string;
    turnId: string;
    seq: number;
    toolCallId: string;
    name: string;
    args: string;
}

export interface AssistantToolResultEvent {
    sessionId: string;
    turnId: string;
    seq: number;
    toolCallId: string;
    ok: boolean;
    summary: string;
    entities: Entity[];
}

export interface AssistantTurnEntitiesEvent {
    sessionId: string;
    turnId: string;
    seq: number;
    entities: Entity[];
}

export interface AssistantDoneEvent {
    sessionId: string;
    turnId: string;
    seq: number;
}

export interface AssistantErrorEvent {
    sessionId: string;
    turnId: string;
    seq: number;
    code: string;
    message: string;
}
