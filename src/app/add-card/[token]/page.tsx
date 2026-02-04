"use client";

import { useState, useEffect, use } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import Image from "next/image";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

interface LinkData {
  valid: boolean;
  clientName: string;
  orgName: string;
  orgLogo: string | null;
  clientSecret: string;
  linkId: string;
  error?: string;
}

function CardForm({
  clientSecret,
  linkId,
  token,
  onSuccess,
}: {
  clientSecret: string;
  linkId: string;
  token: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [nameOnCard, setNameOnCard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    if (!nameOnCard.trim()) {
      setError("Please enter the name on your card.");
      return;
    }
    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Card element not found. Please refresh and try again.");
      setProcessing(false);
      return;
    }

    const { error: stripeError } = await stripe.confirmCardSetup(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
          billing_details: { name: nameOnCard },
        },
      }
    );

    if (stripeError) {
      setError(stripeError.message || "An error occurred with your card.");
      setProcessing(false);
      return;
    }

    // Mark link as used
    try {
      await fetch(`/api/public/add-card/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId }),
      });
    } catch {
      // Link marking is best-effort
    }

    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div>
        <input
          type="text"
          placeholder="Name On Card"
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          disabled={processing}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-2">Card</label>
        <div className="px-4 py-3.5 border border-gray-200 rounded-lg focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#002842",
                  fontFamily: '"Inter", system-ui, sans-serif',
                  "::placeholder": { color: "#9CA3AF" },
                },
                invalid: { color: "#EF4444" },
              },
              hidePostalCode: true,
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="text-xs text-gray-500 italic">
        * Choose a card to be used for your payments. When you add a card, we
        will apply a $1.50 test charge to verify it. This is a temporary
        authorization and not an extra charge.
      </p>

      <button
        onClick={handleSubmit}
        disabled={processing || !stripe}
        className="w-full py-3 text-sm font-medium text-white bg-teal-400 rounded-lg hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
      >
        {processing ? "Adding Card..." : "ADD CARD"}
      </button>
    </div>
  );
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function AddCardPage({ params }: PageProps) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateLink = async () => {
      try {
        const res = await fetch(`/api/public/add-card/${token}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setError(
            data.error || "This link is invalid, expired, or has already been used."
          );
        } else {
          setLinkData(data);
        }
      } catch {
        setError("Failed to validate link. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    validateLink();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Link Unavailable
          </h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-teal-600 text-xl font-bold">&#10003;</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Card Added Successfully
          </h1>
          <p className="text-sm text-gray-500">
            Your card has been saved. You may close this page.
          </p>
        </div>
      </div>
    );
  }

  if (!linkData) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-md w-full p-8">
        {/* Logo */}
        {linkData.orgLogo ? (
          <div className="flex justify-center mb-6">
            <Image
              src={linkData.orgLogo}
              alt={linkData.orgName}
              width={200}
              height={60}
              className="h-12 w-auto object-contain"
            />
          </div>
        ) : (
          <div className="flex justify-center mb-6">
            <span className="text-xl font-bold text-gray-900">
              {linkData.orgName}
            </span>
          </div>
        )}

        {/* Heading */}
        <h1 className="text-xl font-semibold text-gray-900 mb-1">
          Add Credit Card for {linkData.clientName.toUpperCase()}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          This card will be used for your payments.
        </p>

        {/* Card Form */}
        <Elements
          stripe={stripePromise}
          options={{ clientSecret: linkData.clientSecret }}
        >
          <CardForm
            clientSecret={linkData.clientSecret}
            linkId={linkData.linkId}
            token={token}
            onSuccess={() => setSuccess(true)}
          />
        </Elements>
      </div>
    </div>
  );
}
