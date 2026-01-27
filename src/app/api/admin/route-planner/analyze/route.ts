/**
 * Route Planner AI Analysis API
 *
 * Analyzes routes using AI to provide optimization suggestions.
 * Supports three analysis types:
 * - new_client: Find best placement for a new client
 * - continuous_check: Check for optimization opportunities
 * - full_reorg: Complete route reorganization
 *
 * Requires routes:write permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";
import {
  getRouteOptimizer,
  type PlacementSuggestion,
  type OptimizationSuggestion,
  type ReorgResult,
} from "@/lib/ai/route-optimizer";
import type { ClientLocation, Tech } from "@/lib/ai/prompts/route-optimization";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

interface AnalysisRequest {
  analysisType: "new_client" | "continuous_check" | "full_reorg";
  newClientLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  daysToAnalyze?: string[];
  excludeDays?: string[];
}

interface AnalysisResponse {
  suggestions: Array<{
    suggestion_type: string;
    current_state: unknown;
    suggested_state: unknown;
    reasoning: string;
    time_impact_minutes: number;
  }>;
  analysisId: string;
  summary: string;
}

/**
 * POST /api/admin/route-planner/analyze
 * Run AI analysis on routes
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "routes:write");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const supabase = getSupabase();
  const orgId = auth.user.orgId;

  try {
    const body: AnalysisRequest = await request.json();

    if (!body.analysisType) {
      return NextResponse.json(
        { error: "Analysis type is required" },
        { status: 400 }
      );
    }

    // Get org settings for days off
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const routeOptSettings = (org?.settings as Record<string, unknown>)?.routeOptimization as Record<string, unknown> | undefined;
    const daysOff = (routeOptSettings?.daysOff as string[]) || body.excludeDays || [];

    // Fetch clients with location data
    const { data: subscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        frequency,
        preferred_day,
        client:clients!inner (
          id,
          first_name,
          last_name,
          company_name
        ),
        location:locations!inner (
          id,
          address_line1,
          city,
          latitude,
          longitude
        )
      `)
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .not("location.latitude", "is", null)
      .not("location.longitude", "is", null);

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      return NextResponse.json(
        { error: "Failed to fetch subscription data" },
        { status: 500 }
      );
    }

    // Get tech assignments from recent jobs
    const subscriptionIds = (subscriptions || []).map((s) => s.id);
    let techAssignments: Record<string, string> = {};

    if (subscriptionIds.length > 0) {
      const { data: recentJobs } = await supabase
        .from("jobs")
        .select("subscription_id, assigned_to")
        .in("subscription_id", subscriptionIds)
        .not("assigned_to", "is", null)
        .order("scheduled_date", { ascending: false });

      if (recentJobs) {
        for (const job of recentJobs) {
          if (job.subscription_id && job.assigned_to && !techAssignments[job.subscription_id]) {
            techAssignments[job.subscription_id] = job.assigned_to;
          }
        }
      }
    }

    // Get all field techs
    const { data: techUsers } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .eq("org_id", orgId)
      .in("role", ["FIELD_TECH", "CREW_LEAD"])
      .eq("is_active", true);

    const techs: Tech[] = (techUsers || []).map((t) => ({
      id: t.id,
      name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || "Unknown",
    }));

    const techMap: Record<string, string> = {};
    for (const tech of techs) {
      techMap[tech.id] = tech.name;
    }

    // Transform subscriptions to ClientLocation format
    const clients: ClientLocation[] = (subscriptions || []).map((sub) => {
      const client = sub.client as unknown as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
      };
      const location = sub.location as unknown as {
        id: string;
        address_line1: string;
        city: string;
        latitude: number;
        longitude: number;
      };

      let clientName = "";
      if (client.company_name) {
        clientName = client.company_name;
      } else {
        clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim();
      }

      const techId = techAssignments[sub.id] || null;

      return {
        id: client.id,
        subscriptionId: sub.id,
        clientName,
        address: `${location.address_line1}, ${location.city}`,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        preferredDay: sub.preferred_day,
        techId,
        techName: techId ? techMap[techId] || "Unknown" : "Unassigned",
        frequency: sub.frequency,
      };
    });

    // Create analysis run record
    const { data: analysisRun, error: runError } = await supabase
      .from("route_analysis_runs")
      .insert({
        org_id: orgId,
        run_type: body.analysisType,
        metadata: {
          clients_analyzed: clients.length,
          days_off: daysOff,
        },
      })
      .select("id")
      .single();

    if (runError) {
      console.error("Error creating analysis run:", runError);
    }

    const analysisId = analysisRun?.id || "unknown";

    // Get the optimizer
    const optimizer = getRouteOptimizer();

    let response: AnalysisResponse;

    switch (body.analysisType) {
      case "new_client": {
        if (!body.newClientLocation) {
          return NextResponse.json(
            { error: "New client location is required for new_client analysis" },
            { status: 400 }
          );
        }

        const suggestion = await optimizer.analyzeNewClientPlacement(
          {
            address: body.newClientLocation.address,
            latitude: body.newClientLocation.latitude,
            longitude: body.newClientLocation.longitude,
          },
          clients,
          techs,
          daysOff
        );

        if (suggestion) {
          // Save suggestion to database
          await supabase.from("route_optimization_suggestions").insert({
            org_id: orgId,
            suggestion_type: "new_client_placement",
            current_state: {
              address: body.newClientLocation.address,
              latitude: body.newClientLocation.latitude,
              longitude: body.newClientLocation.longitude,
            },
            suggested_state: {
              day: suggestion.suggestedDay,
              techId: suggestion.suggestedTechId,
              techName: suggestion.suggestedTechName,
              nearbyClients: suggestion.nearbyClients,
            },
            reasoning: suggestion.reasoning,
            status: "pending",
          });

          response = {
            suggestions: [
              {
                suggestion_type: "new_client_placement",
                current_state: body.newClientLocation,
                suggested_state: {
                  day: suggestion.suggestedDay,
                  techId: suggestion.suggestedTechId,
                  techName: suggestion.suggestedTechName,
                  nearbyClients: suggestion.nearbyClients,
                },
                reasoning: suggestion.reasoning,
                time_impact_minutes: 0,
              },
            ],
            analysisId,
            summary: suggestion.reasoning,
          };
        } else {
          response = {
            suggestions: [],
            analysisId,
            summary: "Unable to generate placement recommendation",
          };
        }
        break;
      }

      case "continuous_check": {
        const suggestions = await optimizer.analyzeRoutesForOptimization(
          clients,
          techs,
          daysOff
        );

        // Save suggestions to database
        for (const suggestion of suggestions) {
          await supabase.from("route_optimization_suggestions").insert({
            org_id: orgId,
            subscription_id: suggestion.subscriptionId,
            suggestion_type: "move_day",
            current_state: {
              day: suggestion.currentDay,
              techId: suggestion.currentTechId,
            },
            suggested_state: {
              day: suggestion.suggestedDay,
              techId: suggestion.suggestedTechId,
              techName: suggestion.suggestedTechName,
            },
            reasoning: suggestion.reasoning,
            time_impact_minutes: suggestion.estimatedSavingsMinutes,
            status: "pending",
          });
        }

        response = {
          suggestions: suggestions.map((s) => ({
            suggestion_type: "move_day",
            current_state: {
              day: s.currentDay,
              techId: s.currentTechId,
              clientName: s.clientName,
              subscriptionId: s.subscriptionId,
            },
            suggested_state: {
              day: s.suggestedDay,
              techId: s.suggestedTechId,
              techName: s.suggestedTechName,
            },
            reasoning: s.reasoning,
            time_impact_minutes: s.estimatedSavingsMinutes,
          })),
          analysisId,
          summary: `Found ${suggestions.length} optimization opportunity${suggestions.length !== 1 ? "ies" : "y"}`,
        };
        break;
      }

      case "full_reorg": {
        const reorgResult = await optimizer.analyzeFullReorganization(
          clients,
          techs,
          daysOff
        );

        if (reorgResult) {
          // Save all assignments as suggestions
          for (const assignment of reorgResult.assignments) {
            const currentClient = clients.find(
              (c) => c.subscriptionId === assignment.subscriptionId
            );

            await supabase.from("route_optimization_suggestions").insert({
              org_id: orgId,
              subscription_id: assignment.subscriptionId,
              suggestion_type: "full_reorg",
              current_state: {
                day: currentClient?.preferredDay,
                techId: currentClient?.techId,
              },
              suggested_state: {
                day: assignment.newDay,
                techId: assignment.newTechId,
                techName: assignment.newTechName,
              },
              reasoning: reorgResult.summary,
              time_impact_minutes: Math.round(
                reorgResult.estimatedSavingsMinutes / reorgResult.assignments.length
              ),
              status: "pending",
            });
          }

          response = {
            suggestions: reorgResult.assignments.map((a) => {
              const currentClient = clients.find(
                (c) => c.subscriptionId === a.subscriptionId
              );
              return {
                suggestion_type: "full_reorg",
                current_state: {
                  day: currentClient?.preferredDay,
                  techId: currentClient?.techId,
                  clientName: a.clientName,
                  subscriptionId: a.subscriptionId,
                },
                suggested_state: {
                  day: a.newDay,
                  techId: a.newTechId,
                  techName: a.newTechName,
                },
                reasoning: reorgResult.summary,
                time_impact_minutes: Math.round(
                  reorgResult.estimatedSavingsMinutes / reorgResult.assignments.length
                ),
              };
            }),
            analysisId,
            summary: reorgResult.summary,
          };
        } else {
          response = {
            suggestions: [],
            analysisId,
            summary: "Unable to generate reorganization plan",
          };
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid analysis type" },
          { status: 400 }
        );
    }

    // Update analysis run with completion data
    if (analysisRun?.id) {
      await supabase
        .from("route_analysis_runs")
        .update({
          completed_at: new Date().toISOString(),
          suggestions_generated: response.suggestions.length,
        })
        .eq("id", analysisRun.id);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in route analysis API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
