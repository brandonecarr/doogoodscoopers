"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Shield, User, Database, Share2, Lock, Mail, ArrowRight, Phone } from "lucide-react";
import Link from "next/link";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const policyData = [
  {
    icon: User,
    title: "Personal Information Collected",
    content: [
      "First and Last Name",
      "Mailing & Physical Address",
      "E-mail Address",
      "Phone Number",
      "Details about your home and pets",
      "Images including but not limited to before and after photos may be used for advertisements and social media purposes",
    ],
  },
  {
    icon: Database,
    title: "How We Use Your Information",
    content: [
      "To operate and deliver the services you have requested",
      "To contact you about your service and account",
      "To inform you about other offerings from DooGoodScoopers and our affiliates",
      "To improve our services and customer experience",
    ],
  },
  {
    icon: Share2,
    title: "Third-Party Sharing",
    content: [
      "DooGoodScoopers does not sell, rent, or lease its customer lists to third parties.",
      "We may share data with trusted partners to help perform specific services on our behalf.",
      "We utilize 3rd party advertising platforms such as Google Ads, Facebook Ads, and other social media sites.",
      "Third-party service providers are required to keep your information confidential.",
    ],
  },
  {
    icon: Mail,
    title: "Your Opt-Out Rights",
    content: [
      "You can opt out of marketing communications by emailing service@doogoodscoopers.com",
      "Reply \"STOP\" to any SMS message to unsubscribe from text notifications",
      "Under the California Consumer Privacy Act (CCPA), California residents may request deletion of their personal information",
      "Certain information may be retained for legal and business purposes as permitted by law",
    ],
  },
  {
    icon: Lock,
    title: "Security Measures",
    content: [
      "We employ SSL Protocol encryption to protect sensitive information during transmission",
      "Your personal data is stored securely on protected servers",
      "We regularly review and update our security practices",
      "Access to personal information is restricted to authorized personnel only",
    ],
  },
];

export function PrivacyPolicyContent() {
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
                <Shield className="w-4 h-4" />
                Your Privacy Matters
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                Privacy Policy
              </h1>
              <p className="text-xl text-white/80 max-w-2xl mx-auto">
                Learn how DooGoodScoopers collects, uses, and protects your
                personal information.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Policy Content */}
        <section ref={contentRef} className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={contentInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="prose prose-lg max-w-none"
            >
              <p className="text-gray-600 text-lg leading-relaxed mb-12">
                DooGoodScoopers is committed to protecting your privacy. This
                policy explains how we collect, use, and safeguard your personal
                information when you use our pet waste removal services.
              </p>

              <div className="space-y-12">
                {policyData.map((section, index) => {
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

              {/* Contact Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={contentInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="mt-12 bg-navy-50 rounded-2xl p-8"
              >
                <h2 className="text-2xl font-bold text-navy-900 mb-4">
                  Contact Information
                </h2>
                <p className="text-gray-600 mb-4">
                  If you have questions about this privacy policy or wish to
                  exercise your privacy rights, please contact us:
                </p>
                <div className="space-y-2 text-gray-600">
                  <p>
                    <strong>DooGoodScoopers, LLC</strong>
                  </p>
                  <p>11799 Sebastian Way, Suite 103</p>
                  <p>Rancho Cucamonga, CA 91730</p>
                  <p>
                    Phone:{" "}
                    <a
                      href="tel:(909) 366-3744"
                      className="text-teal-600 hover:text-teal-700"
                    >
                      (909) 366-3744
                    </a>
                  </p>
                  <p>
                    Email:{" "}
                    <a
                      href="mailto:service@doogoodscoopers.com"
                      className="text-teal-600 hover:text-teal-700"
                    >
                      service@doogoodscoopers.com
                    </a>
                  </p>
                </div>
              </motion.div>

              {/* Last Updated */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={contentInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="mt-12 pt-8 border-t border-gray-200"
              >
                <p className="text-gray-500 text-sm">
                  Effective Date: December 1, 2024
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  This privacy policy may be updated periodically. We encourage
                  you to review this page for the latest information on our
                  privacy practices.
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
