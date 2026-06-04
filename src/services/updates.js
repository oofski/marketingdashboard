import { useEffect, useState } from 'react';

// Injected at build time from package.json (see vite.config.js). Used as the
// version fallback in the browser/standalone build; the packaged desktop app
// prefers the live value reported by Electron.
const BUILD_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
const isElectron = !!api?.isElectron;

export function useAppVersion() {
  const [version, setVersion] = useState(BUILD_VERSION);
  useEffect(() => {
    if (isElectron) {
      api.appInfo().then((info) => info?.version && setVersion(info.version));
    }
  }, []);
  return version;
}

export function useUpdateStatus() {
  const [status, setStatus] = useState(isElectron ? { state: 'idle' } : { state: 'web' });

  useEffect(() => {
    if (!isElectron) return undefined;
    let active = true;
    api.getUpdateStatus().then((s) => active && s && setStatus(s));
    const off = api.onUpdateStatus((s) => active && setStatus(s));
    return () => {
      active = false;
      off?.();
    };
  }, []);

  return {
    status,
    isElectron,
    checkForUpdates: () => isElectron && api.checkForUpdates().then(setStatus),
    installUpdate: () => isElectron && api.installUpdate(),
  };
}

// Human-friendly one-liner for any update state.
export function describeUpdate(status, currentVersion) {
  switch (status?.state) {
    case 'checking':
      return { label: 'Checking for updates…', tone: 'muted' };
    case 'available':
    case 'downloading':
      return {
        label:
          status.percent > 0 ? `Downloading update… ${status.percent}%` : 'Downloading update…',
        tone: 'accent',
      };
    case 'downloaded':
      return { label: 'Update ready — restart to apply', tone: 'accent' };
    case 'latest':
      return { label: `You're on the latest version (v${currentVersion}).`, tone: 'success' };
    case 'error':
      return { label: 'Could not check for updates right now.', tone: 'warning' };
    case 'dev':
      return { label: 'Development build.', tone: 'muted' };
    case 'web':
      return { label: 'Updates apply automatically in the installed desktop app.', tone: 'muted' };
    case 'idle':
    default:
      return { label: `Version v${currentVersion}.`, tone: 'muted' };
  }
}
