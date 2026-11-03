// Small helpers for "install as app" (PWA) and the Android app download.
// The Android app is a thin Capacitor wrapper that opens this same website (see android/),
// it adds "SafeRoadsApp" to the user agent so the site doesn't advertise the app inside the app.

export const APK_URL = 'https://github.com/Tejdeep-67/safe-roads/releases/latest/download/safe-roads.apk';
export const APK_SIZE = '3.6 MB';
export const RELEASE_URL = 'https://github.com/Tejdeep-67/safe-roads/releases/latest';

export const inAndroidApp = () => /SafeRoadsApp/.test(navigator.userAgent);

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Chrome/Edge fire this when the site can be installed; keep it so we can show our own button
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((l) => l());
});

export const canPromptInstall = () => deferred !== null;
export function onInstallChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function promptInstall() {
  if (!deferred) return false;
  const d = deferred;
  deferred = null;
  await d.prompt();
  const { outcome } = await d.userChoice;
  listeners.forEach((l) => l());
  return outcome === 'accepted';
}

export function registerServiceWorker() {
  // not inside the Android app: there the page always comes from the network and the
  // app has its own "no internet" screen
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD || inAndroidApp()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('service worker not registered', err));
  });
}
