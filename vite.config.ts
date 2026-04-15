import fs from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const PREVIEW_FINGERPRINT_ENDPOINT = "/__lovable_dev_fingerprint";
const PREVIEW_FINGERPRINT_FILE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".ts",
  ".tsx",
]);
const PREVIEW_FINGERPRINT_TARGETS = ["src", "public", "tailwind.config.ts", "vite.config.ts"];

const collectLatestModifiedAt = (targetPath: string): number => {
  if (!fs.existsSync(targetPath)) return 0;

  const targetStat = fs.statSync(targetPath);
  if (targetStat.isFile()) {
    return targetStat.mtimeMs;
  }

  if (!targetStat.isDirectory()) {
    return 0;
  }

  return fs.readdirSync(targetPath).reduce((latestModifiedAt, childName) => {
    const childPath = path.join(targetPath, childName);
    const childStat = fs.statSync(childPath);

    if (childStat.isDirectory()) {
      return Math.max(latestModifiedAt, collectLatestModifiedAt(childPath));
    }

    if (!PREVIEW_FINGERPRINT_FILE_EXTENSIONS.has(path.extname(childName))) {
      return latestModifiedAt;
    }

    return Math.max(latestModifiedAt, childStat.mtimeMs);
  }, targetStat.mtimeMs);
};

const buildPreviewFingerprint = () => {
  const latestModifiedAt = PREVIEW_FINGERPRINT_TARGETS.reduce((currentLatest, targetPath) => {
    return Math.max(currentLatest, collectLatestModifiedAt(path.resolve(__dirname, targetPath)));
  }, 0);

  return latestModifiedAt > 0 ? String(Math.round(latestModifiedAt)) : String(Date.now());
};

const previewFingerprintPlugin = () => ({
  name: "preview-fingerprint",
  configureServer(server: import("vite").ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      const pathname = req.url ? new URL(req.url, "http://localhost").pathname : "";
      if (pathname !== PREVIEW_FINGERPRINT_ENDPOINT) {
        next();
        return;
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.end(JSON.stringify({ fingerprint: buildPreviewFingerprint() }));
    });
  },
  transformIndexHtml() {
    return [
      {
        tag: "meta",
        attrs: {
          name: "lovable-preview-fingerprint",
          content: buildPreviewFingerprint(),
        },
        injectTo: "head",
      },
    ];
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      previewFingerprintPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          enabled: false,
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/cdn\.gpteng\.co\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "gpteng-assets",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        manifest: {
          name: "Mini ERP",
          short_name: "MiniERP",
          description: "Mini ERP - Poslovno rešenje za upravljanje poslovanjem",
          theme_color: "#000000",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable any",
            },
            {
              src: "/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable any",
            },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
