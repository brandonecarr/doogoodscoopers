"use client";

import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { CheckCircle, Clock, Shield, Sparkles } from "lucide-react";

const benefits = [
  {
    icon: Clock,
    title: "Quick Response",
    description: "Get your personalized quote within 24 hours",
  },
  {
    icon: Shield,
    title: "No Obligation",
    description: "Free quote with no strings attached",
  },
  {
    icon: Sparkles,
    title: "Special Offer",
    description: "25% off your first month of service",
  },
];

const included = [
  "Thorough yard inspection and cleanup",
  "Removal of all pet waste from your property",
  "Sanitization of affected areas",
  "Flexible scheduling that works for you",
  "100% satisfaction guarantee",
];

export function QuotePageContent() {
  return (
    <SmoothScrollProvider>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-teal-50 to-white pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Centered Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h1 className="text-display-sm font-bold text-navy-900">
              Get Your <span className="text-teal-600">Free Quote</span>
            </h1>
          </motion.div>

          {/* Info Section - 3 Columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
          >
            {/* Column 1 - Description */}
            <div className="bg-white rounded-2xl p-5 shadow-card flex flex-col justify-center">
              <h3 className="font-semibold text-navy-900 mb-3 text-sm">
                Why Choose Us?
              </h3>
              <p className="text-navy-700/70 leading-relaxed text-sm">
                Ready to take back control of your yard? Fill out the form and
                we&apos;ll send you a personalized quote based on your specific
                needs. No hidden fees, no surprises.
              </p>
            </div>

            {/* Column 2 - Benefits */}
            <div className="bg-white rounded-2xl p-5 shadow-card flex flex-col justify-center">
              <h3 className="font-semibold text-navy-900 mb-3 text-sm">
                What You Get:
              </h3>
              <div className="space-y-3">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={benefit.title}
                      className="flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-navy-900 text-sm">
                          {benefit.title}
                        </h4>
                        <p className="text-navy-700/70 text-xs">{benefit.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 3 - What's Included */}
            <div className="bg-white rounded-2xl p-5 shadow-card flex flex-col justify-center">
              <h3 className="font-semibold text-navy-900 mb-3 text-sm">
                What&apos;s Included:
              </h3>
              <ul className="space-y-2">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-navy-700/80 text-xs">
                    <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Quote Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-3xl p-8 shadow-card-hover max-w-4xl mx-auto"
          >
            <QuoteForm />
          </motion.div>
        </div>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
