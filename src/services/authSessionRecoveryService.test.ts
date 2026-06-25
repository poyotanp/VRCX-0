import { beforeEach, describe, expect, it, vi } from 'vitest';

const vrchatRequestMocks = vi.hoisted(() => ({
    isVrchatSessionRecoveryError: vi.fn(),
    setVrchatAuthFailureHandler: vi.fn()
}));

vi.mock('@/repositories/vrchatRequest', () => ({
    isVrchatSessionRecoveryError:
        vrchatRequestMocks.isVrchatSessionRecoveryError,
    setVrchatAuthFailureHandler: vrchatRequestMocks.setVrchatAuthFailureHandler
}));

import { useRuntimeStore } from '@/state/runtimeStore';
import { useSessionStore } from '@/state/sessionStore';

import {
    runWithRuntimeAuthFailureRecoverySuppressed,
    shouldHandleRuntimeAuthFailure,
    startRuntimeAuthFailureRecovery
} from './authSessionRecoveryService';

describe('authSessionRecoveryService public guardrails', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        useRuntimeStore.getState().resetRuntimeState();
        useSessionStore.getState().resetSessionState();
        vrchatRequestMocks.isVrchatSessionRecoveryError.mockReturnValue(true);
        vrchatRequestMocks.setVrchatAuthFailureHandler.mockReturnValue(
            vi.fn()
        );
    });

    it('handles runtime auth failures only for ready signed-in sessions with a current user', () => {
        const error = new Error('Forbidden');

        expect(shouldHandleRuntimeAuthFailure(error)).toBe(false);

        useSessionStore.getState().setSessionState({
            sessionPhase: 'ready',
            isLoggedIn: true
        });
        useRuntimeStore.getState().setAuthBootstrap({
            currentUserId: 'usr_1'
        });

        expect(shouldHandleRuntimeAuthFailure(error)).toBe(true);
        expect(
            vrchatRequestMocks.isVrchatSessionRecoveryError
        ).toHaveBeenCalledWith(error);
    });

    it('suppresses recovery while protected auth execution is running', async () => {
        useSessionStore.getState().setSessionState({
            sessionPhase: 'ready',
            isLoggedIn: true
        });
        useRuntimeStore.getState().setAuthBootstrap({
            currentUserId: 'usr_1'
        });

        await runWithRuntimeAuthFailureRecoverySuppressed(async () => {
            expect(shouldHandleRuntimeAuthFailure(new Error('401'))).toBe(
                false
            );
        });

        expect(shouldHandleRuntimeAuthFailure(new Error('401'))).toBe(true);
    });

    it('registers the runtime auth failure handler and returns the unsubscribe callback', () => {
        const unsubscribe = vi.fn();
        vrchatRequestMocks.setVrchatAuthFailureHandler.mockReturnValueOnce(
            unsubscribe
        );

        const stopRecovery = startRuntimeAuthFailureRecovery();
        stopRecovery();

        expect(
            vrchatRequestMocks.setVrchatAuthFailureHandler
        ).toHaveBeenCalledWith(expect.any(Function));
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
