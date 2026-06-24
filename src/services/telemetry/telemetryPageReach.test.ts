import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
});

function mockDeps(options: { anonymous: boolean }) {
    const postTelemetry = vi.fn((_path: string, _payload: unknown) =>
        Promise.resolve()
    );

    vi.doMock('./telemetryConfig', () => ({
        isAnonymousUsageTelemetryEnabled: () => options.anonymous
    }));
    vi.doMock('./telemetryClient', () => ({ postTelemetry }));
    vi.doMock('./telemetryPayload', () => ({
        buildTelemetryContext: () => ({ installId: 'i' })
    }));

    return { postTelemetry };
}

const session = { installId: 'i', sessionId: 's' };

function findRoute(payload: any, route: string) {
    return payload.routes.find((entry: any) => entry.route === route);
}

describe('page reach telemetry', () => {
    it('normalizes dynamic and nested paths to canonical route slugs', async () => {
        mockDeps({ anonymous: true });
        const mod = await import('./telemetryPageReach');
        expect(mod.normalizeRouteKey('/feed')).toBeNull();
        expect(mod.normalizeRouteKey('/login')).toBeNull();
        expect(mod.normalizeRouteKey('/dashboard/abc-123')).toBe('dashboard');
        expect(mod.normalizeRouteKey('/social/friend-log')).toBe('friend_log');
        expect(mod.normalizeRouteKey('/charts/instance')).toBeNull();
        expect(mod.normalizeRouteKey('/charts/mutual')).toBe('charts_mutual');
        expect(mod.normalizeRouteKey('/tools/gallery/')).toBe('gallery');
        expect(mod.normalizeRouteKey('/unknown-page')).toBeNull();
    });

    it('counts a visit per route entry and reports opened routes', async () => {
        const { postTelemetry } = mockDeps({ anonymous: true });
        const mod = await import('./telemetryPageReach');
        mod.recordRouteEnter('/game-log');
        mod.recordRouteEnter('/search');
        mod.recordRouteEnter('/game-log');
        await mod.sendPageReach(session);

        const [path, payload] = postTelemetry.mock.calls[0] as [string, any];
        expect(path).toBe('/api/v1/telemetry/page-health');
        expect(findRoute(payload, 'game_log').visits).toBe(2);
        expect(findRoute(payload, 'search').visits).toBe(1);
    });

    it('attributes errors to the current route and omits zero counts', async () => {
        const { postTelemetry } = mockDeps({ anonymous: true });
        const mod = await import('./telemetryPageReach');
        mod.recordRouteEnter('/game-log');
        mod.recordRouteError('render_crash');
        mod.recordRouteEnter('/search');
        await mod.sendPageReach(session);

        const payload = postTelemetry.mock.calls[0]?.[1] as any;
        expect(findRoute(payload, 'game_log').renderCrash).toBe(1);
        expect(findRoute(payload, 'search').renderCrash).toBeUndefined();
    });

    it('does not send when anonymous usage telemetry is off', async () => {
        const { postTelemetry } = mockDeps({ anonymous: false });
        const mod = await import('./telemetryPageReach');
        mod.recordRouteEnter('/game-log');
        await mod.sendPageReach(session);
        expect(postTelemetry).not.toHaveBeenCalled();
    });

    it('clears accumulated usage on reset', async () => {
        const { postTelemetry } = mockDeps({ anonymous: true });
        const mod = await import('./telemetryPageReach');
        mod.recordRouteEnter('/game-log');
        mod.resetPageReach();
        await mod.sendPageReach(session);
        expect(postTelemetry).not.toHaveBeenCalled();
    });
});
