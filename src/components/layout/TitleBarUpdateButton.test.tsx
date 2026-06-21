import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    latestUpdaterRelease: {
        title: 'VRCX-0 2.7.0',
        currentVersion: 'Preview 20260621-1530',
        latestVersion: '2.7.0',
        publishedAt: '2026-06-21T07:00:00Z',
        updaterType: 'manual'
    }
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                'nav_menu.update': 'Update',
                'message.vrcx_updater.current_version': 'Current Version',
                'message.vrcx_updater.latest_version': 'Latest Version',
                'message.vrcx_updater.released': 'Released'
            })[key] || key
    })
}));

vi.mock('@/ui/shadcn/button', async () => {
    const React = await import('react');

    return {
        Button: ({ children, ...props }: any) =>
            React.createElement('button', props, children)
    };
});

vi.mock('@/ui/shadcn/hover-card', async () => {
    const React = await import('react');

    return {
        HoverCard: ({ children }: any) =>
            React.createElement('div', null, children),
        HoverCardContent: ({ children }: any) =>
            React.createElement('div', null, children),
        HoverCardTrigger: ({ children }: any) =>
            React.createElement(React.Fragment, null, children)
    };
});

vi.mock('@/state/runtimeStore', () => ({
    useRuntimeStore: (selector: any) =>
        selector({
            updateLoop: {
                latestUpdaterRelease: mocks.latestUpdaterRelease
            }
        })
}));

import { TitleBarUpdateButton } from './TitleBarUpdateButton';

describe('TitleBarUpdateButton', () => {
    it('renders the update entry with the latest release snapshot', () => {
        const html = renderToStaticMarkup(
            React.createElement(TitleBarUpdateButton, {
                onClick: vi.fn()
            })
        );

        expect(html).toContain('Update');
        expect(html).toContain('VRCX-0 2.7.0');
        expect(html).toContain('Preview 20260621-1530');
        expect(html).toContain('2.7.0');
    });
});
