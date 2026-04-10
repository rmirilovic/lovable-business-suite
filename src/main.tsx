import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const PREVIEW_BOOTSTRAP_RELOAD_KEY = "lovable_preview_bootstrap_reload";

const clearBrowserCaches = async () => {
  try {
    const cacheKeys = await window.caches?.keys?.();
    if (!cacheKeys?.length) return 0;

    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    return cacheKeys.length;
  } catch {
    // Ignore cache cleanup failures
    return 0;
  }
};

const unregisterServiceWorkers = async () => {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    if (!registrations?.length) return 0;

    await Promise.all(registrations.map((registration) => registration.unregister()));
    return registrations.length;
  } catch {
    // Ignore unregister failures
    return 0;
  }
};

const renderApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};

const shouldForcePreviewReload = () => {
  try {
    return sessionStorage.getItem(PREVIEW_BOOTSTRAP_RELOAD_KEY) !== "done";
  } catch {
    return false;
  }
};

const markPreviewReloadDone = () => {
  try {
    sessionStorage.setItem(PREVIEW_BOOTSTRAP_RELOAD_KEY, "done");
  } catch {
    // Ignore storage failures
  }
};

// Guard: never register service worker in iframe or Lovable preview
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const hostname = window.location.hostname;
const isLovableHosted =
  hostname === "lovable.app" ||
  hostname.endsWith(".lovable.app") ||
  hostname.includes("lovableproject.com");

const bootstrapApp = async () => {
  if (isLovableHosted || isInIframe) {
    // Prevent stale PWA builds from masking fresh routes/menus on Lovable-hosted apps.
    const [unregisteredCount, clearedCacheCount] = await Promise.all([
      unregisterServiceWorkers(),
      clearBrowserCaches(),
    ]);

    if (isInIframe && shouldForcePreviewReload() && (unregisteredCount > 0 || clearedCacheCount > 0)) {
      markPreviewReloadDone();
      window.location.reload();
      return;
    }
  } else {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        void updateSW(true);
      },
    });
  }

  renderApp();
};

void bootstrapApp();
