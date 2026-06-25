import { beforeEach, describe, expect, it, vi } from 'vitest';

const commandMocks = vi.hoisted(() => ({
    appVrchatAuthConfigGet: vi.fn(),
    appVrchatAuthCurrentUserGet: vi.fn(),
    appVrchatAuthSessionGet: vi.fn(),
    appVrchatAuthCookieSessionRestore: vi.fn(),
    appVrchatAuthLoginBasicStart: vi.fn(),
    appVrchatAuthSavedCredentialLoginStart: vi.fn(),
    appVrchatAuthTotpVerify: vi.fn(),
    appVrchatAuthOtpVerify: vi.fn(),
    appVrchatAuthEmailOtpVerify: vi.fn(),
    appVrchatAuthVisitsGet: vi.fn(),
    appVrchatAuthFileAnalysisGet: vi.fn()
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: commandMocks
}));

import {
    DEFAULT_ENDPOINT_DOMAIN,
    getConfig,
    getCurrentUser,
    getFileAnalysis,
    loginWithBasicAuth,
    loginWithSavedCredential,
    verifyEmailOTP,
    verifyOTP,
    verifyTOTP
} from './vrchatAuthRepository';
import { setVrchatAuthFailureHandler } from './vrchatRequest';

function response(status = 200, data: unknown = { id: 'usr_1' }) {
    return {
        status,
        data: typeof data === 'string' ? data : JSON.stringify(data),
        raw: {
            status
        }
    };
}

describe('vrchatAuthRepository', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        for (const command of Object.values(commandMocks)) {
            command.mockResolvedValue(response());
        }
        setVrchatAuthFailureHandler(null);
    });

    it('normalizes default endpoints and unwraps successful auth responses', async () => {
        await expect(getCurrentUser()).resolves.toMatchObject({
            json: {
                id: 'usr_1'
            },
            status: 200,
            endpointDomain: DEFAULT_ENDPOINT_DOMAIN,
            raw: {
                status: 200
            }
        });

        expect(commandMocks.appVrchatAuthCurrentUserGet).toHaveBeenCalledWith({
            endpoint: DEFAULT_ENDPOINT_DOMAIN
        });
    });

    it('passes normalized auth command payloads to the Tauri bridge', async () => {
        await loginWithBasicAuth({
            username: 'user@example.test',
            password: 123,
            endpoint: ' https://api.example.test/api/1 '
        });
        await loginWithSavedCredential({
            userId: 456,
            endpoint: ''
        });
        await verifyTOTP({ code: 111111 });
        await verifyOTP({ code: null });
        await verifyEmailOTP({ code: '222222' });

        expect(commandMocks.appVrchatAuthLoginBasicStart).toHaveBeenCalledWith({
            endpoint: 'https://api.example.test/api/1',
            username: 'user@example.test',
            password: '123'
        });
        expect(
            commandMocks.appVrchatAuthSavedCredentialLoginStart
        ).toHaveBeenCalledWith({
            endpoint: DEFAULT_ENDPOINT_DOMAIN,
            userId: '456'
        });
        expect(commandMocks.appVrchatAuthTotpVerify).toHaveBeenCalledWith({
            endpoint: DEFAULT_ENDPOINT_DOMAIN,
            code: '111111'
        });
        expect(commandMocks.appVrchatAuthOtpVerify).toHaveBeenCalledWith({
            endpoint: DEFAULT_ENDPOINT_DOMAIN,
            code: ''
        });
        expect(commandMocks.appVrchatAuthEmailOtpVerify).toHaveBeenCalledWith({
            endpoint: DEFAULT_ENDPOINT_DOMAIN,
            code: '222222'
        });
    });

    it('builds file-analysis requests with numeric versions and encoded error endpoints', async () => {
        commandMocks.appVrchatAuthFileAnalysisGet.mockResolvedValueOnce(
            response(404, {
                error: {
                    message: 'Missing file analysis'
                }
            })
        );

        await expect(
            getFileAnalysis({
                fileId: 'file 1',
                version: '2',
                variant: 'Quest/Android'
            })
        ).rejects.toMatchObject({
            message: 'Missing file analysis',
            status: 404,
            endpoint: 'analysis/file%201/2/Quest%2FAndroid'
        });

        expect(commandMocks.appVrchatAuthFileAnalysisGet).toHaveBeenCalledWith({
            endpoint: DEFAULT_ENDPOINT_DOMAIN,
            fileId: 'file 1',
            version: 2,
            variant: 'Quest/Android'
        });
    });

    it('throws request errors and notifies the auth failure handler for recoverable auth failures', async () => {
        const handler = vi.fn();
        setVrchatAuthFailureHandler(handler);
        commandMocks.appVrchatAuthConfigGet.mockResolvedValueOnce(
            response(403, {
                error: {
                    message: 'Forbidden'
                }
            })
        );

        await expect(getConfig()).rejects.toMatchObject({
            message: 'Forbidden',
            status: 403,
            endpoint: 'config'
        });
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Forbidden',
                status: 403,
                endpoint: 'config'
            })
        );
    });

    it('treats payloads containing an error object as failed requests even with a 200 status', async () => {
        commandMocks.appVrchatAuthSessionGet.mockResolvedValueOnce(
            response(200, {
                error: {
                    message: 'Session rejected'
                }
            })
        );

        await expect(
            getCurrentUser({
                endpoint: 'https://api.example.test/api/1/'
            })
        ).resolves.toMatchObject({
            endpointDomain: 'https://api.example.test/api/1/'
        });
        await expect(
            import('./vrchatAuthRepository').then(({ getAuthSession }) =>
                getAuthSession()
            )
        ).rejects.toMatchObject({
            message: 'Session rejected',
            status: 200,
            endpoint: 'auth'
        });
    });
});
