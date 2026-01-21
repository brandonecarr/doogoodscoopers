"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";

const US_STATES = [
  { value: "", label: "Select" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const commercialContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  propertyName: z.string().min(1, "Property name is required"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Please enter a valid zip code"),
  notes: z.string().optional(),
  privacyPolicy: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy policy",
  }),
});

type CommercialContactFormData = z.infer<typeof commercialContactSchema>;

interface CommercialContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommercialContactModal({
  isOpen,
  onClose,
}: CommercialContactModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CommercialContactFormData>({
    resolver: zodResolver(commercialContactSchema),
    defaultValues: {
      name: "",
      propertyName: "",
      phone: "",
      email: "",
      city: "",
      state: "",
      zipCode: "",
      notes: "",
      privacyPolicy: false,
    },
  });

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, "");
    if (phoneNumber.length < 4) return phoneNumber;
    if (phoneNumber.length < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const onSubmit = async (data: CommercialContactFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Submit to backend/API
      console.log("Commercial contact form submitted:", data);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSubmitSuccess(true);
      reset();

      // Close modal after showing success
      setTimeout(() => {
        setSubmitSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setSubmitSuccess(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-xl font-bold text-navy-900">
                  Commercial Services Inquiry
                </h2>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="p-2 text-navy-500 hover:text-navy-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                {submitSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-100 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-teal-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-navy-900 mb-2">
                      Thank You!
                    </h3>
                    <p className="text-navy-700/70">
                      We&apos;ll be in touch shortly to discuss your commercial
                      property needs.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Your Name */}
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-1.5">
                        Your Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register("name")}
                        className={cn(
                          "w-full px-4 py-3 border rounded-lg transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                          errors.name
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white"
                        )}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-500">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    {/* Property Name */}
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-1.5">
                        Property Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register("propertyName")}
                        className={cn(
                          "w-full px-4 py-3 border rounded-lg transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                          errors.propertyName
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white"
                        )}
                      />
                      {errors.propertyName && (
                        <p className="mt-1 text-sm text-red-500">
                          {errors.propertyName.message}
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-1.5">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        {...register("phone", {
                          onChange: (e) => {
                            e.target.value = formatPhoneNumber(e.target.value);
                          },
                        })}
                        placeholder="(___) ___-____"
                        className={cn(
                          "w-full px-4 py-3 border rounded-lg transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                          errors.phone
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white"
                        )}
                      />
                      {errors.phone && (
                        <p className="mt-1 text-sm text-red-500">
                          {errors.phone.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        {...register("email")}
                        className={cn(
                          "w-full px-4 py-3 border rounded-lg transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                          errors.email
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white"
                        )}
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-500">
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* City */}
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-1.5">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register("city")}
                        className={cn(
                          "w-full px-4 py-3 border rounded-lg transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                          errors.city
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white"
                        )}
                      />
                      {errors.city && (
                        <p className="mt-1 text-sm text-red-500">
                          {errors.city.message}
                        </p>
                      )}
                    </div>

                    {/* State & Zip Code Row */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* State */}
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          State <span className="text-red-500">*</span>
                        </label>
                        <select
                          {...register("state")}
                          className={cn(
                            "w-full px-4 py-3 border rounded-lg transition-colors appearance-none bg-white",
                            "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                            errors.state
                              ? "border-red-300 bg-red-50"
                              : "border-gray-200"
                          )}
                        >
                          {US_STATES.map((state) => (
                            <option key={state.value} value={state.value}>
                              {state.label}
                            </option>
                          ))}
                        </select>
                        {errors.state && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.state.message}
                          </p>
                        )}
                      </div>

                      {/* Zip Code */}
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Zip Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          {...register("zipCode")}
                          maxLength={10}
                          className={cn(
                            "w-full px-4 py-3 border rounded-lg transition-colors",
                            "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                            errors.zipCode
                              ? "border-red-300 bg-red-50"
                              : "border-gray-200 bg-white"
                          )}
                        />
                        {errors.zipCode && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.zipCode.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes/Questions */}
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-1.5">
                        Notes/Questions
                      </label>
                      <textarea
                        {...register("notes")}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg transition-colors resize-y focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="Tell us about your property and any specific needs..."
                      />
                    </div>

                    {/* Privacy Policy Checkbox */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="privacyPolicy"
                        {...register("privacyPolicy")}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <label
                        htmlFor="privacyPolicy"
                        className="text-sm text-navy-700"
                      >
                        By checking this box I agree to our{" "}
                        <a
                          href="/privacy-policy"
                          target="_blank"
                          className="text-teal-600 hover:text-teal-700 underline"
                        >
                          Privacy Policy
                        </a>
                        .
                      </label>
                    </div>
                    {errors.privacyPolicy && (
                      <p className="text-sm text-red-500 -mt-3">
                        {errors.privacyPolicy.message}
                      </p>
                    )}

                    {/* Submit Button */}
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                      whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                      className={cn(
                        "w-full py-3.5 px-6 rounded-full font-semibold text-white transition-all",
                        "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
                        "shadow-lg hover:shadow-xl",
                        "disabled:opacity-70 disabled:cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        "Submit"
                      )}
                    </motion.button>
                  </>
                )}
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
