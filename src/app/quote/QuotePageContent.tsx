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

export function QuotePageContent() {
  return (
    <SmoothScrollProvider>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-teal-50 to-white pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left Column - Info */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-display-sm font-bold text-navy-900 mb-6">
                Get Your{" "}
                <span className="text-teal-600">Free Quote</span>
              </h1>

              <p className="text-lg text-navy-700/70 mb-8 leading-relaxed">
                Ready to take back control of your yard? Fill out the form and
                we&apos;ll send you a personalized quote based on your specific
                needs. No hidden fees, no surprises.
              </p>

              {/* Benefits */}
              <div className="space-y-6 mb-12">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <motion.div
                      key={benefit.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.1 }}
                      className="flex items-start gap-4"
                    >
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-navy-900">
                          {benefit.title}
                        </h3>
                        <p className="text-navy-700/70">{benefit.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* What's Included */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-6 shadow-card"
              >
                <h3 className="font-semibold text-navy-900 mb-4">
                  What&apos;s Included in Every Service:
                </h3>
                <ul className="space-y-3">
                  {[
                    "Thorough yard inspection and cleanup",
                    "Removal of all pet waste from your property",
                    "Sanitization of affected areas",
                    "Flexible scheduling that works for you",
                    "100% satisfaction guarantee",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-navy-700/80">
                      <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>

            {/* Right Column - Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-3xl p-8 shadow-card-hover"
            >
              <QuoteForm />
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
