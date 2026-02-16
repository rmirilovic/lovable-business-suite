/**
 * Shared PDF print utility using window.open to avoid cross-origin iframe issues.
 */
export function printPdfBlob(blob: Blob) {
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, "_blank");

  if (printWindow) {
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
    // Fallback if load event doesn't fire
    setTimeout(() => {
      try { printWindow.print(); } catch (_) { /* already printed */ }
    }, 1000);
  } else {
    // Fallback: download the file if popup blocked
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "document.pdf";
    link.click();
  }

  // Clean up after a delay
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 120000);
}
