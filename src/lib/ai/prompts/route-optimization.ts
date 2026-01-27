/**
 * AI Prompt Templates for Route Optimization
 *
 * Structured prompts for different route analysis scenarios.
 */

export interface ClientLocation {
  id: string;
  subscriptionId: string;
  clientName: string;
  address: string;
  latitude: number;
  longitude: number;
  preferredDay: string | null;
  techId: string | null;
  techName: string;
  frequency: string;
}

export interface Tech {
  id: string;
  name: string;
}

export interface NewClientInfo {
  address: string;
  latitude: number;
  longitude: number;
}

/**
 * Build prompt for new client placement analysis
 */
export function buildNewClientPlacementPrompt(
  newClient: NewClientInfo,
  existingClients: ClientLocation[],
  techs: Tech[],
  daysOff: string[]
): string {
  const availableDays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ].filter((day) => !daysOff.includes(day));

  // Group clients by day
  const clientsByDay: Record<string, ClientLocation[]> = {};
  for (const day of availableDays) {
    clientsByDay[day] = existingClients.filter(
      (c) => c.preferredDay === day
    );
  }

  // Format client data for each day
  const dayData = availableDays
    .map((day) => {
      const clients = clientsByDay[day];
      if (clients.length === 0) {
        return `${day}: No clients scheduled`;
      }
      const clientList = clients
        .map(
          (c) =>
            `  - ${c.clientName} at ${c.address} (${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}) - Tech: ${c.techName}`
        )
        .join("\n");
      return `${day} (${clients.length} clients):\n${clientList}`;
    })
    .join("\n\n");

  const techList = techs.map((t) => `- ${t.name} (ID: ${t.id})`).join("\n");

  return `You are a route optimization assistant for a pet waste removal company. Your task is to determine the best day and technician for a new client based on geographic proximity to existing clients.

## New Client Location
Address: ${newClient.address}
Coordinates: (${newClient.latitude.toFixed(6)}, ${newClient.longitude.toFixed(6)})

## Available Technicians
${techList}

## Existing Clients by Day
${dayData}

## Days Not Available
${daysOff.length > 0 ? daysOff.join(", ") : "None - all days available"}

## Instructions
1. Analyze the geographic proximity of the new client to existing clients on each available day.
2. Consider which technician already services clients near the new location.
3. Balance route efficiency (minimize travel between stops) with workload distribution.
4. Prefer days where the new client would fit naturally into an existing route cluster.

## Response Format
Respond with a JSON object in this exact format:
{
  "suggestedDay": "MONDAY",
  "suggestedTechId": "tech-uuid-here",
  "suggestedTechName": "John Smith",
  "reasoning": "A 1-2 sentence explanation of why this is the best fit.",
  "nearbyClients": [
    {
      "clientName": "Client Name",
      "address": "123 Main St",
      "distance": "0.3 mi"
    }
  ],
  "confidence": "high"
}

Only include the 3-5 nearest clients in nearbyClients. Calculate approximate air distances.`;
}

/**
 * Build prompt for continuous route optimization check
 */
export function buildContinuousOptimizationPrompt(
  clients: ClientLocation[],
  techs: Tech[],
  daysOff: string[]
): string {
  const availableDays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ].filter((day) => !daysOff.includes(day));

  // Group clients by day
  const clientsByDay: Record<string, ClientLocation[]> = {};
  for (const day of availableDays) {
    clientsByDay[day] = clients.filter((c) => c.preferredDay === day);
  }

  // Format client data
  const dayData = availableDays
    .map((day) => {
      const dayClients = clientsByDay[day];
      if (dayClients.length === 0) {
        return `${day}: No clients scheduled`;
      }
      const clientList = dayClients
        .map(
          (c) =>
            `  - ${c.clientName} (${c.subscriptionId.slice(0, 8)}) at ${c.address} (${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}) - Tech: ${c.techName}`
        )
        .join("\n");
      return `${day} (${dayClients.length} clients):\n${clientList}`;
    })
    .join("\n\n");

  return `You are a route optimization assistant for a pet waste removal company. Your task is to identify clients who would significantly reduce total travel distance if moved to a different service day.

## Current Route Schedule
${dayData}

## Days Not Available
${daysOff.length > 0 ? daysOff.join(", ") : "None - all days available"}

## Instructions
1. Analyze geographic clusters on each day.
2. Identify clients who are geographically isolated from others on their current day.
3. Check if those clients would be closer to clusters on different days.
4. Only suggest moves that would result in meaningful efficiency gains (at least 0.5 miles reduction).
5. Consider workload balance - don't overload any single day.

## Response Format
Respond with a JSON object:
{
  "suggestions": [
    {
      "subscriptionId": "sub-uuid",
      "clientName": "Client Name",
      "currentDay": "MONDAY",
      "suggestedDay": "WEDNESDAY",
      "currentTechId": "tech-uuid",
      "suggestedTechId": "tech-uuid",
      "suggestedTechName": "Jane Doe",
      "reasoning": "This client is 2.1 miles from the nearest Monday client but only 0.3 miles from the Wednesday cluster.",
      "estimatedSavingsMinutes": 8
    }
  ],
  "summary": "Found 2 optimization opportunities that could save approximately 15 minutes per week."
}

Only include suggestions with clear efficiency benefits. It's okay to return an empty suggestions array if no improvements are found.`;
}

/**
 * Build prompt for full route reorganization
 */
export function buildFullReorgPrompt(
  clients: ClientLocation[],
  techs: Tech[],
  daysOff: string[]
): string {
  const availableDays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ].filter((day) => !daysOff.includes(day));

  // Format all clients with their coordinates
  const clientList = clients
    .map(
      (c) =>
        `- ${c.clientName} (${c.subscriptionId.slice(0, 8)}) at ${c.address} (${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}) - Currently: ${c.preferredDay || "Unassigned"}, Tech: ${c.techName}`
    )
    .join("\n");

  const techList = techs.map((t) => `- ${t.name} (ID: ${t.id})`).join("\n");

  return `You are a route optimization assistant for a pet waste removal company. Your task is to completely reorganize all routes for maximum efficiency.

## All Clients (${clients.length} total)
${clientList}

## Available Technicians
${techList}

## Available Service Days
${availableDays.join(", ")}

## Days Not Available
${daysOff.length > 0 ? daysOff.join(", ") : "None"}

## Instructions
1. Group clients geographically into efficient route clusters.
2. Assign each cluster to an available day.
3. Assign technicians to days based on cluster density and workload balance.
4. Minimize total travel distance across all routes.
5. Balance workload roughly equally across available days.
6. Keep weekly client frequencies in mind (some clients are weekly, biweekly, etc.)

## Response Format
Respond with a JSON object:
{
  "assignments": [
    {
      "subscriptionId": "sub-uuid",
      "clientName": "Client Name",
      "newDay": "TUESDAY",
      "newTechId": "tech-uuid",
      "newTechName": "John Smith"
    }
  ],
  "dayStats": {
    "MONDAY": { "clientCount": 12, "techName": "John Smith" },
    "TUESDAY": { "clientCount": 10, "techName": "Jane Doe" }
  },
  "summary": "Reorganized 45 clients across 5 days. Estimated 40% reduction in total travel distance.",
  "estimatedSavingsMinutes": 120
}`;
}
