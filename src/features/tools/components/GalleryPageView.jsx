export function GalleryPageView({
    GalleryHeader,
    t,
    uploadInputRef,
    uploadingTab,
    uploadSelectedFile,
    gridDensity,
    changeGridDensity,
    navigate,
    refreshAll,
    GalleryTabsSection,
    setActiveTab,
    beginUpload,
    setProfileField,
    consumeInventoryBundle,
    openExternalLink,
    deleteFileAsset,
    deletePrint,
    setEmojiAnimationStyle,
    setEmojiAnimFps,
    setEmojiAnimFrameCount,
    setEmojiAnimLoopPingPong,
    setEmojiAnimType,
    setPrintCropBorder,
    setPrintUploadNote,
    redeemReward,
    refreshTab,
    activeTab,
    assets,
    currentUserId,
    emojiAnimFps,
    emojiAnimFrameCount,
    emojiAnimLoopPingPong,
    emojiAnimationStyle,
    emojiAnimType,
    galleryLimits,
    gridDensityConfig,
    isVrcPlusSupporter,
    loadingByTab,
    mutatingKey,
    printCropBorder,
    printUploadNote,
    profilePicOverride,
    tabCounts,
    userIcon,
    GalleryDialogs,
    cropRequest,
    setCropRequest,
    confirmCroppedUpload,
    openImagePreview,
    uploadAuthTargetRef
}) {
    return (
        <div className="gallery-page x-container flex min-h-0 flex-1 flex-col p-6">
            <GalleryHeader
                t={t}
                uploadInputRef={uploadInputRef}
                uploadingTab={uploadingTab}
                onUploadChange={(event) => void uploadSelectedFile(event)}
                gridDensity={gridDensity}
                onGridDensityChange={changeGridDensity}
                onBack={() => navigate('/tools')}
                onRefreshAll={() => void refreshAll()}
            />

            <GalleryTabsSection
                t={t}
                handlers={{
                    onActiveTabChange: setActiveTab,
                    onBeginUpload: beginUpload,
                    onClearProfileField: (fieldName, fileId) =>
                        void setProfileField(fieldName, fileId),
                    onConsumeBundle: (inventoryId) =>
                        void consumeInventoryBundle(inventoryId),
                    onCreateAnimatedEmoji: () =>
                        void openExternalLink('https://vrcemoji.com'),
                    onDeleteFile: (tab, fileId) =>
                        void deleteFileAsset(tab, fileId),
                    onDeletePrint: (printId) => void deletePrint(printId),
                    onEmojiAnimationStyleChange: setEmojiAnimationStyle,
                    onEmojiAnimFpsChange: setEmojiAnimFps,
                    onEmojiAnimFrameCountChange: setEmojiAnimFrameCount,
                    onEmojiAnimLoopPingPongChange: setEmojiAnimLoopPingPong,
                    onEmojiAnimTypeChange: setEmojiAnimType,
                    onPreview: openImagePreview,
                    onPrintCropBorderChange: setPrintCropBorder,
                    onPrintUploadNoteChange: setPrintUploadNote,
                    onRedeem: () => void redeemReward(),
                    onRefresh: (tab) => void refreshTab(tab),
                    onSetProfileField: (fieldName, fileId) =>
                        void setProfileField(fieldName, fileId)
                }}
                state={{
                    activeTab,
                    assets,
                    currentUserId,
                    emojiAnimFps,
                    emojiAnimFrameCount,
                    emojiAnimLoopPingPong,
                    emojiAnimationStyle,
                    emojiAnimType,
                    galleryLimits,
                    gridDensityConfig,
                    isVrcPlusSupporter,
                    loadingByTab,
                    mutatingKey,
                    printCropBorder,
                    printUploadNote,
                    profilePicOverride,
                    tabCounts,
                    uploadingTab,
                    userIcon
                }}
            />

            <GalleryDialogs
                cropRequest={cropRequest}
                onClearCropRequest={() => setCropRequest(null)}
                onConfirmCrop={(blob) => confirmCroppedUpload(blob)}
                onResetUploadAuthTarget={() => {
                    uploadAuthTargetRef.current = null;
                }}
                t={t}
            />
        </div>
    );
}
