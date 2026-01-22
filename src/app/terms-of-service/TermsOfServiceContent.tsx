"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { FileText, CreditCard, Calendar, Clock, Sparkles, Shield, ArrowRight, Phone } from "lucide-react";
import Link from "next/link";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const termsData = [
  {
    icon: CreditCard,
    title: "Payment Methods",
    content: [
      "DooGoodScoopers processes payments through a secure client portal.",
      "Customers link their credit/debit card to our secure platform, and invoices are generated and paid automatically.",
      "Your card will need to be linked to your account by the time we arrive at your home for service.",
    ],
  },
  {
    icon: Calendar,
    title: "Billing Cycle",
    content: [
      "Monthly billing occurs on the 1st of each month before service delivery.",
      "For initial or one-time cleanups, payment is due upon job completion.",
      "When starting recurring services, customers are billed for both the initial cleanup and the remainder of that month.",
      "Example: A customer starting weekly service on 1/14/2025 at $80/month would be charged $140 on that date (initial cleanup plus two remaining weeks), then $80 monthly thereafter.",
      "Unpaid accounts are removed from the service schedule until payment processes.",
      "Monthly service charges are non-refundable.",
    ],
  },
  {
    icon: Clock,
    title: "Service Scheduling",
    content: [
      "We cannot guarantee specific arrival times due to route optimization.",
      "Routes operate approximately 7am to dark.",
      "Customers receive approximately 60 minutes notice via text before arrival.",
      "Service days remain consistent weekly unless advance notice of changes is provided.",
    ],
  },
  {
    icon: Calendar,
    title: "Holiday Services",
    content: [
      "When service dates fall on major holidays, we may skip that week and perform double cleanup the following week.",
      "Customers remain charged for both weeks' accumulated waste during holiday periods.",
    ],
  },
  {
    icon: Sparkles,
    title: "Equipment Sanitation",
    content: [
      "We disinfect all equipment after each cleanup using organic, kennel-grade disinfectant.",
      "This prevents germ transmission between properties and ensures a safe, hygienic service.",
    ],
  },
  {
    icon: Shield,
    title: "Data Usage",
    content: [
      "DooGoodScoopers retains collected data for business operations and performance analysis.",
      "By accepting these terms, customers authorize the use of their information for advertising and marketing purposes.",
    ],
  },
];

export function TermsOfServiceContent() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });
  const contentRef = useRef<HTMLDivElement>(null);
  const contentInView = useInView(contentRef, { once: true, margin: "-100px" });
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  return (
    <SmoothScrollProvider>
      <Header />
      <main className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section
          ref={heroRef}
          className="relative pt-32 pb-20 bg-gradient-to-br from-navy-800 to-navy-900 overflow-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <FileText className="w-4 h-4" />
                Legal Information
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                Terms of Service
              </h1>
              <p className="text-xl text-white/80 max-w-2xl mx-auto">
                Please review our service terms and policies before using
                DooGoodScoopers pet waste removal services.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Terms Content */}
        <section ref={contentRef} className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={contentInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="prose prose-lg max-w-none"
            >
              <p className="text-gray-600 text-lg leading-relaxed mb-12">
                By using DooGoodScoopers services, you agree to the following
                terms and conditions. These policies ensure a smooth and
                professional experience for all our customers.
              </p>

              <div className="space-y-12">
                {termsData.map((section, index) => {
                  const Icon = section.icon;
                  return (
                    <motion.div
                      key={section.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={contentInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="bg-gray-50 rounded-2xl p-8"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white">
                          <Icon className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-navy-900 m-0">
                          {section.title}
                        </h2>
                      </div>
                      <ul className="space-y-3 m-0 p-0 list-none">
                        {section.content.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-3 text-gray-600"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  );
                })}
              </div>

              {/* Last Updated */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={contentInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="mt-12 pt-8 border-t border-gray-200"
              >
                <p className="text-gray-500 text-sm">
                  Last updated: January 2025
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  If you have any questions about these terms, please{" "}
                  <Link
                    href="/quote"
                    className="text-teal-600 hover:text-teal-700 underline"
                  >
                    contact us
                  </Link>{" "}
                  or call us at{" "}
                  <a
                    href="tel:(909) 366-3744"
                    className="text-teal-600 hover:text-teal-700 underline"
                  >
                    (909) 366-3744
                  </a>
                  .
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          ref={ctaRef}
          className="relative py-24 overflow-hidden bg-gradient-to-br from-navy-800 to-navy-900"
        >
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={ctaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                Get a free quote and see how easy it is to have a clean,
                waste-free yard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/quote"
                  className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-8 py-4 rounded-xl font-semibold transition-colors"
                >
                  Get a Free Quote
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="tel:(909) 366-3744"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-semibold transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  (909) 366-3744
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
