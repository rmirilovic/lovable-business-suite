import * as React from "react";

/**
 * Detektuje da li je trenutni uređaj sa touch ekranom (mobilni telefon ili tablet,
 * uključujući iPad u desktop režimu). Ne zavisi od širine ekrana.
 *
 * Kombinuje više provera:
 *  - matchMedia("(pointer: coarse)") — primarno sredstvo unosa je prst/olovka
 *  - navigator.maxTouchPoints > 0 — uređaj ima touch ulaz (uključujući iPadOS koji se
 *    predstavlja kao desktop)
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = React.useState<boolean>(false);

  React.useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return false;
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const maxTouchPoints =
        (typeof navigator !== "undefined" && (navigator as any).maxTouchPoints) || 0;
      const hasTouchEvent =
        typeof window !== "undefined" && "ontouchstart" in window;
      return coarse || maxTouchPoints > 0 || hasTouchEvent;
    };

    setIsTouch(check());

    const mql = window.matchMedia?.("(pointer: coarse)");
    if (!mql) return;
    const handler = () => setIsTouch(check());
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  return isTouch;
}
