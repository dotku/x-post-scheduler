// Minimal, safe preload. Exposes a tiny read-only surface to the web app so it
// can detect it is running inside the xPilot desktop shell, plus a thin bridge
// to native OS notifications.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("xpilotDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  // Show a native OS notification. Returns a Promise<{ ok, reason? }>.
  // Usage: window.xpilotDesktop.notify({ title, body, silent? })
  notify: (options) =>
    ipcRenderer.invoke("xpilot:notify", {
      title: options?.title,
      body: options?.body,
      silent: options?.silent,
    }),
});
