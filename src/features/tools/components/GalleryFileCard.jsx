import { CheckIcon, ImageIcon, Trash2Icon } from 'lucide-react';

import { cn } from '@/lib/utils.js';
import { extractFileId } from '@/shared/utils/fileUtils.js';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Card, CardContent } from '@/ui/shadcn/card';

import { GalleryEmojiImage } from './GalleryEmojiImage.jsx';

function getLatestFileUrl(file) {
    const versions = Array.isArray(file?.versions) ? file.versions : [];
    return versions.at(-1)?.file?.url ?? '';
}

function getUsefulDisplayName(file) {
    const displayName = String(file?.displayName || '').trim();
    const name = String(file?.name || '').trim();
    const id = String(file?.id || '').trim();
    const visibleName = displayName || name;

    if (!visibleName || visibleName === id || /^file_[\w-]+_blob$/i.test(visibleName)) {
        return '';
    }

    return visibleName;
}

export function GalleryFileCard({
    t,
    tab,
    definition,
    file,
    profilePicOverride,
    userIcon,
    mutatingKey,
    isVrcPlusSupporter,
    currentUserId,
    densityConfig,
    onPreview,
    onSetProfileField,
    onDeleteFile
}) {
    const imageUrl = getLatestFileUrl(file);
    const displayName = getUsefulDisplayName(file);
    const hasMetadata = Boolean(displayName || tab === 'emojis');
    const activeFileId =
        tab === 'gallery'
            ? extractFileId(profilePicOverride)
            : extractFileId(userIcon);
    const profileField =
        tab === 'gallery'
            ? 'profilePicOverride'
            : tab === 'icons'
              ? 'userIcon'
              : '';
    const isCurrent = activeFileId === file.id;
    const isFileMutating = mutatingKey === `${tab}:${file.id}`;
    const isProfileMutating = profileField
        ? mutatingKey === `${profileField}:${file.id}` ||
          mutatingKey === `${profileField}:clear`
        : false;
    const isMutating = isFileMutating || isProfileMutating;

    return (
        <Card
            className={cn(
                'overflow-hidden',
                isCurrent && 'ring-primary ring-2'
            )}
        >
            {imageUrl ? (
                <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full rounded-none p-0"
                    onClick={() =>
                        onPreview({
                            id: file.id,
                            title: displayName || t(definition.titleKey),
                            url: imageUrl
                        })
                    }
                >
                    <GalleryEmojiImage
                        file={tab === 'emojis' ? file : null}
                        imageUrl={imageUrl}
                        alt={file.displayName || file.name || file.id}
                        className={cn(definition.aspectClass, 'w-full')}
                    />
                </Button>
            ) : (
                <div
                    className={cn(
                        'bg-muted text-muted-foreground flex w-full items-center justify-center',
                        definition.aspectClass
                    )}
                >
                    <ImageIcon className="size-8" />
                </div>
            )}
            <CardContent className={densityConfig.contentClass}>
                {hasMetadata ? (
                    <div className={densityConfig.metaClass}>
                        {displayName ? (
                            <div className="line-clamp-1 text-sm font-medium">
                                {displayName}
                            </div>
                        ) : null}
                        {tab === 'emojis' ? (
                            <div className="text-muted-foreground flex flex-wrap gap-1 text-xs">
                                {file.loopStyle ? (
                                    <Badge variant="outline">
                                        {file.loopStyle}
                                    </Badge>
                                ) : null}
                                {file.animationStyle ? (
                                    <Badge variant="outline">
                                        {file.animationStyle}
                                    </Badge>
                                ) : null}
                                {file.framesOverTime ? (
                                    <Badge variant="outline">
                                        {file.framesOverTime}
                                        {t('view.tools.generated.fps')}
                                    </Badge>
                                ) : null}
                                {file.frames ? (
                                    <Badge variant="outline">
                                        {file.frames}
                                        {t('view.tools.generated.frames')}
                                    </Badge>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
                <div className={densityConfig.actionsClass}>
                    {profileField ? (
                        <Button
                            variant={isCurrent ? 'default' : 'outline'}
                            size="sm"
                            className={densityConfig.actionButtonClass}
                            disabled={
                                !isVrcPlusSupporter ||
                                isMutating ||
                                !currentUserId
                            }
                            onClick={() =>
                                onSetProfileField(profileField, file.id)
                            }
                        >
                            <CheckIcon data-icon="inline-start" />
                            {tab === 'icons' ? 'Icon' : 'Profile'}
                        </Button>
                    ) : null}
                    <Button
                        variant="destructive"
                        size="sm"
                        className={densityConfig.actionButtonClass}
                        disabled={isMutating}
                        onClick={() => onDeleteFile(tab, file.id)}
                    >
                        <Trash2Icon data-icon="inline-start" />
                        {t('common.actions.delete')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
