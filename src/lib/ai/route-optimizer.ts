/**
 * Route Optimizer AI Service
 *
 * Uses Claude AI to analyze and optimize service routes.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  buildNewClientPlacementPrompt,
  buildContinuousOptimizationPrompt,
  buildFullReorgPrompt,
  type ClientLocation,
  type Tech,
  type NewClientInfo,
} from "./prompts/route-optimization";
import { calculateAirDistance, formatDistance } from "../distance-utils";

// Response types
export interface PlacementSuggestion {
  suggestedDay: string;
  suggestedTechId: string;
  suggestedTechName: string;
  reasoning: string;
  nearbyClients: Array<{
    clientName: string;
    address: string;
    distance: string;
  }>;
  confidence: "high" | "medium" | "low";
}

export interface OptimizationSuggestion {
  subscriptionId: string;
  clientName: string;
  currentDay: string;
  suggestedDay: string;
  currentTechId: string | null;
  suggestedTechId: string;
  suggestedTechName: string;
  reasoning: string;
  estimatedSavingsMinutes: number;
}

export interface ReorgAssignment {
  subscriptionId: string;
  clientName: string;
  newDay: string;
  newTechId: string;
  newTechName: string;
}

export interface ReorgResult {
  assignments: ReorgAssignment[];
  dayStats: Record<string, { clientCount: number; techName: string }>;
  summary: string;
  estimatedSavingsMinutes: number;
}

export class RouteOptimizer {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  /**
   * Check if the optimizer is properly configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Analyze where a new client fits best in existing routes
   */
  async analyzeNewClientPlacement(
    newClient: NewClientInfo,
    existingClients: ClientLocation[],
    techs: Tech[],
    daysOff: string[] = []
  ): Promise<PlacementSuggestion | null> {
    if (!this.client) {
      console.error("Anthropic client not configured");
      return this.getFallbackPlacement(newClient, existingClients, techs, daysOff);
    }

    const prompt = buildNewClientPlacementPrompt(
      newClient,
      existingClients,
      techs,
      daysOff
    );

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Extract the text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        console.error("No text content in AI response");
        return this.getFallbackPlacement(newClient, existingClients, techs, daysOff);
      }

      // Parse the JSON response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in AI response");
        return this.getFallbackPlacement(newClient, existingClients, techs, daysOff);
      }

      const result = JSON.parse(jsonMatch[0]) as PlacementSuggestion;
      return result;
    } catch (error) {
      console.error("Error calling Claude API:", error);
      return this.getFallbackPlacement(newClient, existingClients, techs, daysOff);
    }
  }

  /**
   * Check all routes for optimization opportunities
   */
  async analyzeRoutesForOptimization(
    clients: ClientLocation[],
    techs: Tech[],
    daysOff: string[] = []
  ): Promise<OptimizationSuggestion[]> {
    if (!this.client) {
      console.error("Anthropic client not configured");
      return [];
    }

    const prompt = buildContinuousOptimizationPrompt(clients, techs, daysOff);

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        return [];
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const result = JSON.parse(jsonMatch[0]) as {
        suggestions: OptimizationSuggestion[];
      };
      return result.suggestions || [];
    } catch (error) {
      console.error("Error calling Claude API:", error);
      return [];
    }
  }

  /**
   * Analyze and recommend full route reorganization
   */
  async analyzeFullReorganization(
    clients: ClientLocation[],
    techs: Tech[],
    daysOff: string[] = []
  ): Promise<ReorgResult | null> {
    if (!this.client) {
      console.error("Anthropic client not configured");
      return null;
    }

    const prompt = buildFullReorgPrompt(clients, techs, daysOff);

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        return null;
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      return JSON.parse(jsonMatch[0]) as ReorgResult;
    } catch (error) {
      console.error("Error calling Claude API:", error);
      return null;
    }
  }

  /**
   * Fallback placement when AI is not available
   * Uses simple distance-based heuristics
   */
  private getFallbackPlacement(
    newClient: NewClientInfo,
    existingClients: ClientLocation[],
    techs: Tech[],
    daysOff: string[]
  ): PlacementSuggestion {
    const availableDays = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ].filter((day) => !daysOff.includes(day));

    // Find nearest clients and their days
    const clientsWithDistance = existingClients
      .filter((c) => c.preferredDay && !daysOff.includes(c.preferredDay))
      .map((c) => ({
        ...c,
        distance: calculateAirDistance(
          newClient.latitude,
          newClient.longitude,
          c.latitude,
          c.longitude
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Find the day with the most nearby clients
    const dayScores: Record<string, { count: number; totalDistance: number }> =
      {};
    for (const day of availableDays) {
      dayScores[day] = { count: 0, totalDistance: 0 };
    }

    // Score each day based on proximity of its clients to the new location
    for (const client of clientsWithDistance.slice(0, 10)) {
      if (client.preferredDay && dayScores[client.preferredDay]) {
        dayScores[client.preferredDay].count++;
        dayScores[client.preferredDay].totalDistance += client.distance;
      }
    }

    // Find the best day (most clients within 2 miles)
    let bestDay = availableDays[0];
    let bestScore = -1;

    for (const day of availableDays) {
      const nearbyCount = clientsWithDistance.filter(
        (c) => c.preferredDay === day && c.distance < 3218 // 2 miles in meters
      ).length;
      if (nearbyCount > bestScore) {
        bestScore = nearbyCount;
        bestDay = day;
      }
    }

    // Find the most common tech for that day
    const techsOnBestDay = clientsWithDistance
      .filter((c) => c.preferredDay === bestDay && c.techId)
      .map((c) => c.techId);

    const techCounts: Record<string, number> = {};
    for (const techId of techsOnBestDay) {
      if (techId) {
        techCounts[techId] = (techCounts[techId] || 0) + 1;
      }
    }

    let suggestedTechId = techs[0]?.id || "";
    let suggestedTechName = techs[0]?.name || "Unassigned";
    let maxCount = 0;

    for (const [techId, count] of Object.entries(techCounts)) {
      if (count > maxCount) {
        maxCount = count;
        suggestedTechId = techId;
        const tech = techs.find((t) => t.id === techId);
        suggestedTechName = tech?.name || "Unknown";
      }
    }

    // Get nearby clients for the suggested day
    const nearbyClients = clientsWithDistance
      .filter((c) => c.preferredDay === bestDay)
      .slice(0, 5)
      .map((c) => ({
        clientName: c.clientName,
        address: c.address,
        distance: formatDistance(c.distance, "miles"),
      }));

    return {
      suggestedDay: bestDay,
      suggestedTechId,
      suggestedTechName,
      reasoning: `Based on proximity analysis, ${bestDay} has ${bestScore} client${bestScore !== 1 ? "s" : ""} within 2 miles of this location.`,
      nearbyClients,
      confidence: bestScore >= 3 ? "high" : bestScore >= 1 ? "medium" : "low",
    };
  }
}

// Singleton instance
let optimizerInstance: RouteOptimizer | null = null;

export function getRouteOptimizer(): RouteOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new RouteOptimizer();
  }
  return optimizerInstance;
}
