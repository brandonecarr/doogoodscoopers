"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Loader2,
  Dog,
  Home,
  MapPin,
  ArrowRight,
  ArrowLeft,
  User,
  DollarSign,
  Sparkles,
  CreditCard,
  Lock,
  Bell,
  PawPrint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ZipCodeChecker } from "./ZipCodeChecker";
import { OutOfAreaForm } from "./OutOfAreaForm";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

// Schema for service details step (includes basic contact for quote notification)
const serviceSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  numberOfDogs: z.string().min(1, "Please select number of dogs"),
  frequency: z.string().min(1, "Please select a frequency"),
  lastCleaned: z.string().min(1, "Please select when yard was last cleaned"),
});

// Schema for contact info step (with gate info)
const contactSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  address: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  gateLocation: z.string().min(1, "Please select gate location"),
  gateCode: z.string().optional(),
});

// Schema for individual dog info
const dogSchema = z.object({
  name: z.string().min(1, "Dog name is required"),
  breed: z.string().optional(),
  isSafe: z.enum(["yes", "no"], { message: "Please indicate if dog is safe" }),
  comments: z.string().optional(),
});

// Schema for notifications step
const notificationsSchema = z.object({
  notificationTypes: z.array(z.string()).min(1, "Please select at least one notification type"),
  notificationChannel: z.string().min(1, "Please select a notification channel"),
});

type ServiceFormData = z.infer<typeof serviceSchema>;
type ContactFormData = z.infer<typeof contactSchema>;
type DogFormData = z.infer<typeof dogSchema>;
type NotificationsFormData = z.infer<typeof notificationsSchema>;

type Step = "zip" | "service" | "quote" | "contact" | "dogs" | "notifications" | "payment" | "review" | "success" | "out-of-area";

interface PricingInfo {
  basePrice: number;
  recurringPrice: number;
  monthlyPrice?: number;
  initialCleanupFee: number;
  total: number;
  frequency: string;
  numberOfDogs: string;
  customPriceDescription?: string;
  priceNotConfigured?: boolean;
  billingInterval?: string;
  category?: string;
}

interface PaymentInfo {
  token: string;
  nameOnCard: string;
}

interface FormOption {
  value: string;
  label: string;
}

interface FormOptions {
  numberOfDogs: FormOption[];
  frequency: FormOption[];
  lastCleaned: FormOption[];
  gateLocation: FormOption[];
  notificationTypes: FormOption[];
  notificationChannels: FormOption[];
}

// Default fallback options
const defaultFormOptions: FormOptions = {
  numberOfDogs: [
    { value: "1", label: "1 Dog" },
    { value: "2", label: "2 Dogs" },
    { value: "3", label: "3 Dogs" },
    { value: "4", label: "4 Dogs" },
    { value: "5", label: "5+ Dogs" },
  ],
  frequency: [
    { value: "once_a_week", label: "Weekly" },
    { value: "two_times_a_week", label: "Twice Weekly" },
    { value: "bi_weekly", label: "Bi-Weekly (Every 2 Weeks)" },
    { value: "once_a_month", label: "Monthly" },
    { value: "one_time", label: "One-Time Cleanup" },
  ],
  lastCleaned: [
    { value: "one_week", label: "Less than 1 week ago" },
    { value: "two_weeks", label: "1-2 weeks ago" },
    { value: "three_weeks", label: "2-3 weeks ago" },
    { value: "one_month", label: "About a month ago" },
    { value: "two_months", label: "About 2 months ago" },
    { value: "3-4_months", label: "3-4 months ago" },
    { value: "5-6_months", label: "5-6 months ago" },
    { value: "10+_months", label: "10+ months / Never" },
  ],
  gateLocation: [
    { value: "left", label: "Left Side" },
    { value: "right", label: "Right Side" },
    { value: "alley", label: "Alley" },
    { value: "no_gate", label: "No Gate" },
    { value: "other", label: "Other" },
  ],
  notificationTypes: [
    { value: "off_schedule", label: "Off Schedule Alerts" },
    { value: "on_the_way", label: "On The Way Notifications" },
    { value: "completed", label: "Service Completed" },
  ],
  notificationChannels: [
    { value: "email", label: "Email" },
    { value: "sms", label: "Text Message (SMS)" },
    { value: "call", label: "Phone Call" },
  ],
};

