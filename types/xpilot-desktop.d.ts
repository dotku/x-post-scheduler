// Global typing for the bridge the Electron desktop shell injects via
// electron/preload.js. Present only when running inside the xPilot desktop app;
// always guard with `window.xpilotDesktop?.isDesktop` in web code.
export interface XpilotDesktopBridge {
  isDesktop: true;
  platform: NodeJS.Platform;
  versions: { electron: string; chrome: string };
  notify: (options: {
    title: string;
    body?: string;
    silent?: boolean;
  }) => Promise<{ ok: boolean; reason?: string }>;
}

declare global {
  interface Window {
    xpilotDesktop?: XpilotDesktopBridge;
  }
}

export {};
