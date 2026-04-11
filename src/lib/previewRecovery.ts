const PREVIEW_BOOTSTRAP_PARAM = "__lovable_preview_bootstrap";
const PREVIEW_RECOVERY_SHORTCUT_KEY = "r";

declare global {
  interface Window {
    __erpPreviewRecoveryCleanup?: () => void;
  }
}

export const PREVIEW_RECOVERY_SHORTCUT_LABEL = "Ctrl/⌘ + Alt + Shift + R";

export const getPreviewEnvironment = () => {
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
  const isLovablePreviewHost =
    hostname.includes("id-preview--") ||
    hostname.includes("lovableproject.com");

  return {
    isInIframe,
    isLovableHosted,
    isLovablePreviewHost,
  };
};

export const shouldShowPreviewRecoveryHint = () => {
  const { isInIframe, isLovableHosted, isLovablePreviewHost } = getPreviewEnvironment();
  return isInIframe || isLovableHosted || isLovablePreviewHost;
};

export const clearBrowserCaches = async () => {
  try {
    const cacheKeys = await window.caches?.keys?.();
    if (!cacheKeys?.length) return 0;

    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    return cacheKeys.length;
  } catch {
    return 0;
  }
};

export const unregisterServiceWorkers = async () => {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    if (!registrations?.length) return 0;

    await Promise.all(registrations.map((registration) => registration.unregister()));
    return registrations.length;
  } catch {
    return 0;
  }
};

export const hasPreviewBootstrapParam = () => {
  try {
    return new URL(window.location.href).searchParams.has(PREVIEW_BOOTSTRAP_PARAM);
  } catch {
    return false;
  }
};

export const clearPreviewBootstrapParam = () => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PREVIEW_BOOTSTRAP_PARAM)) return;

    url.searchParams.delete(PREVIEW_BOOTSTRAP_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // ignore URL cleanup failures
  }
};

export const buildPreviewReloadUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set(PREVIEW_BOOTSTRAP_PARAM, Date.now().toString());
  return url.toString();
};

export const triggerPreviewRecoveryReload = async () => {
  await Promise.all([unregisterServiceWorkers(), clearBrowserCaches()]);
  window.location.replace(buildPreviewReloadUrl());
};

const isPreviewRecoveryShortcut = (event: KeyboardEvent) => {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.altKey &&
    event.shiftKey &&
    event.key.toLowerCase() === PREVIEW_RECOVERY_SHORTCUT_KEY
  );
};

export const installPreviewRecoveryHotkey = () => {
  if (typeof window === "undefined") return () => {};

  const { isInIframe, isLovableHosted, isLovablePreviewHost } = getPreviewEnvironment();
  if (!isInIframe && !isLovableHosted && !isLovablePreviewHost) {
    return () => {};
  }

  window.__erpPreviewRecoveryCleanup?.();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isPreviewRecoveryShortcut(event)) return;

    event.preventDefault();
    void triggerPreviewRecoveryReload();
  };

  window.addEventListener("keydown", handleKeyDown);

  const cleanup = () => {
    window.removeEventListener("keydown", handleKeyDown);
    if (window.__erpPreviewRecoveryCleanup === cleanup) {
      delete window.__erpPreviewRecoveryCleanup;
    }
  };

  window.__erpPreviewRecoveryCleanup = cleanup;
  return cleanup;
};