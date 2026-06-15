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
    if (disabled || !userId) {
        return children;
    }
    return (
        <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent
                className="w-72 overflow-hidden p-0"
                side={side}
                align={align}
                sideOffset={8}
            >
                <UserHoverCardContent userId={userId} seed={seed} />
            </HoverCardContent>
        </HoverCard>
    );
}
