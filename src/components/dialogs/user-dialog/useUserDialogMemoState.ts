import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import memoPersistenceRepository from '@/repositories/memoPersistenceRepository';
import vrchatToolsRepository from '@/repositories/vrchatToolsRepository';

import { normalizeUserId } from './userProfileFields';

function createMemoDialogState() {
    return {
        open: false,
        targetUserId: '',
        targetEndpoint: '',
        targetLabel: '',
        editingCurrentUser: false,
        originalNote: '',
        note: '',
        memo: '',
        saving: false
    };
}

export function useUserDialogMemoState({
    activeUserTargetRef,
    applyFriendPatch,
    currentEndpoint,
    friendsById,
    isCurrentUser,
    normalizedUserId,
    profile,
    setBaseProfile,
    t
}: any) {
    const [memo, setMemo] = useState('');
    const [memoDialog, setMemoDialog] = useState(createMemoDialogState);
    const memoRevisionRef = useRef(0);

    useEffect(() => {
        let active = true;

        if (!normalizedUserId) {
            setMemo('');
            return () => {
                active = false;
            };
        }

        setMemo('');
        const revision = memoRevisionRef.current;
        memoPersistenceRepository
            .getUserMemo(normalizedUserId)
            .then((entry: any) => {
                if (active && memoRevisionRef.current === revision) {
                    setMemo(entry?.memo || '');
                }
            })
            .catch(() => {
                if (active && memoRevisionRef.current === revision) {
                    setMemo('');
                }
            });

        return () => {
            active = false;
        };
    }, [normalizedUserId]);

    async function editMemo() {
        const targetProfile = profile;
        const targetUserId = normalizeUserId(targetProfile?.id);
        if (!targetUserId) {
            return;
        }

        const originalNote = String(targetProfile.note || '').slice(0, 256);
        setMemoDialog({
            ...createMemoDialogState(),
            open: true,
            targetUserId,
            targetEndpoint: currentEndpoint,
            targetLabel: targetProfile.displayName || targetProfile.id || '',
            editingCurrentUser: Boolean(isCurrentUser),
            originalNote,
            note: originalNote,
            memo
        });
    }

    async function saveMemoDialog() {
        const dialog = memoDialog;
        const targetUserId = normalizeUserId(dialog.targetUserId);
        const targetEndpoint = dialog.targetEndpoint;
        if (!targetUserId || dialog.saving) {
            return;
        }

        const nextNote = String(dialog.note || '').slice(0, 256);
        const nextMemoInput = String(dialog.memo || '');
        const nextProfileNote = dialog.editingCurrentUser
            ? dialog.originalNote
            : nextNote;

        memoRevisionRef.current += 1;
        setMemoDialog((current: any) => ({
            ...current,
            saving: true
        }));
        try {
            if (
                !dialog.editingCurrentUser &&
                nextNote !== dialog.originalNote
            ) {
                await vrchatToolsRepository.saveUserNote(
                    {
                        targetUserId,
                        note: nextNote
                    },
                    { endpoint: targetEndpoint }
                );
            }
            const nextEntry = await memoPersistenceRepository.saveUserMemo({
                userId: targetUserId,
                memo: nextMemoInput
            });
            setMemoDialog(createMemoDialogState());
            if (
                activeUserTargetRef.current.userId !== targetUserId ||
                activeUserTargetRef.current.endpoint !== targetEndpoint
            ) {
                return;
            }
            const nextMemo = String(nextEntry.memo || '');
            const rosterUserId = targetUserId;
            setMemo(nextMemo);
            setBaseProfile((currentProfile: any) =>
                normalizeUserId(currentProfile?.id) === targetUserId
                    ? {
                          ...currentProfile,
                          note: nextProfileNote,
                          memo: nextMemo,
                          $nickName: nextMemo
                      }
                    : currentProfile
            );
            if (rosterUserId && friendsById[rosterUserId]) {
                applyFriendPatch({
                    userId: rosterUserId,
                    patch: {
                        note: nextProfileNote,
                        memo: nextMemo,
                        $nickName: nextMemo
                    },
                    stateBucket:
                        friendsById[rosterUserId]?.stateBucket ||
                        friendsById[rosterUserId]?.state
                });
            }
            toast.success(
                nextMemo
                    ? t('dialog.user.toast.memo_saved')
                    : t('dialog.user.toast.memo_cleared')
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.user.toast.failed_to_save_memo')
            );
            setMemoDialog((current: any) => ({
                ...current,
                saving: false
            }));
        }
    }

    return {
        editMemo,
        memo,
        memoDialog: {
            ...memoDialog,
            onOpenChange(open: boolean) {
                if (!open && !memoDialog.saving) {
                    setMemoDialog(createMemoDialogState());
                }
            },
            onCancel() {
                if (!memoDialog.saving) {
                    setMemoDialog(createMemoDialogState());
                }
            },
            onMemoChange(nextMemo: string) {
                setMemoDialog((current: any) => ({
                    ...current,
                    memo: nextMemo
                }));
            },
            onNoteChange(nextNote: string) {
                setMemoDialog((current: any) => ({
                    ...current,
                    note: nextNote.slice(0, 256)
                }));
            },
            onSave: saveMemoDialog
        }
    };
}
