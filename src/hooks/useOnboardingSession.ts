"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface SessionData {
  sessionId?: string;
  currentStep?: string;
  inServiceArea?: boolean;
  zip?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  dogCount?: number;
  frequency?: string;
  pricingSnapshot?: Record<string, unknown>;
  selectedPlanSnapshot?: Record<string, unknown>;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  referralCode?: string;
}

interface UseOnboardingSessionReturn {
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  startSession: (initialData?: SessionData) => Promise<string | null>;
  updateSession: (data: SessionData) => Promise<void>;
  logEvent: (eventType: string, step?: string, payload?: Record<string, unknown>) => Promise<void>;
  completeSession: (convertedClientId?: string) => Promise<void>;
  abandonSession: () => Promise<void>;
}

// Feature flag to enable/disable session tracking
const ENABLE_SESSION_TRACKING = process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_TRACKING !== "false";

export function useOnboardingSession(): UseOnboardingSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track if session has been started to prevent duplicate calls
  const sessionStartedRef = useRef(false);

  // Parse UTM parameters from URL on mount
  const utmRef = useRef<SessionData["utm"]>(undefined);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      utmRef.current = {
        source: params.get("utm_source") || undefined,
        medium: params.get("utm_medium") || undefined,
        campaign: params.get("utm_campaign") || undefined,
        content: params.get("utm_content") || undefined,
        term: params.get("utm_term") || undefined,
      };
    }
  }, []);

  // Start a new onboarding session
  const startSession = useCallback(async (initialData?: SessionData): Promise<string | null> => {
    if (!ENABLE_SESSION_TRACKING) {
      return null;
    }

    // Prevent duplicate session creation
    if (sessionStartedRef.current || sessionId) {
      return sessionId;
    }

    sessionStartedRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v2/onboarding/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...initialData,
          utm: utmRef.current,
        }),
      });

      const result = await response.json();

      if (result.success && result.sessionId) {
        setSessionId(result.sessionId);
        return result.sessionId;
      } else {
        setError(result.error || "Failed to start session");
        sessionStartedRef.current = false;
        return null;
      }
    } catch (err) {
      console.error("Failed to start onboarding session:", err);
      setError("Failed to start session");
      sessionStartedRef.current = false;
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Update the current session
  const updateSession = useCallback(async (data: SessionData): Promise<void> => {
    if (!ENABLE_SESSION_TRACKING || !sessionId) {
      return;
    }

    try {
      await fetch("/api/v2/onboarding/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ...data,
        }),
      });
    } catch (err) {
      console.error("Failed to update onboarding session:", err);
      // Don't set error - this is non-blocking
    }
  }, [sessionId]);

  // Log an event for the current session
  const logEvent = useCallback(async (
    eventType: string,
    step?: string,
    payload?: Record<string, unknown>
  ): Promise<void> => {
    if (!ENABLE_SESSION_TRACKING || !sessionId) {
      return;
    }

    try {
      await fetch("/api/v2/onboarding/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          eventType,
          step,
          payload,
        }),
      });
    } catch (err) {
      console.error("Failed to log onboarding event:", err);
      // Don't set error - this is non-blocking
    }
  }, [sessionId]);

  // Mark session as completed
  const completeSession = useCallback(async (convertedClientId?: string): Promise<void> => {
    if (!ENABLE_SESSION_TRACKING || !sessionId) {
      return;
    }

    try {
      await fetch("/api/v2/onboarding/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: "COMPLETED",
          convertedClientId,
        }),
      });
    } catch (err) {
      console.error("Failed to complete onboarding session:", err);
    }
  }, [sessionId]);

  // Mark session as abandoned
  const abandonSession = useCallback(async (): Promise<void> => {
    if (!ENABLE_SESSION_TRACKING || !sessionId) {
      return;
    }

    try {
      await fetch("/api/v2/onboarding/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: "ABANDONED",
        }),
      });
    } catch (err) {
      console.error("Failed to abandon onboarding session:", err);
    }
  }, [sessionId]);

  return {
    sessionId,
    isLoading,
    error,
    startSession,
    updateSession,
    logEvent,
    completeSession,
    abandonSession,
  };
}
