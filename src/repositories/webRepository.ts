import { commands } from '@/platform/tauri/bindings';

async function clearCookies() {
    return commands.webClearCookies();
}

async function clearAuthCookies() {
    return commands.webClearAuthCookies();
}

const webRepository = Object.freeze({
    clearCookies,
    clearAuthCookies
});

export { clearCookies, clearAuthCookies };
export default webRepository;
