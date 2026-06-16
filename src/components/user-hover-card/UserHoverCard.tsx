import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from '@/ui/shadcn/hover-card';

import { UserHoverCardContent } from './UserHoverCardContent';

export function UserHoverCard({
    userId,
    seed = null,
    openDelay = 500,
    closeDelay = 120,
    side = 'left',
    align = 'center',
    disabled = false,
    children
}: any) {
    const [open, setOpen] = useState(false);
    const [scrollClosed, setScrollClosed] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        const handleScroll = (event: Event) => {
            const target = event.target as Element | null;
            if (target?.closest?.('[data-slot="hover-card-content"]')) {
                return;
            }
            setScrollClosed(true);
            setOpen(false);
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [open]);

    if (disabled || !userId) {
        return children;
    }
    return (
        <HoverCard
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setScrollClosed(false);
                }
                setOpen(next);
            }}
            openDelay={openDelay}
            closeDelay={closeDelay}
        >
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent
                className={cn(
                    'w-72 overflow-hidden p-0',
                    scrollClosed && 'data-[state=closed]:!animate-none'
                )}
                side={side}
                align={align}
                sideOffset={8}
            >
                <UserHoverCardContent userId={userId} seed={seed} />
            </HoverCardContent>
        </HoverCard>
    );
}
