declare const __APP_PREVIEW_FINGERPRINT__: string | undefined;

const PREVIEW_FINGERPRINT_ENDPOINT = "/__lovable_dev_fingerprint";
const PREVIEW_FINGERPRINT_REQUEST_TIMEOUT_MS = 1500;

interface PreviewFingerprintResponse {
  fingerprint?: string;
}

const getEmbeddedPreviewFingerprint = () => {
  if (typeof __APP_PREVIEW_FINGERPRINT__ !== "string") return null;

  const normalizedFingerprint = __APP_PREVIEW_FINGERPRINT__.trim();
  return normalizedFingerprint.length > 0 ? normalizedFingerprint : null;
};

export const hasPreviewFingerprintMismatch = async () => {
  const embeddedFingerprint = getEmbeddedPreviewFingerprint();
  if (!embeddedFingerprint || typeof window === "undefined") return false;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PREVIEW_FINGERPRINT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${PREVIEW_FINGERPRINT_ENDPOINT}?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "cache-control": "no-store",
      },
      signal: controller.signal,
    });

    if (!response.ok) return false;

    const data = (await response.json()) as PreviewFingerprintResponse;
    return !!data.fingerprint && data.fingerprint !== embeddedFingerprint;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
