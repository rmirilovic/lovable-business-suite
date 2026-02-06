import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentLockOptions {
  tableName: string;
  documentId: string | null;
  initialUpdatedAt: string | null;
  onConflict?: () => void;
}

/**
 * Hook for optimistic locking - prevents concurrent edits of the same document.
 * 
 * Usage:
 * 1. Store the initial `updated_at` when the document is loaded
 * 2. Before saving, call `checkLock()` to verify no one else modified the document
 * 3. If conflict detected, shows warning and optionally triggers refresh
 */
export function useDocumentLock({ 
  tableName, 
  documentId, 
  initialUpdatedAt,
  onConflict 
}: DocumentLockOptions) {
  const lastKnownUpdatedAt = useRef<string | null>(initialUpdatedAt);

  // Update the reference when initial value changes
  if (initialUpdatedAt !== lastKnownUpdatedAt.current) {
    lastKnownUpdatedAt.current = initialUpdatedAt;
  }

  /**
   * Check if the document was modified by someone else
   * @returns true if safe to save, false if conflict detected
   */
  const checkLock = useCallback(async (): Promise<boolean> => {
    if (!documentId || !lastKnownUpdatedAt.current) {
      return true; // No document to check
    }

    try {
      // Use raw query to avoid type issues with dynamic table names
      const { data, error } = await supabase
        .rpc("get_document_updated_at", {
          _table_name: tableName,
          _document_id: documentId,
        });

      if (error) {
        // Fallback: allow save if RPC doesn't exist
        console.warn("Document lock check unavailable:", error.message);
        return true;
      }

      const currentUpdatedAt = data as string | null;
      
      if (currentUpdatedAt && currentUpdatedAt !== lastKnownUpdatedAt.current) {
        toast.error(
          "Dokument je izmenjen u drugom prozoru. Osvežite stranicu da vidite najnovije izmene.",
          { duration: 5000 }
        );
        onConflict?.();
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error in checkLock:", err);
      return true; // Allow save on error
    }
  }, [documentId, tableName, onConflict]);

  /**
   * Update the known timestamp after a successful save
   */
  const updateLockTimestamp = useCallback((newUpdatedAt: string) => {
    lastKnownUpdatedAt.current = newUpdatedAt;
  }, []);

  return {
    checkLock,
    updateLockTimestamp,
    currentTimestamp: lastKnownUpdatedAt.current,
  };
}

/**
 * Wrapper for mutations that adds optimistic locking
 */
export function withOptimisticLock<T extends (...args: any[]) => Promise<any>>(
  mutationFn: T,
  checkLock: () => Promise<boolean>
): T {
  return (async (...args: Parameters<T>) => {
    const canProceed = await checkLock();
    if (!canProceed) {
      throw new Error("Document was modified by another user");
    }
    return mutationFn(...args);
  }) as T;
}
