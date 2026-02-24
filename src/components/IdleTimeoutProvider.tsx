import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const WARNING_BEFORE_LOGOUT_MS = 5 * 60 * 1000; // 5 minutes warning
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
const THROTTLE_MS = 30_000; // only update lastActivity every 30s to avoid performance issues

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { user, selectedCompany, signOut } = useAuth();
  const [timeoutHours, setTimeoutHours] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const throttleRef = useRef(0);

  // Fetch timeout setting for current company
  useEffect(() => {
    if (!selectedCompany?.id) {
      setTimeoutHours(null);
      return;
    }

    const fetchTimeout = async () => {
      const { data } = await supabase
        .from("companies")
        .select("idle_timeout_hours")
        .eq("id", selectedCompany.id)
        .maybeSingle();

      setTimeoutHours(data?.idle_timeout_hours ?? null);
    };

    fetchTimeout();
  }, [selectedCompany?.id]);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await signOut();
  }, [signOut, clearAllTimers]);

  const resetTimers = useCallback(() => {
    if (!timeoutHours || timeoutHours <= 0 || !user) return;

    clearAllTimers();
    setShowWarning(false);

    const totalMs = timeoutHours * 60 * 60 * 1000;
    const warningAt = totalMs - WARNING_BEFORE_LOGOUT_MS;

    if (warningAt > 0) {
      warningTimerRef.current = window.setTimeout(() => {
        setShowWarning(true);
        setSecondsLeft(Math.floor(WARNING_BEFORE_LOGOUT_MS / 1000));

        countdownRef.current = window.setInterval(() => {
          setSecondsLeft((prev) => {
            if (prev <= 1) return 0;
            return prev - 1;
          });
        }, 1000);

        logoutTimerRef.current = window.setTimeout(() => {
          handleLogout();
        }, WARNING_BEFORE_LOGOUT_MS);
      }, warningAt);
    } else {
      // Timeout is less than 5 minutes - just logout directly
      logoutTimerRef.current = window.setTimeout(() => {
        handleLogout();
      }, totalMs);
    }
  }, [timeoutHours, user, clearAllTimers, handleLogout]);

  // Set up activity listeners
  useEffect(() => {
    if (!timeoutHours || timeoutHours <= 0 || !user) {
      clearAllTimers();
      return;
    }

    const handleActivity = () => {
      const now = Date.now();
      if (now - throttleRef.current < THROTTLE_MS) return;
      throttleRef.current = now;
      lastActivityRef.current = now;

      // Only reset if warning is not showing
      if (!showWarning) {
        resetTimers();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Handle tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Check if we should have timed out while tab was hidden
        const elapsed = Date.now() - lastActivityRef.current;
        const totalMs = timeoutHours * 60 * 60 * 1000;
        if (elapsed >= totalMs) {
          handleLogout();
        } else {
          handleActivity();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    // Start initial timers
    resetTimers();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibility);
      clearAllTimers();
    };
  }, [timeoutHours, user, showWarning, resetTimers, clearAllTimers, handleLogout]);

  const handleContinue = () => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    resetTimers();
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {children}
      <AlertDialog open={showWarning} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upozorenje o neaktivnosti</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Vaša sesija će biti zatvorena zbog neaktivnosti za{" "}
                <span className="font-bold text-foreground">{formatTime(secondsLeft)}</span>.
              </p>
              <p>Kliknite na "Nastavi rad" da biste ostali prijavljeni.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleLogout}>
              Odjavi se
            </Button>
            <Button onClick={handleContinue}>
              Nastavi rad
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
