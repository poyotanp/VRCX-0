import { EmptyState as AppEmptyState } from '@/components/layout/PageScaffold';
import { ImageCropDialog } from '@/components/media/ImageCropDialog';
import { IMAGE_UPLOAD_ACCEPT } from '@/shared/utils/imageUpload';
import { Input } from '@/ui/shadcn/input';
import { Spinner } from '@/ui/shadcn/spinner';

import { useAvatarDialogState } from './avatar-dialog/useAvatarDialogState';
import { AvatarDialogTabbedView } from './AvatarDialogTabbedView';
import {
    AvatarContentTagsDialog,
    AvatarDetailsDialog
} from './AvatarOwnerEditDialogs';

function AvatarDialogEmptyState({ title, description, loading = false }: any) {
    return (
        <AppEmptyState
            className="min-h-56"
            title={title}
            description={description}
            icon={loading ? Spinner : undefined}
        />
    );
}

export function AvatarDialogContent({ avatarId, seedData = null }: any) {
    const dialogState: any = useAvatarDialogState({ avatarId, seedData });

    if (dialogState.status !== 'ready') {
        return <AvatarDialogEmptyState {...dialogState.emptyState} />;
    }

    const {
        applyCurrentAvatarUpdate,
        avatar,
        avatarActions,
        avatarForView,
        currentEndpoint,
        currentUserId,
        imageCropRequest,
        imageUrl,
        labels,
        ownerEditor,
        refs,
        setImageCropRequest,
        setOwnerEditor,
        viewState
    } = dialogState;

    return (
        <>
            <AvatarDialogTabbedView
                avatar={avatarForView}
                avatarView={viewState}
                imageUrl={imageUrl}
                avatarControls={{
                    onRefresh: () => {
                        avatarActions.refreshAvatarProfile();
                    },
                    onSelect: () => {
                        avatarActions.selectAvatar();
                    },
                    onSelectFallback: () => {
                        avatarActions.selectFallbackAvatar();
                    },
                    onReleaseStatus: (nextStatus: any) => {
                        avatarActions.updateReleaseStatus(nextStatus);
                    },
                    onAvatarBlock: (enabled: any) => {
                        avatarActions.setAvatarBlock(enabled);
                    },
                    onEditMemo: () => {
                        avatarActions.editMemo();
                    },
                    onSaveMemo: (nextMemo: any) =>
                        avatarActions.saveMemo(nextMemo),
                    onOpenCache: () => {
                        avatarActions.openAvatarCacheFolder();
                    },
                    onDeleteCache: () => {
                        avatarActions.deleteAvatarCache();
                    },
                    onUploadGallery: () =>
                        avatarActions.beginAvatarGalleryUpload(),
                    onEditDetails: () => {
                        avatarActions.editAvatarDetails();
                    },
                    onChangeContentTags: () => {
                        avatarActions.changeAvatarContentTags();
                    },
                    onChangeImage: () => {
                        avatarActions.beginAvatarImageUpload();
                    },
                    onCreateImposter: () => {
                        avatarActions.updateAvatarImposter('create');
                    },
                    onDeleteImposter: () => {
                        avatarActions.updateAvatarImposter('delete');
                    },
                    onRegenerateImposter: () => {
                        avatarActions.updateAvatarImposter('regenerate');
                    },
                    onDelete: () => {
                        avatarActions.deleteAvatar();
                    }
                }}
            />
            <AvatarContentTagsDialog
                open={ownerEditor === 'content-tags'}
                avatar={avatar}
                currentUserId={currentUserId}
                endpoint={currentEndpoint}
                onOpenChange={(open: any) =>
                    setOwnerEditor(open ? 'content-tags' : null)
                }
                onSavedCurrentAvatar={(nextAvatar: any) =>
                    applyCurrentAvatarUpdate(nextAvatar)
                }
            />
            <AvatarDetailsDialog
                open={ownerEditor === 'details'}
                avatar={avatar}
                endpoint={currentEndpoint}
                onOpenChange={(open) => setOwnerEditor(open ? 'details' : null)}
                onSavedCurrentAvatar={(nextAvatar) =>
                    applyCurrentAvatarUpdate(nextAvatar)
                }
            />
            <Input
                ref={refs.imageUploadInputRef}
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                className="hidden"
                onChange={avatarActions.onFileChangeAvatarImage}
            />
            <Input
                ref={refs.galleryUploadInputRef}
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                className="hidden"
                onChange={avatarActions.onFileChangeAvatarGallery}
            />
            <ImageCropDialog
                open={Boolean(imageCropRequest)}
                file={imageCropRequest?.file || null}
                aspectRatio={4 / 3}
                title={labels.cropTitle}
                onOpenChange={(open: any) => {
                    if (!open) {
                        setImageCropRequest(null);
                        refs.imageUploadAvatarRef.current = null;
                    }
                }}
                onConfirm={(blob: any) =>
                    avatarActions.confirmAvatarImageUpload(blob)
                }
            />
        </>
    );
}
