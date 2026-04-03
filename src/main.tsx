import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const clearBrowserCaches = async () => {
  try {
    const cacheKeys = await window.caches?.keys?.();
    if (!cacheKeys?.length) return;

    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
  } catch {
    // Ignore cache cleanup failures
  }
};

const unregisterServiceWorkers = async () => {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    if (!registrations?.length) return;

    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Ignore unregister failures
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

if (isLovableHosted || isInIframe) {
  // Prevent stale PWA builds from masking fresh routes/menus on Lovable-hosted apps.
  void unregisterServiceWorkers();
  void clearBrowserCaches();
} else {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
