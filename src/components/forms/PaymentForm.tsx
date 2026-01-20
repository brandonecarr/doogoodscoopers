"use client";

import { useState } from "react";
import {
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { motion } from "framer-motion";
import { CreditCard, Lock, Loader2 } from "lucide-react";

interface PaymentFormProps {
  onTokenGenerated: (token: string, nameOnCard: string) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
}

export function PaymentForm({ onTokenGenerated, onError, isProcessing }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [nameOnCard, setNameOnCard] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [isCardComplete, setIsCardComplete] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      onError("Payment system not loaded. Please refresh and try again.");
      return;
    }

    if (!nameOnCard.trim()) {
      onError("Please enter the name on your card.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError("Card element not found. Please refresh and try again.");
      return;
    }

    const { error, token } = await stripe.createToken(cardElement, {
      name: nameOnCard,
    });

    if (error) {
      setCardError(error.message || "An error occurred with your card.");
      onError(error.message || "An error occurred with your card.");
    } else if (token) {
      setCardError(null);
      onTokenGenerated(token.id, nameOnCard);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#002842",
        fontFamily: '"Inter", system-ui, sans-serif',
        "::placeholder": {
          color: "#9CA3AF",
        },
        iconColor: "#9CD5CF",
      },
      invalid: {
        color: "#EF4444",
        iconColor: "#EF4444",
      },
    },
    hidePostalCode: true,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-navy-700 mb-4">
        <Lock className="w-4 h-4 text-teal-500" />
        <span className="text-sm">Your payment information is secure and encrypted</span>
      </div>

      {/* Name on Card */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1.5">
          Name on Card
        </label>
        <input
          type="text"
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          placeholder="John Doe"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all"
          disabled={isProcessing}
        />
      </div>

      {/* Card Element */}
      <div>
        <label className="block text-sm font-medium text-navy-900 mb-1.5">
          Card Details
        </label>
        <div className="relative">
          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400 pointer-events-none" />
          <div className="w-full pl-12 pr-4 py-3.5 rounded-lg border border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all bg-white">
            <CardElement
              options={cardElementOptions}
              onChange={(e) => {
                setIsCardComplete(e.complete);
                if (e.error) {
                  setCardError(e.error.message);
                } else {
                  setCardError(null);
                }
              }}
            />
          </div>
        </div>
        {cardError && (
          <p className="mt-1 text-sm text-red-500">{cardError}</p>
        )}
      </div>

      {/* Hidden submit handler - actual submit is triggered from parent */}
      <input
        type="hidden"
        id="payment-submit-trigger"
        onClick={handleSubmit}
      />
    </div>
  );
}

// Export a hook to trigger payment from parent
export function usePaymentSubmit() {
  const stripe = useStripe();
  const elements = useElements();

  const submitPayment = async (nameOnCard: string): Promise<{ token?: string; error?: string }> => {
    if (!stripe || !elements) {
      return { error: "Payment system not loaded. Please refresh and try again." };
    }

    if (!nameOnCard.trim()) {
      return { error: "Please enter the name on your card." };
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return { error: "Card element not found. Please refresh and try again." };
    }

    const { error, token } = await stripe.createToken(cardElement, {
      name: nameOnCard,
    });

    if (error) {
      return { error: error.message || "An error occurred with your card." };
    }

    if (token) {
      return { token: token.id };
    }

    return { error: "Failed to process card." };
  };

  return { submitPayment, isReady: !!stripe && !!elements };
}