// Inner form component that uses Stripe hooks
function QuoteFormInner() {
  const stripe = useStripe();
  const elements = useElements();

  const [step, setStep] = useState<Step>("zip");
  const [zipCode, setZipCode] = useState("");
  const [inServiceArea, setInServiceArea] = useState(false);
  const [serviceData, setServiceData] = useState<ServiceFormData | null>(null);
  const [contactData, setContactData] = useState<ContactFormData | null>(null);
  const [dogsData, setDogsData] = useState<DogFormData[]>([]);
  const [notificationsData, setNotificationsData] = useState<NotificationsFormData | null>(null);
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOptions, setFormOptions] = useState<FormOptions>(defaultFormOptions);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Payment step state
  const [nameOnCard, setNameOnCard] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [isCardComplete, setIsCardComplete] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Dogs step state
  const [currentDogIndex, setCurrentDogIndex] = useState(0);
  const [tempDogsData, setTempDogsData] = useState<DogFormData[]>([]);

  // Fetch form options from Sweep&Go on mount
  useEffect(() => {
    const fetchFormOptions = async () => {
      try {
        const response = await fetch("/api/get-form-options");
        const result = await response.json();

        if (result.success && result.formOptions) {
          const options = result.formOptions;
          const formFields = options.form_fields || [];

          const numberOfDogsField = formFields.find((f: { slug: string }) => f.slug === "number_of_dogs");
          const frequencyField = formFields.find((f: { slug: string }) => f.slug === "clean_up_frequency");
          const lastCleanedField = formFields.find((f: { slug: string }) => f.slug === "last_time_yard_was_thoroughly_cleaned");
          const gateLocationField = formFields.find((f: { slug: string }) => f.slug === "gate_location");
          const notificationTypeField = formFields.find((f: { slug: string }) => f.slug === "cleanup_notification_type");
          const notificationChannelField = formFields.find((f: { slug: string }) => f.slug === "cleanup_notification_chanel");

          const parsedOptions: FormOptions = {
            numberOfDogs: parseFieldValues(numberOfDogsField?.value, "dogs") || defaultFormOptions.numberOfDogs,
            frequency: parseFieldValues(frequencyField?.value, "frequency") || defaultFormOptions.frequency,
            lastCleaned: parseFieldValues(lastCleanedField?.value, "lastCleaned") || defaultFormOptions.lastCleaned,
            gateLocation: parseFieldValues(gateLocationField?.value, "gateLocation") || defaultFormOptions.gateLocation,
            notificationTypes: parseFieldValues(notificationTypeField?.value, "notificationTypes") || defaultFormOptions.notificationTypes,
            notificationChannels: parseFieldValues(notificationChannelField?.value, "notificationChannels") || defaultFormOptions.notificationChannels,
          };

          setFormOptions(parsedOptions);
        }
      } catch (err) {
        console.error("Error fetching form options:", err);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchFormOptions();
  }, []);

  // Parse Sweep&Go comma-separated field values into dropdown options
  const parseFieldValues = (value: string | undefined, fieldType: string): FormOption[] | null => {
    if (!value || typeof value !== "string") return null;

    const values = value.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return null;

    return values.map((val) => ({
      value: val,
      label: formatLabel(val, fieldType),
    }));
  };

  // Format raw values into user-friendly labels
  const formatLabel = (value: string, fieldType: string): string => {
    if (fieldType === "dogs") {
      const num = parseInt(value);
      if (!isNaN(num)) {
        return num === 1 ? "1 Dog" : `${num} Dogs`;
      }
      return value;
    }

    if (fieldType === "frequency") {
      const frequencyLabels: Record<string, string> = {
        "once_a_week": "Weekly",
        "two_times_a_week": "Twice Weekly",
        "bi_weekly": "Bi-Weekly (Every 2 Weeks)",
        "once_a_month": "Monthly",
        "one_time": "One-Time Cleanup",
      };
      return frequencyLabels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (fieldType === "lastCleaned") {
      const lastCleanedLabels: Record<string, string> = {
        "one_week": "Less than 1 week ago",
        "two_weeks": "1-2 weeks ago",
        "three_weeks": "2-3 weeks ago",
        "one_month": "About a month ago",
        "two_months": "About 2 months ago",
        "3-4_months": "3-4 months ago",
        "5-6_months": "5-6 months ago",
        "7-9_months": "7-9 months ago",
        "10+_months": "10+ months / Never",
      };
      return lastCleanedLabels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (fieldType === "gateLocation") {
      const gateLabels: Record<string, string> = {
        "left": "Left Side",
        "right": "Right Side",
        "alley": "Alley",
        "no_gate": "No Gate",
        "other": "Other",
      };
      return gateLabels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (fieldType === "notificationTypes") {
      const notifLabels: Record<string, string> = {
        "off_schedule": "Off Schedule Alerts",
        "on_the_way": "On The Way Notifications",
        "completed": "Service Completed",
      };
      return notifLabels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (fieldType === "notificationChannels") {
      const channelLabels: Record<string, string> = {
        "email": "Email",
        "sms": "Text Message (SMS)",
        "call": "Phone Call",
      };
      return channelLabels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Service form
  const serviceForm = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: serviceData || {},
  });

  // Contact form
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: contactData || { gateLocation: "", gateCode: "" },
  });

  // Dog form (for current dog)
  const dogForm = useForm<DogFormData>({
    resolver: zodResolver(dogSchema),
    defaultValues: { name: "", breed: "", isSafe: "yes", comments: "" },
  });

  // Notifications form
  const notificationsForm = useForm<NotificationsFormData>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: notificationsData || { notificationTypes: ["completed"], notificationChannel: "email" },
  });

  // Handle zip code check result
  const handleZipResult = (result: { inServiceArea: boolean; zipCode: string }) => {
    setZipCode(result.zipCode);
    setInServiceArea(result.inServiceArea);

    if (result.inServiceArea) {
      setStep("service");
    } else {
      setStep("out-of-area");
    }
  };

  // Fetch pricing when service details are submitted
  const fetchPricing = async (data: ServiceFormData) => {
    setIsLoadingPricing(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        zipCode,
        numberOfDogs: data.numberOfDogs,
        frequency: data.frequency,
        lastCleaned: data.lastCleaned,
      });

      const response = await fetch(`/api/get-pricing?${params.toString()}`);
      const result = await response.json();

      if (result.success && result.pricing) {
        setPricing(result.pricing);
        return true;
      } else {
        setError("Unable to fetch pricing. Please try again.");
        return false;
      }
    } catch (err) {
      console.error("Error fetching pricing:", err);
      setError("Unable to fetch pricing. Please try again.");
      return false;
    } finally {
      setIsLoadingPricing(false);
    }
  };

  // Submit free quote lead to Sweep&Go (triggers email notification to owner)
  const submitFreeQuoteLead = async (data: ServiceFormData) => {
    try {
      await fetch("/api/submit-free-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipCode,
          firstName: data.firstName,
          phone: data.phone,
          numberOfDogs: data.numberOfDogs,
          frequency: data.frequency,
          lastCleaned: data.lastCleaned,
        }),
      });
      // Fire and forget - don't wait for result or show errors
    } catch (err) {
      console.error("Error submitting free quote lead:", err);
      // Silent fail - don't disrupt user flow
    }
  };

  // Handle service form submission
  const handleServiceSubmit = async (data: ServiceFormData) => {
    setServiceData(data);
    const success = await fetchPricing(data);
    if (success) {
      // Submit free quote lead to trigger email notification
      submitFreeQuoteLead(data);
      setStep("quote");
    }
  };

  // Handle contact form submission - go to Dogs step
  const handleContactSubmit = (data: ContactFormData) => {
    setContactData(data);
    // Initialize dogs data array based on number of dogs
    const numDogs = parseInt(serviceData?.numberOfDogs || "1");
    const initialDogsData: DogFormData[] = Array(numDogs).fill(null).map(() => ({
      name: "",
      breed: "",
      isSafe: "yes" as const,
      comments: "",
    }));
    setTempDogsData(initialDogsData);
    setCurrentDogIndex(0);
    dogForm.reset({ name: "", breed: "", isSafe: "yes", comments: "" });
    setStep("dogs");
  };

  // Handle individual dog form submission
  const handleDogSubmit = (data: DogFormData) => {
    const updatedDogsData = [...tempDogsData];
    updatedDogsData[currentDogIndex] = data;
    setTempDogsData(updatedDogsData);

    const numDogs = parseInt(serviceData?.numberOfDogs || "1");
    if (currentDogIndex < numDogs - 1) {
      // Move to next dog
      setCurrentDogIndex(currentDogIndex + 1);
      const nextDog = updatedDogsData[currentDogIndex + 1];
      dogForm.reset(nextDog || { name: "", breed: "", isSafe: "yes", comments: "" });
    } else {
      // All dogs entered, save and move to notifications
      setDogsData(updatedDogsData);
      setStep("notifications");
    }
  };

  // Handle going back to previous dog
  const handlePreviousDog = () => {
    if (currentDogIndex > 0) {
      // Save current dog data
      const currentData = dogForm.getValues();
      const updatedDogsData = [...tempDogsData];
      updatedDogsData[currentDogIndex] = currentData;
      setTempDogsData(updatedDogsData);

      // Go to previous dog
      setCurrentDogIndex(currentDogIndex - 1);
      const prevDog = updatedDogsData[currentDogIndex - 1];
      dogForm.reset(prevDog || { name: "", breed: "", isSafe: "yes", comments: "" });
    } else {
      // Go back to contact
      setStep("contact");
    }
  };

  // Handle notifications form submission
  const handleNotificationsSubmit = (data: NotificationsFormData) => {
    setNotificationsData(data);
    setStep("payment");
  };

  // Handle payment form submission
  const handlePaymentSubmit = async () => {
    if (!stripe || !elements) {
      setError("Payment system not loaded. Please refresh and try again.");
      return;
    }

    if (!nameOnCard.trim()) {
      setCardError("Please enter the name on your card.");
      return;
    }

    if (!termsAccepted) {
      setError("Please accept the terms of service to continue.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Card element not found. Please refresh and try again.");
      return;
    }

    setIsProcessingPayment(true);
    setError(null);
    setCardError(null);

    try {
      const { error: stripeError, token } = await stripe.createToken(cardElement, {
        name: nameOnCard,
      });

      if (stripeError) {
        setCardError(stripeError.message || "An error occurred with your card.");
        return;
      }

      if (token) {
        setPaymentInfo({
          token: token.id,
          nameOnCard: nameOnCard,
        });
        setStep("review");
      }
    } catch (err) {
      console.error("Payment tokenization error:", err);
      setError("Failed to process card information. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Stripe CardElement styling
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

  // Final submission
  const handleFinalSubmit = async () => {
    if (!serviceData || !contactData || !paymentInfo || !notificationsData) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/submit-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...serviceData,
          ...contactData,
          zipCode,
          state: "CA",
          inServiceArea: true,
          initialCleanupRequired: serviceData.lastCleaned !== "one_week",
          // Dogs data
          dogs: dogsData.map(dog => ({
            name: dog.name,
            breed: dog.breed || "",
            safe_dog: dog.isSafe,
            comments: dog.comments || "",
          })),
          // Notification preferences
          cleanupNotificationType: notificationsData.notificationTypes,
          cleanupNotificationChannel: notificationsData.notificationChannel,
          // Payment fields
          creditCardToken: paymentInfo.token,
          nameOnCard: paymentInfo.nameOnCard,
          termsAccepted: true,
          // Pricing fields from API
          billingInterval: pricing?.billingInterval || "per_visit",
          category: pricing?.category || "prepaid",
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStep("success");
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Error submitting:", err);
      setError("Unable to complete your registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get frequency label for display
  const getFrequencyLabel = (value: string) => {
    const option = formOptions.frequency.find((o) => o.value === value);
    return option?.label || value.replace(/_/g, " ");
  };

  // Get last cleaned label for display
  const getLastCleanedLabel = (value: string) => {
    const option = formOptions.lastCleaned.find((o) => o.value === value);
    return option?.label || value.replace(/_/g, " ");
  };

  // Get gate location label for display
  const getGateLocationLabel = (value: string) => {
    const option = formOptions.gateLocation.find((o) => o.value === value);
    return option?.label || value.replace(/_/g, " ");
  };

  // Step indicator
  const steps = [
    { id: "zip", label: "Location" },
    { id: "service", label: "Service" },
    { id: "quote", label: "Quote" },
    { id: "contact", label: "Contact" },
    { id: "dogs", label: "Dogs" },
    { id: "notifications", label: "Notifications" },
    { id: "payment", label: "Payment" },
    { id: "review", label: "Review" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="w-full">
      {/* Progress Indicator */}
      {step !== "out-of-area" && step !== "success" && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-navy-900">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-sm text-teal-600 font-medium">
              {steps[currentStepIndex]?.label}
            </span>
          </div>

          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          <div className="hidden sm:flex justify-between mt-3">
            {steps.map((s, index) => (
              <div key={s.id} className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full transition-colors",
                    index < currentStepIndex
                      ? "bg-teal-500"
                      : index === currentStepIndex
                      ? "bg-teal-500 ring-2 ring-teal-200"
                      : "bg-gray-300"
                  )}
                />
                <span
                  className={cn(
                    "text-xs mt-1 transition-colors",
                    index <= currentStepIndex ? "text-navy-700" : "text-navy-400"
                  )}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: ZIP Code Check */}
        {step === "zip" && (
          <motion.div
            key="zip"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-navy-900 mb-2">
                Let&apos;s Check Your Service Area
              </h3>
              <p className="text-navy-700/70">
                Enter your ZIP code to see if we service your area.
              </p>
            </div>
            <ZipCodeChecker onResult={handleZipResult} />
          </motion.div>
        )}

        {/* Out of Service Area */}
        {step === "out-of-area" && (
          <motion.div
            key="out-of-area"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <OutOfAreaForm zipCode={zipCode} />
            <button
              onClick={() => setStep("zip")}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Try a different ZIP code
            </button>
          </motion.div>
        )}

        {/* Step 2: Service Details */}
        {step === "service" && (
          <motion.div
            key="service"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={serviceForm.handleSubmit(handleServiceSubmit)} className="space-y-6">
              <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-lg mb-6">
                <MapPin className="w-5 h-5 text-teal-600" />
                <span className="text-teal-700">
                  Serving ZIP code: <strong>{zipCode}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStep("zip")}
                  className="ml-auto text-teal-600 text-sm hover:underline"
                >
                  Change
                </button>
              </div>

              <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
                <User className="w-5 h-5 text-teal-500" />
                Get Your Quote
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="First Name" error={serviceForm.formState.errors.firstName?.message}>
                  <input
                    type="text"
                    {...serviceForm.register("firstName")}
                    className={cn("form-input", serviceForm.formState.errors.firstName && "border-red-500")}
                    placeholder="Your first name"
                  />
                </FormField>

                <FormField label="Cell Phone" error={serviceForm.formState.errors.phone?.message}>
                  <input
                    type="tel"
                    {...serviceForm.register("phone")}
                    className={cn("form-input", serviceForm.formState.errors.phone && "border-red-500")}
                    placeholder="(555) 555-5555"
                  />
                </FormField>
              </div>

              <h4 className="text-md font-semibold text-navy-900 flex items-center gap-2 pt-2">
                <Dog className="w-5 h-5 text-teal-500" />
                Service Details
              </h4>

              {isLoadingOptions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  <span className="ml-2 text-navy-700">Loading options...</span>
                </div>
              ) : (
                <>
                  <FormField label="How many dogs do you have?" error={serviceForm.formState.errors.numberOfDogs?.message}>
                    <select
                      {...serviceForm.register("numberOfDogs")}
                      className={cn("form-input", serviceForm.formState.errors.numberOfDogs && "border-red-500")}
                    >
                      <option value="">Select...</option>
                      {formOptions.numberOfDogs.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="How often would you like service?" error={serviceForm.formState.errors.frequency?.message}>
                    <select
                      {...serviceForm.register("frequency")}
                      className={cn("form-input", serviceForm.formState.errors.frequency && "border-red-500")}
                    >
                      <option value="">Select frequency...</option>
                      {formOptions.frequency.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="When was your yard last thoroughly cleaned?" error={serviceForm.formState.errors.lastCleaned?.message}>
                    <select
                      {...serviceForm.register("lastCleaned")}
                      className={cn("form-input", serviceForm.formState.errors.lastCleaned && "border-red-500")}
                    >
                      <option value="">Select...</option>
                      {formOptions.lastCleaned.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setStep("zip")}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-navy-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 inline mr-2" />
                  Back
                </button>
                <motion.button
                  type="submit"
                  disabled={isLoadingOptions}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 btn-primary py-3 disabled:opacity-50"
                >
                  {isLoadingPricing ? (
                    <>
                      <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                      Getting Quote...
                    </>
                  ) : (
                    <>
                      Get My Quote
                      <ArrowRight className="w-5 h-5 inline ml-2" />
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 3: Quote Display */}
        {step === "quote" && serviceData && (
          <motion.div
            key="quote"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-2">
                Your Personalized Quote
              </h3>
              <p className="text-navy-700/70">
                Based on your selections, here&apos;s your service pricing.
              </p>
            </div>

            {/* Service Summary */}
            <div className="bg-gray-50 rounded-xl p-5 space-y-3">
              <h4 className="font-medium text-navy-900 flex items-center gap-2">
                <Dog className="w-5 h-5 text-teal-500" />
                Your Service Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-navy-700/60">Dogs:</span>
                  <p className="font-medium text-navy-900">{serviceData.numberOfDogs}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">Frequency:</span>
                  <p className="font-medium text-navy-900">{getFrequencyLabel(serviceData.frequency)}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">Last Cleaned:</span>
                  <p className="font-medium text-navy-900">{getLastCleanedLabel(serviceData.lastCleaned)}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">ZIP Code:</span>
                  <p className="font-medium text-navy-900">{zipCode}</p>
                </div>
              </div>
            </div>

            {/* Pricing Display */}
            {pricing ? (
              <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl p-6 border border-teal-200">
                <h4 className="font-semibold text-teal-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Your Pricing
                </h4>
                <div className="space-y-3">
                  {pricing.priceNotConfigured ? (
                    <>
                      <div className="py-2">
                        <p className="text-teal-700 font-medium">
                          We&apos;ll provide a personalized quote based on your yard size and needs.
                        </p>
                        {pricing.customPriceDescription && (
                          <p className="text-sm text-teal-600/80 mt-2">
                            {pricing.customPriceDescription}
                          </p>
                        )}
                      </div>
                      {pricing.initialCleanupFee > 0 && (
                        <div className="flex justify-between items-center py-2 border-t border-teal-200/50">
                          <div>
                            <span className="text-teal-700">Initial Cleanup Fee</span>
                            <p className="text-xs text-teal-600/70">One-time charge for first visit</p>
                          </div>
                          <span className="font-semibold text-teal-900">${pricing.initialCleanupFee}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-teal-200/50">
                        <span className="text-teal-700">Per Cleanup</span>
                        <span className="text-2xl font-bold text-teal-900">
                          ${pricing.recurringPrice}<span className="text-sm font-normal">/visit</span>
                        </span>
                      </div>
                      {pricing.monthlyPrice && pricing.monthlyPrice !== pricing.recurringPrice && (
                        <div className="flex justify-between items-center py-2 border-b border-teal-200/50">
                          <span className="text-teal-700">Monthly Total</span>
                          <span className="font-semibold text-teal-900">${pricing.monthlyPrice}/month</span>
                        </div>
                      )}
                      {pricing.initialCleanupFee > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-teal-200/50">
                          <div>
                            <span className="text-teal-700">Initial Cleanup Fee</span>
                            <p className="text-xs text-teal-600/70">One-time charge for first visit</p>
                          </div>
                          <span className="font-semibold text-teal-900">${pricing.initialCleanupFee}</span>
                        </div>
                      )}
                      <div className="pt-2">
                        <p className="text-sm text-teal-700/80">
                          Your {getFrequencyLabel(serviceData.frequency).toLowerCase()} service for {serviceData.numberOfDogs} dog{parseInt(serviceData.numberOfDogs) > 1 ? "s" : ""}.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : isLoadingPricing ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                <span className="ml-2 text-navy-700">Calculating your quote...</span>
              </div>
            ) : null}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep("service")}
                className="px-6 py-3 border border-gray-300 rounded-xl text-navy-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 inline mr-2" />
                Back
              </button>
              <motion.button
                onClick={() => setStep("contact")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 btn-primary py-3"
              >
                Sign Up Now
                <ArrowRight className="w-5 h-5 inline ml-2" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Contact Information (with Gate Info) */}
        {step === "contact" && (
          <motion.div
            key="contact"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={contactForm.handleSubmit(handleContactSubmit)} className="space-y-6">
              <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-teal-500" />
                Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="First Name" error={contactForm.formState.errors.firstName?.message}>
                  <input
                    type="text"
                    {...contactForm.register("firstName")}
                    className={cn("form-input", contactForm.formState.errors.firstName && "border-red-500")}
                    placeholder="John"
                  />
                </FormField>

                <FormField label="Last Name" error={contactForm.formState.errors.lastName?.message}>
                  <input
                    type="text"
                    {...contactForm.register("lastName")}
                    className={cn("form-input", contactForm.formState.errors.lastName && "border-red-500")}
                    placeholder="Doe"
                  />
                </FormField>

                <FormField label="Email" error={contactForm.formState.errors.email?.message}>
                  <input
                    type="email"
                    {...contactForm.register("email")}
                    className={cn("form-input", contactForm.formState.errors.email && "border-red-500")}
                    placeholder="john@example.com"
                  />
                </FormField>

                <FormField label="Phone" error={contactForm.formState.errors.phone?.message}>
                  <input
                    type="tel"
                    {...contactForm.register("phone")}
                    className={cn("form-input", contactForm.formState.errors.phone && "border-red-500")}
                    placeholder="(909) 555-1234"
                  />
                </FormField>
              </div>

              <FormField label="Street Address" error={contactForm.formState.errors.address?.message}>
                <input
                  type="text"
                  {...contactForm.register("address")}
                  className={cn("form-input", contactForm.formState.errors.address && "border-red-500")}
                  placeholder="123 Main Street"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="City" error={contactForm.formState.errors.city?.message}>
                  <input
                    type="text"
                    {...contactForm.register("city")}
                    className={cn("form-input", contactForm.formState.errors.city && "border-red-500")}
                    placeholder="Rancho Cucamonga"
                  />
                </FormField>

                <FormField label="ZIP Code">
                  <input
                    type="text"
                    value={zipCode}
                    disabled
                    className="form-input bg-gray-50"
                  />
                </FormField>
              </div>

              {/* Gate Information */}
              <div className="border-t pt-6 mt-6">
                <h4 className="text-md font-semibold text-navy-900 mb-4">Gate Access Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Where is your gate located?" error={contactForm.formState.errors.gateLocation?.message}>
                    <select
                      {...contactForm.register("gateLocation")}
                      className={cn("form-input", contactForm.formState.errors.gateLocation && "border-red-500")}
                    >
                      <option value="">Select...</option>
                      {formOptions.gateLocation.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Gate Code (if applicable)">
                    <input
                      type="text"
                      {...contactForm.register("gateCode")}
                      className="form-input"
                      placeholder="e.g., #1234 or leave blank"
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setStep("quote")}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-navy-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 inline mr-2" />
                  Back
                </button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 btn-primary py-3"
                >
                  Continue to Dog Info
                  <ArrowRight className="w-5 h-5 inline ml-2" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 5: Dogs Information */}
        {step === "dogs" && (
          <motion.div
            key="dogs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={dogForm.handleSubmit(handleDogSubmit)} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-teal-500" />
                  Tell Us About Your Dogs
                </h3>
                <span className="text-sm text-teal-600 font-medium">
                  Dog {currentDogIndex + 1} of {serviceData?.numberOfDogs || 1}
                </span>
              </div>

              <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                <p className="text-sm text-teal-700">
                  Please provide information about each of your dogs so we can serve you better.
                </p>
              </div>

              <FormField label={`Dog ${currentDogIndex + 1} Name`} error={dogForm.formState.errors.name?.message}>
                <input
                  type="text"
                  {...dogForm.register("name")}
                  className={cn("form-input", dogForm.formState.errors.name && "border-red-500")}
                  placeholder="e.g., Max, Bella"
                />
              </FormField>

              <FormField label="Breed (optional)">
                <input
                  type="text"
                  {...dogForm.register("breed")}
                  className="form-input"
                  placeholder="e.g., Golden Retriever, Mixed"
                />
              </FormField>

              <FormField label="Is this dog safe to be around?" error={dogForm.formState.errors.isSafe?.message}>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      {...dogForm.register("isSafe")}
                      value="yes"
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-navy-700">Yes, friendly</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      {...dogForm.register("isSafe")}
                      value="no"
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-navy-700">No, please be cautious</span>
                  </label>
                </div>
              </FormField>

              <FormField label="Additional Comments (optional)">
                <textarea
                  {...dogForm.register("comments")}
                  className="form-input min-h-[80px]"
                  placeholder="Any special notes about this dog..."
                />
              </FormField>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={handlePreviousDog}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-navy-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 inline mr-2" />
                  {currentDogIndex === 0 ? "Back" : "Previous Dog"}
                </button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 btn-primary py-3"
                >
                  {currentDogIndex < parseInt(serviceData?.numberOfDogs || "1") - 1 ? (
                    <>
                      Next Dog
                      <ArrowRight className="w-5 h-5 inline ml-2" />
                    </>
                  ) : (
                    <>
                      Continue to Notifications
                      <ArrowRight className="w-5 h-5 inline ml-2" />
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 6: Notifications */}
        {step === "notifications" && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={notificationsForm.handleSubmit(handleNotificationsSubmit)} className="space-y-6">
              <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-500" />
                Notification Preferences
              </h3>

              <p className="text-navy-700/70">
                Choose how you&apos;d like to be notified about your service.
              </p>

              <FormField label="What would you like to be notified about?" error={notificationsForm.formState.errors.notificationTypes?.message}>
                <div className="space-y-3">
                  {formOptions.notificationTypes.map((opt) => (
                    <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        value={opt.value}
                        {...notificationsForm.register("notificationTypes")}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <span className="text-navy-900 font-medium">{opt.label}</span>
                        {opt.value === "off_schedule" && (
                          <p className="text-xs text-navy-700/60">Get notified if service is delayed or rescheduled</p>
                        )}
                        {opt.value === "on_the_way" && (
                          <p className="text-xs text-navy-700/60">Know when our team is heading to your home</p>
                        )}
                        {opt.value === "completed" && (
                          <p className="text-xs text-navy-700/60">Confirmation when your cleanup is done</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField label="How would you like to receive notifications?" error={notificationsForm.formState.errors.notificationChannel?.message}>
                <div className="space-y-3">
                  {formOptions.notificationChannels.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value={opt.value}
                        {...notificationsForm.register("notificationChannel")}
                        className="h-4 w-4 border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-navy-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </FormField>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDogIndex(parseInt(serviceData?.numberOfDogs || "1") - 1);
                    setStep("dogs");
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-navy-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 inline mr-2" />
                  Back
                </button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 btn-primary py-3"
                >
                  Continue to Payment
                  <ArrowRight className="w-5 h-5 inline ml-2" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 7: Payment Information */}
        {step === "payment" && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2 text-navy-700 mb-4">
              <Lock className="w-4 h-4 text-teal-500" />
              <span className="text-sm">Your payment information is secure and encrypted</span>
            </div>

            <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-500" />
              Payment Information
            </h3>

            {pricing && !pricing.priceNotConfigured && (
              <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                <div className="flex justify-between items-center">
                  <span className="text-teal-700">Per cleanup:</span>
                  <span className="font-semibold text-teal-900">${pricing.recurringPrice}/visit</span>
                </div>
                {pricing.monthlyPrice && pricing.monthlyPrice !== pricing.recurringPrice && (
                  <div className="flex justify-between items-center mt-1 text-sm">
                    <span className="text-teal-600">Monthly total:</span>
                    <span className="text-teal-800">${pricing.monthlyPrice}/month</span>
                  </div>
                )}
                {pricing.initialCleanupFee > 0 && (
                  <div className="flex justify-between items-center mt-1 text-sm">
                    <span className="text-teal-600">Initial cleanup fee:</span>
                    <span className="text-teal-800">${pricing.initialCleanupFee}</span>
                  </div>
                )}
              </div>
            )}

            <FormField label="Name on Card">
              <input
                type="text"
                value={nameOnCard}
                onChange={(e) => setNameOnCard(e.target.value)}
                placeholder="John Doe"
                className="form-input"
                disabled={isProcessingPayment}
              />
            </FormField>

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

            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="terms" className="text-sm text-navy-700">
                I agree to the{" "}
                <a href="/terms" target="_blank" className="text-teal-600 hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" className="text-teal-600 hover:underline">
                  Privacy Policy
                </a>
                . I authorize Doo Good Scoopers to charge my card for the services described above.
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep("notifications")}
                disabled={isProcessingPayment}
                className="px-6 py-3 border border-gray-300 rounded-xl text-navy-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-5 h-5 inline mr-2" />
                Back
              </button>
              <motion.button
                onClick={handlePaymentSubmit}
                disabled={!isCardComplete || !stripe || isProcessingPayment}
                whileHover={{ scale: (!isCardComplete || isProcessingPayment) ? 1 : 1.02 }}
                whileTap={{ scale: (!isCardComplete || isProcessingPayment) ? 1 : 0.98 }}
                className="flex-1 btn-primary py-3 disabled:opacity-70"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue to Review
                    <ArrowRight className="w-5 h-5 inline ml-2" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Step 8: Review */}
        {step === "review" && serviceData && contactData && paymentInfo && notificationsData && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-semibold text-navy-900">Review Your Service Request</h3>

            {/* Service Summary */}
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <h4 className="font-medium text-navy-900 flex items-center gap-2">
                <Dog className="w-5 h-5 text-teal-500" />
                Service Details
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-navy-700/60">Number of Dogs:</span>
                  <p className="font-medium text-navy-900">{serviceData.numberOfDogs}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">Frequency:</span>
                  <p className="font-medium text-navy-900">{getFrequencyLabel(serviceData.frequency)}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">Last Cleaned:</span>
                  <p className="font-medium text-navy-900">{getLastCleanedLabel(serviceData.lastCleaned)}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">ZIP Code:</span>
                  <p className="font-medium text-navy-900">{zipCode}</p>
                </div>
              </div>
            </div>

            {/* Contact Summary */}
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <h4 className="font-medium text-navy-900 flex items-center gap-2">
                <User className="w-5 h-5 text-teal-500" />
                Contact Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-navy-700/60">Name:</span>
                  <p className="font-medium text-navy-900">
                    {contactData.firstName} {contactData.lastName}
                  </p>
                </div>
                <div>
                  <span className="text-navy-700/60">Email:</span>
                  <p className="font-medium text-navy-900">{contactData.email}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">Phone:</span>
                  <p className="font-medium text-navy-900">{contactData.phone}</p>
                </div>
                <div>
                  <span className="text-navy-700/60">Address:</span>
                  <p className="font-medium text-navy-900">
                    {contactData.address}, {contactData.city}, CA {zipCode}
                  </p>
                </div>
                <div>
                  <span className="text-navy-700/60">Gate Location:</span>
                  <p className="font-medium text-navy-900">{getGateLocationLabel(contactData.gateLocation)}</p>
                </div>
                {contactData.gateCode && (
                  <div>
                    <span className="text-navy-700/60">Gate Code:</span>
                    <p className="font-medium text-navy-900">{contactData.gateCode}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dogs Summary */}
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <h4 className="font-medium text-navy-900 flex items-center gap-2">
                <PawPrint className="w-5 h-5 text-teal-500" />
                Your Dogs
              </h4>
              <div className="space-y-3">
                {dogsData.map((dog, index) => (
                  <div key={index} className="text-sm border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-navy-900">{dog.name}</p>
                    <div className="flex gap-4 text-navy-700/60">
                      {dog.breed && <span>Breed: {dog.breed}</span>}
                      <span>Safe: {dog.isSafe === "yes" ? "Yes" : "No"}</span>
                    </div>
                    {dog.comments && <p className="text-navy-700/60 text-xs mt-1">{dog.comments}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Notifications Summary */}
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <h4 className="font-medium text-navy-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-500" />
                Notification Preferences
              </h4>
              <div className="text-sm">
                <div>
                  <span className="text-navy-700/60">Notify me about:</span>
                  <p className="font-medium text-navy-900">
                    {notificationsData.notificationTypes.map(t =>
                      formOptions.notificationTypes.find(opt => opt.value === t)?.label || t
                    ).join(", ")}
                  </p>
                </div>
                <div className="mt-2">
                  <span className="text-navy-700/60">Via:</span>
                  <p className="font-medium text-navy-900">
                    {formOptions.notificationChannels.find(opt => opt.value === notificationsData.notificationChannel)?.label || notificationsData.notificationChannel}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <h4 className="font-medium text-navy-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-500" />
                Payment Method
              </h4>
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-500" />
                  <span className="text-navy-700">Card ending in ****</span>
                  <span className="text-navy-700/60">(Name: {paymentInfo.nameOnCard})</span>
                </div>
              </div>
            </div>

            {/* Pricing Summary */}
            {pricing && (
              <div className="bg-teal-50 rounded-xl p-6 border border-teal-200">
                <h4 className="font-medium text-teal-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Pricing Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-teal-700">Per Cleanup:</span>
                    <span className="font-semibold text-teal-900">${pricing.recurringPrice}/visit</span>
                  </div>
                  {pricing.monthlyPrice && pricing.monthlyPrice !== pricing.recurringPrice && (
                    <div className="flex justify-between">
                      <span className="text-teal-700">Monthly Total:</span>
                      <span className="font-semibold text-teal-900">${pricing.monthlyPrice}/month</span>
                    </div>
                  )}
                  {pricing.initialCleanupFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-teal-700">Initial Cleanup Fee:</span>
                      <span className="font-semibold text-teal-900">${pricing.initialCleanupFee}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep("payment")}
                className="px-6 py-3 border border-gray-300 rounded-xl text-navy-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 inline mr-2" />
                Back
              </button>
              <motion.button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                className="flex-1 btn-primary py-3 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 inline mr-2" />
                    Complete Service Request
                  </>
                )}
              </motion.button>
            </div>

            <p className="text-center text-sm text-navy-700/60">
              Your card will be charged after your first service is completed.
            </p>
          </motion.div>
        )}

        {/* Success State */}
        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-100 text-teal-600 mb-6"
            >
              <CheckCircle className="w-10 h-10" />
            </motion.div>
            <h3 className="text-2xl font-bold text-navy-900 mb-2">Welcome to Doo Good Scoopers!</h3>
            <p className="text-navy-700/70 max-w-md mx-auto mb-4">
              Your service request has been submitted successfully. We&apos;ll be in touch shortly to schedule your first cleanup!
            </p>
            <p className="text-sm text-navy-700/60">
              Check your email for confirmation and next steps.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function FormField({ label, error, children, className }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-navy-900 mb-1.5">{label}</label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-1 text-sm text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main exported component wrapped with Stripe Elements provider
export function QuoteForm() {
  return (
    <Elements stripe={stripePromise}>
      <QuoteFormInner />
    </Elements>
  );
}
