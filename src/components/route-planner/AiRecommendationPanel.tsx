"use client";

import { Sparkles, MapPin, Navigation, Check, X, Calendar, User } from "lucide-react";

interface NearbyClient {
  clientName: string;
  address: string;
  distance: string;
}

interface Recommendation {
  suggestedDay: string;
  suggestedTechId: string;
  suggestedTechName: string;
  nearbyClients: NearbyClient[];
  reasoning: string;
}

interface MapTech {
  id: string;
  name: string;
  color: string;
}

interface AiRecommendationPanelProps {
  recommendation: Recommendation;
  techs: MapTech[];
  onAccept: () => void;
  onChooseDifferent: () => void;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export function AiRecommendationPanel({
  recommendation,
  techs,
  onAccept,
  onChooseDifferent,
}: AiRecommendationPanelProps) {
  const tech = techs.find((t) => t.id === recommendation.suggestedTechId);
  const techColor = tech?.color || "#6B7280";

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-white" />
        <h3 className="text-white font-semibold">AI Recommendation</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Main recommendation */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-gray-700 mb-4">{recommendation.reasoning}</p>

          <div className="flex items-center gap-6">
            {/* Suggested Day */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Best Day</p>
                <p className="font-semibold text-gray-900">
                  {DAY_LABELS[recommendation.suggestedDay] || recommendation.suggestedDay}
                </p>
              </div>
            </div>

            {/* Suggested Tech */}
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${techColor}20` }}
              >
                <User className="w-5 h-5" style={{ color: techColor }} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Best Tech</p>
                <p className="font-semibold text-gray-900">
                  {recommendation.suggestedTechName}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Nearby clients */}
        {recommendation.nearbyClients.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Nearby Clients on {DAY_LABELS[recommendation.suggestedDay]}
            </h4>
            <div className="space-y-2">
              {recommendation.nearbyClients.map((client, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg px-3 py-2 flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">{client.clientName}</p>
                    <p className="text-gray-500 text-xs">{client.address}</p>
                  </div>
                  <div className="flex items-center gap-1 text-primary font-medium">
                    <Navigation className="w-3 h-3" />
                    {client.distance}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium"
          >
            <Check className="w-4 h-4" />
            Accept Recommendation
          </button>
          <button
            onClick={onChooseDifferent}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            <X className="w-4 h-4" />
            Choose Different
          </button>
        </div>
      </div>
    </div>
  );
}
