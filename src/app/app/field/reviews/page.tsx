"use client";

import { useState, useEffect, useCallback } from "react";
import { Star } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  clientName: string;
  date: string;
  rating: number;
  comment: string | null;
}

interface ReviewsData {
  averageRating: number;
  totalCount: number;
  reviews: Review[];
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const starSize = size === "lg" ? "w-8 h-8" : "w-4 h-4";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            starSize,
            star <= rating ? "fill-teal-500 text-teal-500" : "fill-gray-300 text-gray-300"
          )}
        />
      ))}
    </div>
  );
}

export default function ClientReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [reviewsData, setReviewsData] = useState<ReviewsData>({
    averageRating: 5.0,
    totalCount: 0,
    reviews: [],
  });

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/field/reviews");
      if (res.ok) {
        const data = await res.json();
        setReviewsData({
          averageRating: data.averageRating || 5.0,
          totalCount: data.totalCount || 0,
          reviews: data.reviews || [],
        });
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Rating Summary Card */}
      <FieldContentCard>
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-6 rounded-t-xl mb-4 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Reviews</h2>
          <div className="text-5xl font-bold text-gray-900 mb-2">
            {reviewsData.averageRating.toFixed(1)}
          </div>
          <div className="flex justify-center mb-2">
            <StarRating rating={Math.round(reviewsData.averageRating)} size="lg" />
          </div>
          <p className="text-sm text-gray-600">
            Based on {reviewsData.totalCount} client opinions
          </p>
        </div>
      </FieldContentCard>

      {/* Reviews List */}
      <FieldContentCard noPadding>
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Client Comments</h3>
        </div>

        {reviewsData.reviews.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No reviews yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reviewsData.reviews.map((review) => (
              <div key={review.id} className="px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{review.clientName}</span>
                  <span className="text-sm text-gray-500">{review.date}</span>
                </div>
                <div className="mb-2">
                  <StarRating rating={review.rating} />
                </div>
                <p className="text-sm text-gray-500">
                  {review.comment || "No Comment"}
                </p>
              </div>
            ))}
          </div>
        )}
      </FieldContentCard>
    </div>
  );
}
