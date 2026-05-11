export const NAV_LAYOUT_UPDATED_EVENT = 'vrcx:nav-layout-updated';
export const NAV_CUSTOMIZE_REQUESTED_EVENT = 'vrcx:nav-customize-requested';

export function publishNavLayoutUpdated() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NAV_LAYOUT_UPDATED_EVENT));
    }
}

export function publishNavCustomizeRequested() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NAV_CUSTOMIZE_REQUESTED_EVENT));
    }
}
