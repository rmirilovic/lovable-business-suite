// PDF Font configuration for Serbian/regional character support
// Uses Roboto font which has full UTF-8 support including šđčćž characters

import jsPDF from "jspdf";

// We'll load the font from Google Fonts CDN and convert to base64
let fontLoaded = false;
let robotoRegular: string | null = null;
let robotoBold: string | null = null;

async function loadFont(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function initializePdfFonts(): Promise<void> {
  if (fontLoaded) return;

  try {
    // Load Roboto fonts from Google Fonts
    const [regular, bold] = await Promise.all([
      loadFont("https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf"),
      loadFont("https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf"),
    ]);

    robotoRegular = regular;
    robotoBold = bold;
    fontLoaded = true;
  } catch (error) {
    console.error("Failed to load PDF fonts:", error);
    throw new Error("Nije moguće učitati fontove za PDF");
  }
}

export function configurePdfFonts(doc: jsPDF): void {
  if (!robotoRegular || !robotoBold) {
    throw new Error("Fontovi nisu učitani. Pozovite initializePdfFonts() prvo.");
  }

  // Add Roboto Regular
  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegular);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

  // Add Roboto Bold
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBold);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  // Set default font
  doc.setFont("Roboto", "normal");
}

export function areFontsLoaded(): boolean {
  return fontLoaded;
}
