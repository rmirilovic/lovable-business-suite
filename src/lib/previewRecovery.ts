const PREVIEW_BOOTSTRAP_PARAM = "__lovable_preview_bootstrap";
const PREVIEW_RECOVERY_SHORTCUT_KEY = "r";
const PREVIEW_RECOVERY_FALLBACK_SHORTCUT_KEY = "m";
const PREVIEW_RECOVERY_ATTEMPT_KEY = "erp.previewRecoveryAttempted";
const PREVIEW_RECOVERY_WATCHDOG_DELAY_MS = 2200;
const PREVIEW_RECOVERY_WATCHDOG_RECHECK_MS = 900;
const PREVIEW_SHELL_SELECTOR = '[data-erp-shell="ready"]';

declare global {
  interface Window {
    __erpPreviewRecoveryCleanup?: () => void;
  }
}

export const PREVIEW_RECOVERY_SHORTCUT_LABEL = "Ctrl/⌘ + Alt + M";

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

const readRecoveryAttemptFlag = () => {
  try {
    return window.sessionStorage.getItem(PREVIEW_RECOVERY_ATTEMPT_KEY) === "true";
  } catch {
    return false;
  }
};

const writeRecoveryAttemptFlag = (value: boolean) => {
  try {
    if (value) {
      window.sessionStorage.setItem(PREVIEW_RECOVERY_ATTEMPT_KEY, "true");
      return;
    }

    window.sessionStorage.removeItem(PREVIEW_RECOVERY_ATTEMPT_KEY);
  } catch {
    // ignore storage failures
  }
};

const hasPersistedAuthState = () => {
  const storages = [window.localStorage, window.sessionStorage];

  try {
    return storages.some((storage) => {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key) continue;

        if (
          key === "selectedCompanyId" ||
          key === "cachedUserRole" ||
          key === "cachedLocalAdminCompanyIds" ||
          key === "supabase.auth.token" ||
          (key.startsWith("sb-") && key.includes("auth-token"))
        ) {
          return true;
        }
      }

      return false;
    });
  } catch {
    return false;
  }
};

const isNonShellRoute = () => {
  const pathname = window.location.pathname;
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/select-company")
  );
};

export const hasPreviewShellMounted = () => {
  if (typeof document === "undefined") return false;
  return document.querySelector(PREVIEW_SHELL_SELECTOR) !== null;
};

export const notifyPreviewShellReady = () => {
  writeRecoveryAttemptFlag(false);
};

export const buildPreviewReloadUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set(PREVIEW_BOOTSTRAP_PARAM, Date.now().toString());
  return url.toString();
};

export const triggerPreviewRecoveryReload = async () => {
  writeRecoveryAttemptFlag(true);
  await Promise.all([unregisterServiceWorkers(), clearBrowserCaches()]);
  window.location.replace(buildPreviewReloadUrl());
};

const isPreviewRecoveryShortcut = (event: KeyboardEvent) => {
  const isPrimaryModifierPressed = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  return (
    (isPrimaryModifierPressed &&
      event.altKey &&
      event.shiftKey &&
      key === PREVIEW_RECOVERY_SHORTCUT_KEY) ||
    (isPrimaryModifierPressed && event.altKey && key === PREVIEW_RECOVERY_FALLBACK_SHORTCUT_KEY)
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
    event.stopPropagation();
    void triggerPreviewRecoveryReload();
  };

  window.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("keydown", handleKeyDown, true);

  const cleanup = () => {
    window.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    if (window.__erpPreviewRecoveryCleanup === cleanup) {
      delete window.__erpPreviewRecoveryCleanup;
    }
  };

  window.__erpPreviewRecoveryCleanup = cleanup;
  return cleanup;
};

export const installPreviewRecoveryWatchdog = () => {
  if (typeof window === "undefined") return () => {};

  const { isInIframe, isLovableHosted, isLovablePreviewHost } = getPreviewEnvironment();
  if (!isInIframe && !isLovableHosted && !isLovablePreviewHost) {
    return () => {};
  }

  let timeoutId: number | null = null;

  const clearScheduledCheck = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const ensureShellAvailability = async () => {
    if (isNonShellRoute()) return;
    if (hasPreviewShellMounted()) return;
    if (readRecoveryAttemptFlag()) return;
    if (!hasPersistedAuthState()) return;

    await triggerPreviewRecoveryReload();
  };

  const scheduleCheck = (delay = PREVIEW_RECOVERY_WATCHDOG_DELAY_MS) => {
    clearScheduledCheck();
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      void ensureShellAvailability();
    }, delay);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      scheduleCheck(PREVIEW_RECOVERY_WATCHDOG_RECHECK_MS);
    }
  };

  const handleFocus = () => {
    scheduleCheck(PREVIEW_RECOVERY_WATCHDOG_RECHECK_MS);
  };

  const handlePageShow = () => {
    scheduleCheck(PREVIEW_RECOVERY_WATCHDOG_RECHECK_MS);
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("pageshow", handlePageShow);

  scheduleCheck();

  return () => {
    clearScheduledCheck();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("pageshow", handlePageShow);
  };
};