"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Mail, Phone, User, Loader2, CheckCircle, Bell } from "lucide-react";

const outOfAreaSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
});

type OutOfAreaFormData = z.infer<typeof outOfAreaSchema>;

interface OutOfAreaFormProps {
  zipCode: string;
  onSuccess?: () => void;
}

export function OutOfAreaForm({ zipCode, onSuccess }: OutOfAreaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OutOfAreaFormData>({
    resolver: zodResolver(outOfAreaSchema),
  });

  const onSubmit = async (data: OutOfAreaFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/submit-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          zipCode,
          inServiceArea: false,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsSuccess(true);
        onSuccess?.();
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      setError("Unable to submit. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 shadow-card text-center"
      >
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-teal-500" />
        </div>
        <h3 className="text-xl font-bold text-navy-900 mb-2">
          You&apos;re on the List!
        </h3>
        <p className="text-navy-700/70">
          We&apos;ve added you to our waiting list for ZIP code <strong>{zipCode}</strong>.
          We&apos;ll notify you as soon as we expand to your area!
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 md:p-8 shadow-card"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Bell className="w-6 h-6 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-navy-900">
          We&apos;re Not in Your Area Yet
        </h3>
        <p className="text-navy-700/70 text-sm mt-1">
          But we&apos;re growing! Leave your info and we&apos;ll notify you when we expand to{" "}
          <span className="font-medium">{zipCode}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">
              First Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <input
                {...register("firstName")}
                placeholder="First name"
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all text-sm"
              />
            </div>
            {errors.firstName && (
              <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">
              Last Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <input
                {...register("lastName")}
                placeholder="Last name"
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all text-sm"
              />
            </div>
            {errors.lastName && (
              <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input
              {...register("email")}
              type="email"
              placeholder="your@email.com"
              className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all text-sm"
            />
          </div>
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">
            Phone
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <input
              {...register("phone")}
              type="tel"
              placeholder="(909) 555-1234"
              className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all text-sm"
            />
          </div>
          {errors.phone && (
            <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
          )}
        </div>

        {/* ZIP Code Display */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <MapPin className="w-4 h-4 text-navy-400" />
          <span className="text-sm text-navy-700">ZIP Code: <strong>{zipCode}</strong></span>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-red-500 text-sm text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-gradient-to-r from-teal-400 to-teal-500 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Bell className="w-5 h-5" />
              Notify Me When Available
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
