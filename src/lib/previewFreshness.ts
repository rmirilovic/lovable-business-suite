const PREVIEW_FINGERPRINT_ENDPOINT = "/__lovable_dev_fingerprint";
const PREVIEW_FINGERPRINT_REQUEST_TIMEOUT_MS = 1500;
const PREVIEW_FINGERPRINT_META_SELECTOR = 'meta[name="lovable-preview-fingerprint"]';

interface PreviewFingerprintResponse {
  fingerprint?: string;
}

const getEmbeddedPreviewFingerprint = () => {
  if (typeof document === "undefined") return null;

  const normalizedFingerprint = document
    .querySelector<HTMLMetaElement>(PREVIEW_FINGERPRINT_META_SELECTOR)
    ?.content?.trim();

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
