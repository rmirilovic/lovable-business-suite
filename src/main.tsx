import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import {
  buildPreviewReloadUrl,
  clearBrowserCaches,
  clearPreviewBootstrapParam,
  getPreviewEnvironment,
  hasPreviewBootstrapParam,
  installPreviewRecoveryHotkey,
  installPreviewRecoveryWatchdog,
  unregisterServiceWorkers,
} from "@/lib/previewRecovery";

const renderApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};
const { isInIframe, isLovableHosted, isLovablePreviewHost } = getPreviewEnvironment();

const bootstrapApp = async () => {
  if (isLovableHosted || isInIframe) {
    // Prevent stale PWA builds from masking fresh routes/menus on Lovable-hosted apps.
    await Promise.all([
      unregisterServiceWorkers(),
      clearBrowserCaches(),
    ]);

    if ((isInIframe || isLovablePreviewHost) && !hasPreviewBootstrapParam()) {
      window.location.replace(buildPreviewReloadUrl());
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

  clearPreviewBootstrapParam();
  renderApp();
};

installPreviewRecoveryHotkey();
installPreviewRecoveryWatchdog();
void bootstrapApp();
