import { useRef, useState } from 'react';

import avatarSearchProviderRepository from '@/repositories/avatarSearchProviderRepository';

type AvatarProviderConfig = Awaited<
    ReturnType<typeof avatarSearchProviderRepository.saveConfig>
> & {
    [key: string]: unknown;
};

export function useAvatarProviderConfig({ commit }: any) {
    const [avatarProviderConfig, setAvatarProviderConfig] =
        useState<AvatarProviderConfig>({
            enabled: true,
            providerList: [],
            selectedProvider: ''
        });
    const avatarProviderConfigRef = useRef(avatarProviderConfig);
    const avatarProviderSaveQueueRef = useRef<Promise<any>>(Promise.resolve());
    const avatarProviderSaveSeqRef = useRef(0);

    function applyAvatarProviderConfig(nextConfig: any) {
        avatarProviderConfigRef.current = nextConfig;
        setAvatarProviderConfig(nextConfig);
    }

    async function saveAvatarProviderConfig(nextConfig: any) {
        const saveSeq = avatarProviderSaveSeqRef.current + 1;
        avatarProviderSaveSeqRef.current = saveSeq;
        const saveTask = avatarProviderSaveQueueRef.current
            .catch(() => {})
            .then(() => avatarSearchProviderRepository.saveConfig(nextConfig));

        avatarProviderSaveQueueRef.current = saveTask.catch(() => {});
        const saved = await saveTask;
        if (saveSeq === avatarProviderSaveSeqRef.current) {
            applyAvatarProviderConfig(saved);
        }
        return saved;
    }

    function updateAvatarProvider(index: any, value: any) {
        setAvatarProviderConfig((current: any) => ({
            ...current,
            providerList: current.providerList.map(
                (provider: any, providerIndex: any) =>
                    providerIndex === index ? value : provider
            )
        }));
        avatarProviderConfigRef.current = {
            ...avatarProviderConfigRef.current,
            providerList: avatarProviderConfigRef.current.providerList.map(
                (provider: any, providerIndex: any) =>
                    providerIndex === index ? value : provider
            )
        };
    }

    function saveAvatarProviderField(index: any, value: any) {
        const currentConfig = avatarProviderConfigRef.current;
        const providerList = currentConfig.providerList.map(
            (provider: any, providerIndex: any) =>
                providerIndex === index ? value : provider
        );
        const nextConfig: any = {
            ...currentConfig,
            enabled:
                currentConfig.enabled &&
                providerList.some((provider: any) => provider.trim()),
            providerList
        };
        applyAvatarProviderConfig(nextConfig);
        commit(() =>
            saveAvatarProviderConfig({
                ...nextConfig
            })
        );
    }

    function addAvatarProvider() {
        const nextConfig: any = {
            ...avatarProviderConfigRef.current,
            providerList: [...avatarProviderConfigRef.current.providerList, '']
        };
        applyAvatarProviderConfig(nextConfig);
    }

    function removeAvatarProvider(index: any) {
        const currentConfig = avatarProviderConfigRef.current;
        const nextProviderList = currentConfig.providerList.filter(
            (_: any, providerIndex: any) => providerIndex !== index
        );
        const nextConfig: any = {
            ...currentConfig,
            enabled: currentConfig.enabled && nextProviderList.length > 0,
            providerList: nextProviderList
        };
        applyAvatarProviderConfig(nextConfig);
        commit(() => saveAvatarProviderConfig(nextConfig));
    }

    return {
        addAvatarProvider,
        applyAvatarProviderConfig,
        avatarProviderConfig,
        avatarProviderConfigRef,
        removeAvatarProvider,
        saveAvatarProviderConfig,
        saveAvatarProviderField,
        updateAvatarProvider
    };
}
