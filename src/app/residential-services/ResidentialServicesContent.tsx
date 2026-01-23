"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Phone,
  User,
  CreditCard,
  Sparkles,
  MessageSquare,
  Route,
  RefreshCw,
  Camera,
  Shield,
  Award,
  Heart,
  UserCheck,
  FileText,
  Laptop,
} from "lucide-react";
import Image from "next/image";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CTASection } from "@/components/sections/CTASection";

// Service Process Steps
const processSteps = [
  {
    number: 1,
    title: "Sign Up",
    description: "Complete our simple online form to get your free instant quote.",
    icon: ClipboardList,
    color: "bg-teal-500",
    image: "/images/residential/online-sign-up.webp",
  },
  {
    number: 2,
    title: "Schedule Initial Cleanup",
    description: "A representative will contact you to arrange your first service.",
    icon: Phone,
    color: "bg-navy-600",
    image: "/images/residential/schedule.webp",
  },
  {
    number: 3,
    title: "Access Customer Portal",
    description: "Receive login credentials to manage your account online.",
    icon: User,
    color: "bg-teal-600",
    image: "/images/residential/customer-portal.webp",
  },
  {
    number: 4,
    title: "Add Payment Method",
    description: "Set up automatic billing on the 1st of each month.",
    icon: CreditCard,
    color: "bg-navy-500",
    image: "/images/residential/payment-method.webp",
  },
  {
    number: 5,
    title: "Enjoy Your Clean Yard",
    description: "Relax while we keep your yard pristine with ongoing service.",
    icon: Sparkles,
    color: "bg-teal-500",
    image: "/images/residential/celebration.webp",
  },
];

// Professional Features
const features = [
  {
    icon: MessageSquare,
    title: "ETA Text Alerts",
    description: "Receive an 'on the way' text with our ETA before each visit.",
  },
  {
    icon: Route,
    title: "Specialized Routes",
    description: "Trained technicians walk optimized paths to minimize missed waste.",
  },
  {
    icon: RefreshCw,
    title: "Multiple Passes",
    description: "We make several passes through your yard for thoroughness.",
  },
  {
    icon: Camera,
    title: "Photo Verification",
    description: "Gate photos confirm service completion after each visit.",
  },
  {
    icon: Shield,
    title: "Disinfected Equipment",
    description: "All tools sanitized with kennel-grade solution between visits.",
  },
  {
    icon: Award,
    title: "Trained Technicians",
    description: "Professional staff dedicated to quality service.",
  },
];

// Core Benefits (Why Choose Us)
const benefits = [
  {
    icon: UserCheck,
    title: "Vetted Staff",
    description: "All employees pass background checks and driving screenings.",
    color: "bg-teal-500",
  },
  {
    icon: FileText,
    title: "No Contracts",
    description: "Flexible enrollment and cancellation—no long-term commitments.",
    color: "bg-navy-600",
  },
  {
    icon: Heart,
    title: "Health & Safety",
    description: "Prevent bacterial spread and parasites that can harm your family.",
    color: "bg-teal-600",
  },
  {
    icon: Laptop,
    title: "Customer Portal",
    description: "Manage your account, payments, and invoices online anytime.",
    color: "bg-navy-500",
  },
  {
    icon: Camera,
    title: "Gate Photos",
    description: "Photo verification after each service confirms job completion.",
    color: "bg-teal-500",
  },
  {
    icon: MessageSquare,
    title: "Notification Texts",
    description: "Get a heads up text with our ETA when we're on our way.",
    color: "bg-navy-600",
  },
];

