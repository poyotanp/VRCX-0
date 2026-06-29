import { useRef, useState } from 'react';

export type FriendUserLoadProgress = {
    current: number;
    total: number;
    open: boolean;
    cancelled: boolean;
};

export function useFriendListUserLoadDialog() {
    const cancelUserLoadRef = useRef(false);
    const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);
    const [userLoadProgress, setUserLoadProgress] =
        useState<FriendUserLoadProgress>({
            current: 0,
            total: 0,
            open: false,
            cancelled: false
        });
    const userLoadPercent = userLoadProgress.total
        ? Math.min(
              100,
              Math.round(
                  (userLoadProgress.current / userLoadProgress.total) * 100
              )
          )
        : 0;

    function cancelFriendUserDetailsLoad() {
        cancelUserLoadRef.current = true;
        setUserLoadProgress((current) => ({
            ...current,
            open: false,
            cancelled: true
        }));
    }

    return {
        cancelUserLoadRef,
        isLoadingUserDetails,
        userLoadPercent,
        userLoadProgress,
        cancelFriendUserDetailsLoad,
        setIsLoadingUserDetails,
        setUserLoadProgress
    };
}
