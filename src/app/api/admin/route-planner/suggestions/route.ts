/**
 * Route Optimization Suggestions API
 *
 * Manages AI-generated route optimization suggestions.
 * GET: List pending suggestions
 * POST: Accept or dismiss a suggestion
 *
 * Requires routes:write permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface Suggestion {
  id: string;
  subscriptionId: string | null;
  suggestionType: string;
  currentState: {
    day?: string;
    techId?: string;
    clientName?: string;
    address?: string;
  };
  suggestedState: {
    day?: string;
    techId?: string;
    techName?: string;
  };
  reasoning: string;
  timeImpactMinutes: number | null;
  status: string;
  createdAt: string;
  clientName?: string;
  address?: string;
}

interface SuggestionActionRequest {
  suggestionId: string;
  action: "accept" | "dismiss";
}

/**
 * GET /api/admin/route-planner/suggestions
 * List route optimization suggestions
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const orgId = auth.user.orgId;

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  try {
    // Get suggestions with subscription/client info
    const { data: suggestions, error } = await supabase
      .from("route_optimization_suggestions")
      .select(`
        id,
        subscription_id,
        suggestion_type,
        current_state,
        suggested_state,
        reasoning,
        time_impact_minutes,
        status,
        created_at,
        subscription:subscriptions (
          client:clients (
            first_name,
            last_name,
            company_name
          ),
          location:locations (
            address_line1,
            city
          )
        )
      `)
      .eq("org_id", orgId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching suggestions:", error);
      return NextResponse.json(
        { error: "Failed to fetch suggestions" },
        { status: 500 }
      );
    }

    // Get last analysis run
    const { data: lastRun } = await supabase
      .from("route_analysis_runs")
      .select("completed_at, run_type, suggestions_generated")
      .eq("org_id", orgId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    // Transform data
    const transformedSuggestions: Suggestion[] = (suggestions || []).map((s) => {
      const subscription = s.subscription as unknown as {
        client: {
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
        } | null;
        location: {
          address_line1: string;
          city: string;
        } | null;
      } | null;

      let clientName = "";
      if (subscription?.client) {
        if (subscription.client.company_name) {
          clientName = subscription.client.company_name;
        } else {
          clientName = `${subscription.client.first_name || ""} ${subscription.client.last_name || ""}`.trim();
        }
      } else if ((s.current_state as { clientName?: string })?.clientName) {
        clientName = (s.current_state as { clientName: string }).clientName;
      }

      const address = subscription?.location
        ? `${subscription.location.address_line1}, ${subscription.location.city}`
        : (s.current_state as { address?: string })?.address || "";

      return {
        id: s.id,
        subscriptionId: s.subscription_id,
        suggestionType: s.suggestion_type,
        currentState: s.current_state as Suggestion["currentState"],
        suggestedState: s.suggested_state as Suggestion["suggestedState"],
        reasoning: s.reasoning,
        timeImpactMinutes: s.time_impact_minutes,
        status: s.status,
        createdAt: s.created_at,
        clientName,
        address,
      };
    });

    return NextResponse.json({
      suggestions: transformedSuggestions,
      total: transformedSuggestions.length,
      lastAnalysis: lastRun
        ? {
            completedAt: lastRun.completed_at,
            runType: lastRun.run_type,
            suggestionsGenerated: lastRun.suggestions_generated,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in suggestions API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/route-planner/suggestions
 * Accept or dismiss a suggestion
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const orgId = auth.user.orgId;

  try {
    const body: SuggestionActionRequest = await request.json();

    if (!body.suggestionId) {
      return NextResponse.json(
        { error: "Suggestion ID is required" },
        { status: 400 }
      );
    }

    if (!["accept", "dismiss"].includes(body.action)) {
      return NextResponse.json(
        { error: "Action must be 'accept' or 'dismiss'" },
        { status: 400 }
      );
    }

    // Get the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from("route_optimization_suggestions")
      .select("*")
      .eq("id", body.suggestionId)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: "Suggestion has already been processed" },
        { status: 400 }
      );
    }

    // Update suggestion status
    const newStatus = body.action === "accept" ? "accepted" : "dismissed";
    const { error: updateError } = await supabase
      .from("route_optimization_suggestions")
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.user.id,
      })
      .eq("id", body.suggestionId);

    if (updateError) {
      console.error("Error updating suggestion:", updateError);
      return NextResponse.json(
        { error: "Failed to update suggestion" },
        { status: 500 }
      );
    }

    // If accepted and has subscription, update the subscription's preferred_day
    if (body.action === "accept" && suggestion.subscription_id) {
      const suggestedState = suggestion.suggested_state as {
        day?: string;
        techId?: string;
      };

      if (suggestedState.day) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({ preferred_day: suggestedState.day })
          .eq("id", suggestion.subscription_id);

        if (subError) {
          console.error("Error updating subscription:", subError);
          // Don't fail the request, just log the error
        }
      }

      // Log activity
      await supabase.from("activity_log").insert({
        org_id: orgId,
        user_id: auth.user.id,
        action: "suggestion_accepted",
        entity_type: "subscription",
        entity_id: suggestion.subscription_id,
        metadata: {
          suggestion_id: suggestion.id,
          suggestion_type: suggestion.suggestion_type,
          old_day: (suggestion.current_state as { day?: string })?.day,
          new_day: suggestedState.day,
        },
      });
    }

    return NextResponse.json({
      success: true,
      suggestion: {
        id: suggestion.id,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Error in suggestion action API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
