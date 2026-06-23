import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { openExternalLink } from '@/services/entityMediaService';

const markdownComponents: Components = {
    p: ({ children }) => (
        <p className="my-1 first:mt-0 last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
        <ul className="my-1 list-disc pl-5 first:mt-0 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="my-1 list-decimal pl-5 first:mt-0 last:mb-0">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="my-0.5">{children}</li>,
    strong: ({ children }) => (
        <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => (
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre className="bg-muted my-1.5 overflow-x-auto rounded-md p-2 font-mono text-xs">
            {children}
        </pre>
    ),
    a: ({ href, children }) => (
        <a
            className="text-primary underline underline-offset-2"
            onClick={(event) => {
                event.preventDefault();
                if (href) {
                    openExternalLink(href);
                }
            }}
        >
            {children}
        </a>
    ),
    h1: ({ children }) => (
        <h1 className="mt-2 mb-1 text-base font-semibold">{children}</h1>
    ),
    h2: ({ children }) => (
        <h2 className="mt-2 mb-1 text-sm font-semibold">{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 className="mt-2 mb-1 text-sm font-medium">{children}</h3>
    ),
    blockquote: ({ children }) => (
        <blockquote className="border-border/60 text-muted-foreground my-1 border-l-2 pl-2">
            {children}
        </blockquote>
    )
};

interface AssistantMarkdownProps {
    text: string;
}

export function AssistantMarkdown({ text }: AssistantMarkdownProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
        >
            {text}
        </ReactMarkdown>
    );
}