export function ResidentialServicesContent() {
  const heroRef = useRef<HTMLElement>(null);
  const processRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const deodorRef = useRef<HTMLElement>(null);
  const benefitsRef = useRef<HTMLElement>(null);

  const serviceDayRef = useRef<HTMLElement>(null);

  const heroInView = useInView(heroRef, { once: true });
  const processInView = useInView(processRef, { once: true, margin: "-100px" });
  const featuresInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const serviceDayInView = useInView(serviceDayRef, { once: true, margin: "-100px" });
  const deodorInView = useInView(deodorRef, { once: true, margin: "-100px" });
  const benefitsInView = useInView(benefitsRef, { once: true, margin: "-100px" });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <SmoothScrollProvider>
      <Header variant="light" />
      <main>
        {/* Hero Section */}
        <section
          ref={heroRef}
          className="relative pt-32 pb-20 bg-gradient-to-b from-teal-50 to-white overflow-hidden"
        >
          {/* Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-64 h-64 bg-teal-200/30 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-navy-200/20 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Text Content */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8 }}
                className="text-center lg:text-left"
              >
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={heroInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.2 }}
                  className="inline-block px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-6"
                >
                  Serving the Inland Empire
                </motion.span>

                <h1 className="text-display-md font-bold text-navy-900 mb-6">
                  Residential Pet Waste Removal
                </h1>

                <p className="text-xl text-navy-700/80 mb-8 max-w-2xl">
                  When it needs to be done right. Professional, reliable service that keeps
                  your yard clean and your family healthy.
                </p>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/quote"
                    className="btn-primary text-lg inline-flex items-center gap-2"
                  >
                    Get Your Free Quote
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </motion.div>
              </motion.div>

              {/* Hero Image */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={heroInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative hidden lg:block"
              >
                <div className="relative w-full aspect-square max-w-md mx-auto">
                  <Image
                    src="/images/residential/scooper-icon.webp"
                    alt="Professional Pet Waste Removal"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Service Process Section */}
        <section ref={processRef} className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={processInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-display-sm font-bold text-navy-900 mb-4">
                How It Works
              </h2>
              <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
                Getting started is easy. Five simple steps to a cleaner, healthier yard.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={processInView ? "visible" : "hidden"}
              className="relative"
            >
              {/* Desktop Timeline */}
              <div className="hidden lg:block">
                <div className="flex justify-between items-start relative">
                  {/* Connection Line */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={processInView ? { scaleX: 1 } : {}}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="absolute top-16 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-teal-500 via-navy-600 to-teal-500 origin-left"
                  />

                  {processSteps.map((step) => (
                    <motion.div
                      key={step.number}
                      variants={itemVariants}
                      className="flex flex-col items-center text-center w-1/5 relative z-10"
                    >
                      <motion.div
                        whileHover={{ scale: 1.05, y: -5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="relative mb-6"
                      >
                        <div className="w-32 h-32 relative">
                          <Image
                            src={step.image}
                            alt={step.title}
                            fill
                            className="object-contain"
                          />
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-teal-500 shadow-md flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {step.number}
                          </span>
                        </div>
                      </motion.div>
                      <h3 className="text-lg font-bold text-navy-900 mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-navy-700/70 max-w-[180px]">
                        {step.description}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Mobile Timeline */}
              <div className="lg:hidden space-y-8">
                {processSteps.map((step, index) => (
                  <motion.div
                    key={step.number}
                    variants={itemVariants}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 relative flex-shrink-0 bg-white rounded-xl shadow-md p-2">
                        <Image
                          src={step.image}
                          alt={step.title}
                          fill
                          className="object-contain p-1"
                        />
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-teal-500 shadow-md flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {step.number}
                          </span>
                        </div>
                      </div>
                      {index < processSteps.length - 1 && (
                        <div className="w-0.5 flex-1 min-h-[40px] bg-gradient-to-b from-teal-500 to-navy-600 mt-2" />
                      )}
                    </div>
                    <div className="pt-2 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-teal-600">
                          Step {step.number}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-navy-900 mb-1">
                        {step.title}
                      </h3>
                      <p className="text-navy-700/70">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Professional Features Section */}
        <section ref={featuresRef} className="py-24 bg-gray-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={featuresInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-display-sm font-bold text-navy-900 mb-4">
                Professional Service Features
              </h2>
              <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
                Every visit is thorough, professional, and designed with your convenience in mind.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={featuresInView ? "visible" : "hidden"}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    whileHover={{ y: -8, transition: { duration: 0.3 } }}
                    className="bg-white rounded-2xl p-6 shadow-card hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-navy-900 mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-navy-700/70">{feature.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* What to Expect on Service Day */}
        <section ref={serviceDayRef} className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Image */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={serviceDayInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/images/residential/scooper-professional.webp"
                    alt="Professional pet waste removal technician"
                    fill
                    className="object-cover"
                  />
                </div>
                {/* Decorative element */}
                <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-teal-100 rounded-2xl -z-10" />
              </motion.div>

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={serviceDayInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h2 className="text-display-sm font-bold text-navy-900 mb-6">
                  What to Expect on Service Day
                </h2>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-900 mb-1">ETA Text Notification</h3>
                      <p className="text-navy-700/70">Get a heads up text with our ETA when we&apos;re on our way to your home.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Route className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-900 mb-1">Thorough Cleanup</h3>
                      <p className="text-navy-700/70">Our trained technicians walk specialized routes to ensure no spot is missed.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-900 mb-1">Photo Confirmation</h3>
                      <p className="text-navy-700/70">We take a photo of your gate after service to confirm completion.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-900 mb-1">Sanitized Equipment</h3>
                      <p className="text-navy-700/70">All tools are disinfected with kennel-grade solution between each yard.</p>
                    </div>
                  </div>
                </div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-8"
                >
                  <Link
                    href="/quote"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    Get Started Today
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Deodorization Service Highlight */}
        <section ref={deodorRef} className="py-24 bg-gray-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={deodorInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="relative bg-gradient-to-br from-teal-500 to-teal-700 rounded-3xl p-8 md:p-12 overflow-hidden"
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,white_1px,transparent_1px)] bg-[length:30px_30px]" />
              </div>

              <div className="relative flex flex-col md:flex-row items-center gap-8">
                {/* Pump Sprayer Image */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={deodorInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex-shrink-0"
                >
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="relative w-40 h-48 md:w-48 md:h-56"
                  >
                    <Image
                      src="/images/residential/pump-sprayer.webp"
                      alt="Yard Odor Destroyer Sprayer"
                      fill
                      className="object-contain drop-shadow-2xl"
                    />
                  </motion.div>
                </motion.div>

                <div className="text-center md:text-left flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium mb-4">
                    <Sparkles className="w-4 h-4" />
                    NEW SERVICE
                  </div>

                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                    Yard Odor Destroyer
                  </h2>

                  <p className="text-white/90 text-lg max-w-xl mb-6">
                    Our commercial-grade deodorization formula is applied after every cleanup
                    to neutralize lingering odors from urine and feces, leaving your yard
                    smelling fresh and clean.
                  </p>

                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      href="/quote"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-teal-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Learn More
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Benefits Section */}
        <section ref={benefitsRef} className="py-24 bg-gray-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-display-sm font-bold text-navy-900 mb-4">
                Why Choose Us
              </h2>
              <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
                More than just a cleanup service—we provide peace of mind for your family.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={benefitsInView ? "visible" : "hidden"}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    whileHover={{ y: -8, transition: { duration: 0.3 } }}
                    className="bg-white rounded-2xl p-8 shadow-card hover:shadow-xl transition-shadow"
                  >
                    <div className="flex flex-col items-center text-center">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="mb-6"
                      >
                        <div
                          className={`w-16 h-16 rounded-full ${benefit.color} flex items-center justify-center shadow-lg`}
                        >
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                      </motion.div>

                      <h3 className="text-xl font-bold text-navy-900 mb-4">
                        {benefit.title}
                      </h3>

                      <p className="text-navy-700/70 leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <CTASection />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
