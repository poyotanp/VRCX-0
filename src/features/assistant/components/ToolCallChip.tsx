import { CheckIcon, LoaderIcon, WrenchIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { UIToolCall } from '../assistantTypes';

interface ToolCallChipProps {
    toolCall: UIToolCall;
}

function formatToolName(name: string): string {
    const spaced = name.replace(/_/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function ToolCallChip({ toolCall }: ToolCallChipProps) {
    const { t } = useTranslation();
    const prettyName = formatToolName(toolCall.name);
    const label =
        toolCall.status === 'pending'
            ? t('assistant.tool_running', { name: prettyName })
            : prettyName;

    return (
        <div
            className={cn(
                'border-border/50 bg-card/30 flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                toolCall.status === 'error'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
            )}
            title={toolCall.summary || undefined}
        >
            {toolCall.status === 'pending' ? (
                <LoaderIcon className="size-3 animate-spin" />
            ) : toolCall.status === 'error' ? (
                <XIcon className="size-3" />
            ) : (
                <CheckIcon className="size-3" />
            )}
            <WrenchIcon className="size-3 opacity-60" />
            <span className="font-mono">{label}</span>
        </div>
    );
}
