"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, ArrowRight, Phone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const faqs = [
  {
    question: "Does DooGoodScoopers clean the entire yard?",
    answer:
      "Yes! We clean any areas of your property that have dog waste issues, including front, back, and side yards, flower beds, dog runs, and more. We'll make sure every corner of your yard is spotless.",
  },
  {
    question: "Do you provide dog waste removal services all year round?",
    answer:
      "Absolutely! We operate year-round throughout the Inland Empire. Even in the winter, we will still show up to provide services. Rain or shine, your yard will stay clean.",
  },
  {
    question: "How much does it cost to hire a professional pooper scooper?",
    answer:
      "Our plans start as low as $20.55 per visit! Pricing varies based on yard size, service frequency, and number of dogs. Get a free quote to see exact pricing for your home.",
  },
  {
    question: "Do I have to sign a contract for pooper scooper services?",
    answer:
      "No contracts required! You can start, pause, and cancel your subscription at any time through your customer portal or by giving us a call. We believe in earning your business every visit.",
  },
  {
    question: "How do you dispose of the pet waste after each cleanup?",
    answer:
      "We either dispose of the waste with Waste Management or double-bag it and place it in your trash cans or on the side of your house—whichever you prefer. Just let us know your preference!",
  },
  {
    question: "Can you clean with my dog in the yard?",
    answer:
      "Yes, we can! Our team is comfortable working around friendly dogs. However, if your dog shows any signs of aggression, we ask that they be kept inside during our visit for the safety of our team.",
  },
  {
    question: "Can I request a specific cleanup day?",
    answer:
      "Yes, you can request a specific day! While availability varies by area, we typically offer 2-3 options to best fit your schedule. We'll work with you to find the perfect day.",
  },
  {
    question: "Do you provide arrival windows for services?",
    answer:
      "While we don't provide specific arrival times, you'll receive a text message about 60 minutes before we arrive. This way, you'll always know when we're on our way!",
  },
];

function FAQItem({
  question,
  answer,
  index,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="border-b border-gray-200 last:border-b-0"
    >
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-semibold text-navy-900 pr-8 group-hover:text-teal-600 transition-colors">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0"
        >
          <ChevronDown
            className={`w-5 h-5 transition-colors ${
              isOpen ? "text-teal-600" : "text-navy-400"
            }`}
          />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-navy-700/80 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQContent() {
  const heroRef = useRef<HTMLElement>(null);
  const faqRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  const heroInView = useInView(heroRef, { once: true });
  const faqInView = useInView(faqRef, { once: true, margin: "-100px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <SmoothScrollProvider>
      <Header variant="light" />
      <main>
        {/* Hero Section */}
        <section
          ref={heroRef}
          className="relative pt-32 pb-20 bg-gradient-to-b from-navy-50 to-white overflow-hidden"
        >
          {/* Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-10 w-64 h-64 bg-teal-200/30 rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-10 w-96 h-96 bg-navy-200/20 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8 }}
              className="text-center max-w-3xl mx-auto"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={heroInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-6"
              >
                <HelpCircle className="w-4 h-4" />
                Frequently Asked Questions
              </motion.div>

              <h1 className="text-display-md font-bold text-navy-900 mb-6">
                Got Questions?{" "}
                <span className="text-teal-600">We&apos;ve Got Answers</span>
              </h1>

              <p className="text-xl text-navy-700/80">
                Everything you need to know about our professional pet waste
                removal services. Can&apos;t find what you&apos;re looking for?
                Give us a call!
              </p>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <section ref={faqRef} className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* FAQ Accordion */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={faqInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="lg:col-span-7 bg-white rounded-2xl shadow-card p-8 md:p-10"
              >
                {faqs.map((faq, index) => (
                  <FAQItem
                    key={index}
                    question={faq.question}
                    answer={faq.answer}
                    index={index}
                    isOpen={openIndex === index}
                    onToggle={() => handleToggle(index)}
                  />
                ))}
              </motion.div>

              {/* Image & Contact Card */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={faqInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="lg:col-span-5 space-y-6 lg:sticky lg:top-32"
              >
                {/* Image */}
                <div className="relative rounded-2xl overflow-hidden shadow-xl">
                  <div className="aspect-[4/3] relative">
                    <Image
                      src="/images/residential/yard-cleanup.webp"
                      alt="Professional yard cleanup service"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-900/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <p className="text-white font-semibold text-lg">
                      Clean yards, happy families
                    </p>
                    <p className="text-white/80 text-sm">
                      Serving the Inland Empire since 2024
                    </p>
                  </div>
                </div>

                {/* Contact Card */}
                <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">
                    Can&apos;t find your answer?
                  </h3>
                  <p className="text-white/90 mb-4">
                    Our friendly team is here to help! Give us a call or send us
                    a message.
                  </p>
                  <div className="space-y-3">
                    <a
                      href="tel:(909) 366-3744"
                      className="flex items-center gap-3 bg-white/20 hover:bg-white/30 rounded-xl px-4 py-3 transition-colors"
                    >
                      <Phone className="w-5 h-5" />
                      <span className="font-medium">(909) 366-3744</span>
                    </a>
                    <Link
                      href="/quote"
                      className="flex items-center justify-center gap-2 bg-white text-teal-600 hover:bg-white/90 rounded-xl px-4 py-3 font-semibold transition-colors"
                    >
                      Get a Free Quote
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          ref={ctaRef}
          className="relative py-24 overflow-hidden bg-gradient-to-br from-navy-800 to-navy-900"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,white_1px,transparent_1px)] bg-[length:40px_40px]" />
          </div>

          {/* Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/30 rounded-full blur-3xl" />
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={ctaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-display-sm font-bold text-white mb-6"
              >
                Still Have <span className="text-teal-400">Questions</span>?
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl text-white/80 mb-10 max-w-2xl mx-auto"
              >
                We&apos;re here to help! Contact us directly or get a free quote
                to see how we can make your yard sparkle.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <Link
                  href="/quote"
                  className="btn-primary text-lg inline-flex items-center justify-center gap-2"
                >
                  Get Your Free Quote
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="tel:(909) 366-3744"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-colors"
                >
                  Call (909) 366-3744
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
