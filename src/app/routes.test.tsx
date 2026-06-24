import { describe, expect, it } from 'vitest';

import { protectedRoutes } from './routes';

describe('protectedRoutes', () => {
    it('retires the instance activity route without redirecting to it', () => {
        expect(
            protectedRoutes.some((route: any) => route.path === '/charts/instance')
        ).toBe(false);

        const chartsRoute = protectedRoutes.find(
            (route: any) => route.path === '/charts'
        );
        expect(chartsRoute?.element?.props?.to).toBe('/charts/mutual');
    });
});
