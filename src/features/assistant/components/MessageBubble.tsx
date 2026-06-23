import { cn } from '@/lib/utils';

import type { UIMessage } from '../assistantTypes';
import { AssistantMarkdown } from './AssistantMarkdown';
import { ToolCallChip } from './ToolCallChip';

interface MessageBubbleProps {
    message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';

    return (
        <div
            className={cn(
                'flex flex-col gap-1.5',
                isUser ? 'items-end' : 'items-start'
            )}
        >
            {message.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {message.toolCalls.map((call) => (
                        <ToolCallChip key={call.id} toolCall={call} />
                    ))}
                </div>
            )}

            {(message.text || message.streaming) && (
                <div
                    className={cn(
                        'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                        isUser
                            ? 'bg-secondary text-secondary-foreground whitespace-pre-wrap'
                            : 'bg-card/50 text-foreground'
                    )}
                >
                    {isUser ? (
                        message.text
                    ) : (
                        <AssistantMarkdown text={message.text} />
                    )}
                    {message.streaming && (
                        <span className="bg-foreground/60 ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle" />
                    )}
                </div>
            )}

            {message.error && (
                <div className="bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs">
                    {message.error}
                </div>
            )}
        </div>
    );
}
