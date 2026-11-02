import { initTelegramWebApp } from '@/lib/telegram-webapp';

let app: any;
let handlers: Map<string, () => void>;
let cleanup: ReturnType<typeof initTelegramWebApp>;
beforeEach(() => {
    handlers = new Map();
    app = {
        initData: 'host-data', version: '8.0', themeParams: {},
        ready: jest.fn(), expand: jest.fn(), requestFullscreen: jest.fn(),
        isVersionAtLeast: jest.fn(() => true),
        safeAreaInset: { top: 24, bottom: 20, left: 0, right: 0 },
        contentSafeAreaInset: { top: 52, bottom: 0, left: 0, right: 0 },
        onEvent: jest.fn((name, handler) => handlers.set(name, handler)),
        offEvent: jest.fn((name, handler) => { if (handlers.get(name) === handler) handlers.delete(name); }),
    };
    window.Telegram = { WebApp: app };
});
afterEach(() => { cleanup?.(); cleanup = undefined; delete window.Telegram; });

test('a supported Telegram host requests fullscreen immediately, without waiting for login or a click', () => {
    cleanup = initTelegramWebApp();
    expect(app.ready).toHaveBeenCalledTimes(1);
    expect(app.expand).toHaveBeenCalledTimes(1);
    expect(app.isVersionAtLeast).toHaveBeenCalledWith('8.0');
    expect(app.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.getPropertyValue('--ish-telegram-top')).toBe('76px');
});

test('older Telegram clients expand without calling the unsupported fullscreen method', () => {
    app.isVersionAtLeast.mockReturnValue(false);
    cleanup = initTelegramWebApp();
    expect(app.expand).toHaveBeenCalled(); expect(app.requestFullscreen).not.toHaveBeenCalled();
});

test('an already fullscreen app is preserved', () => {
    app.isFullscreen = true; cleanup = initTelegramWebApp();
    expect(app.requestFullscreen).not.toHaveBeenCalled();
});

test('a browser containing the Telegram SDK but no Telegram launch data never requests fullscreen', () => {
    app.initData = ''; cleanup = initTelegramWebApp();
    expect(app.ready).not.toHaveBeenCalled(); expect(app.requestFullscreen).not.toHaveBeenCalled();
});

test('a native readiness failure does not block expansion or fullscreen', () => {
    app.ready.mockImplementation(() => { throw Error('Unsupported'); });
    expect(() => { cleanup = initTelegramWebApp(); }).not.toThrow();
    expect(app.expand).toHaveBeenCalled(); expect(app.requestFullscreen).toHaveBeenCalled();
});

test('a synchronous fullscreen rejection leaves the expanded app usable', () => {
    app.requestFullscreen.mockImplementation(() => { throw Error('Unsupported'); });
    expect(() => { cleanup = initTelegramWebApp(); }).not.toThrow();
    expect(app.expand).toHaveBeenCalled();
});

test('an asynchronous host rejection falls back to expand without a retry loop', () => {
    cleanup = initTelegramWebApp(); handlers.get('fullscreenFailed')!();
    expect(app.expand).toHaveBeenCalledTimes(2); expect(app.requestFullscreen).toHaveBeenCalledTimes(1);
});

test('rotation and Telegram controls update the insets, then listeners and values are cleaned up', () => {
    cleanup = initTelegramWebApp();
    app.safeAreaInset = { top: 0, bottom: 10, left: 35, right: 0 };
    app.contentSafeAreaInset.top = 0; handlers.get('safeAreaChanged')!();
    expect(document.documentElement.style.getPropertyValue('--ish-telegram-left')).toBe('35px');
    expect(document.documentElement.style.getPropertyValue('--ish-telegram-top')).toBe('0px');
    app.contentSafeAreaInset.top = 42; handlers.get('contentSafeAreaChanged')!();
    expect(document.documentElement.style.getPropertyValue('--ish-telegram-top')).toBe('42px');
    cleanup!(); cleanup = undefined;
    expect(handlers.size).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--ish-telegram-top')).toBe('');
});
