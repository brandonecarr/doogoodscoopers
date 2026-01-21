"use client";

import { useRef, useState } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Home,
  Trees,
  Trash2,
  ClipboardList,
  MapPin,
  FileText,
  Wrench,
  CheckCircle,
  Users,
  Shield,
  TrendingUp,
  DollarSign,
  Leaf,
  Phone,
} from "lucide-react";
import Image from "next/image";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CommercialContactModal } from "@/components/forms/CommercialContactModal";

// Service Types
const serviceTypes = [
  {
    icon: Home,
    title: "HOA Communities",
    description:
      "Keep shared spaces clean and residents happy with regular pet waste removal.",
  },
  {
    icon: Building2,
    title: "Apartment Complexes",
    description:
      "Maintain clean grounds to attract and retain quality tenants.",
  },
  {
    icon: Trees,
    title: "Dog Parks",
    description:
      "Professional maintenance for public and private dog parks and pet areas.",
  },
  {
    icon: Trash2,
    title: "Waste Stations",
    description:
      "Installation, maintenance, and bag resupply for pet waste stations.",
  },
];

// Process Steps
const processSteps = [
  {
    number: 1,
    title: "Schedule Consultation",
    description: "Contact us to discuss your property's needs and challenges.",
    icon: Phone,
    color: "bg-teal-500",
  },
  {
    number: 2,
    title: "Site Assessment",
    description: "We visit your property to evaluate the scope of work needed.",
    icon: MapPin,
    color: "bg-navy-600",
  },
  {
    number: 3,
    title: "Custom Plan",
    description:
      "Receive a tailored pet waste management plan and formal recommendations.",
    icon: FileText,
    color: "bg-teal-600",
  },
  {
    number: 4,
    title: "Station Setup",
    description:
      "Optional installation of dog waste stations at strategic locations.",
    icon: Wrench,
    color: "bg-navy-500",
  },
  {
    number: 5,
    title: "Ongoing Service",
    description:
      "Regular maintenance keeps your property clean year-round.",
    icon: CheckCircle,
    color: "bg-teal-500",
  },
];

// Benefits
const benefits = [
  {
    icon: TrendingUp,
    title: "Increase Property Value",
    description:
      "Clean environments attract more tenants and visitors, boosting occupancy rates.",
    color: "bg-teal-500",
  },
  {
    icon: DollarSign,
    title: "Reduce Costs",
    description:
      "Prevent landscape damage and reduce infrastructure repair expenses.",
    color: "bg-navy-600",
  },
  {
    icon: Users,
    title: "Happy Residents",
    description:
      "Keep your community satisfied with well-maintained common areas.",
    color: "bg-teal-600",
  },
  {
    icon: Shield,
    title: "Vetted Staff",
    description:
      "All team members undergo background checks for your peace of mind.",
    color: "bg-navy-500",
  },
  {
    icon: Leaf,
    title: "Healthier Environment",
    description:
      "Reduce health hazards from pet waste bacteria and parasites.",
    color: "bg-teal-500",
  },
  {
    icon: ClipboardList,
    title: "Custom Solutions",
    description:
      "Tailored plans designed specifically for your property's unique needs.",
    color: "bg-navy-600",
  },
];

// Services Included
const servicesIncluded = [
  "Regular pet waste removal from all common areas",
  "Dog waste station installation and placement",
  "Ongoing bag resupply and station maintenance",
  "Community trash pickup (items fitting in scooping buckets)",
  "Detailed service reports and documentation",
  "Flexible scheduling to fit your needs",
];

export function CommercialServicesContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const processRef = useRef<HTMLElement>(null);
  const benefitsRef = useRef<HTMLElement>(null);
  const includedRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  const heroInView = useInView(heroRef, { once: true });
  const servicesInView = useInView(servicesRef, { once: true, margin: "-100px" });
  const processInView = useInView(processRef, { once: true, margin: "-100px" });
  const benefitsInView = useInView(benefitsRef, { once: true, margin: "-100px" });
  const includedInView = useInView(includedRef, { once: true, margin: "-100px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

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
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

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
            <div className="absolute top-20 right-10 w-64 h-64 bg-navy-200/30 rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-10 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl" />
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
                  className="inline-block px-4 py-2 bg-navy-100 text-navy-700 rounded-full text-sm font-medium mb-6"
                >
                  Commercial Pet Waste Solutions
                </motion.span>

                <h1 className="text-display-md font-bold text-navy-900 mb-6">
                  Professional Service for{" "}
                  <span className="text-teal-600">Commercial Properties</span>
                </h1>

                <p className="text-xl text-navy-700/80 mb-8 max-w-2xl">
                  Dog waste stinking up your community? Get a free pet waste
                  management plan for your HOA, apartment complex, or commercial
                  property.
                </p>

                <motion.button
                  onClick={openModal}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary text-lg inline-flex items-center gap-2"
                >
                  Free Consultation
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
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
                    src="/images/commercial/commercial-hero.png"
                    alt="Commercial Pet Waste Management"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Service Types Section */}
        <section ref={servicesRef} className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={servicesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-display-sm font-bold text-navy-900 mb-4">
                Properties We Serve
              </h2>
              <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
                From small HOAs to large apartment complexes, we provide
                tailored solutions for every type of commercial property.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={servicesInView ? "visible" : "hidden"}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
            >
              {serviceTypes.map((service) => {
                const Icon = service.icon;
                return (
                  <motion.div
                    key={service.title}
                    variants={itemVariants}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="bg-gray-50 rounded-2xl p-6 text-center shadow-card hover:shadow-elevated transition-all duration-300"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-navy-900 mb-2">
                      {service.title}
                    </h3>
                    <p className="text-navy-700/70 text-sm">
                      {service.description}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Process Section */}
        <section ref={processRef} className="py-24 bg-gray-50 overflow-hidden">
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
                Getting started is simple. Our team will work with you to create
                a customized plan that fits your property&apos;s needs.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={processInView ? "visible" : "hidden"}
            >
              {/* Desktop Timeline */}
              <div className="hidden lg:block">
                <div className="flex justify-between items-start relative">
                  {/* Connection Line */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={processInView ? { scaleX: 1 } : {}}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="absolute top-10 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-teal-500 via-navy-600 to-teal-500 origin-left"
                  />

                  {processSteps.map((step) => {
                    const Icon = step.icon;
                    return (
                      <motion.div
                        key={step.number}
                        variants={itemVariants}
                        className="flex flex-col items-center text-center w-1/5 relative z-10"
                      >
                        <motion.div
                          whileHover={{ scale: 1.1, y: -5 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          className="relative mb-6"
                        >
                          <div
                            className={`w-20 h-20 rounded-full ${step.color} flex items-center justify-center shadow-lg`}
                          >
                            <Icon className="w-10 h-10 text-white" />
                          </div>
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
                            <span className="text-sm font-bold text-navy-900">
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
                    );
                  })}
                </div>
              </div>

              {/* Mobile Timeline */}
              <div className="lg:hidden space-y-6">
                {processSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.number}
                      variants={itemVariants}
                      className="flex gap-4"
                    >
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-14 h-14 rounded-full ${step.color} flex items-center justify-center shadow-lg flex-shrink-0`}
                        >
                          <Icon className="w-7 h-7 text-white" />
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
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>

        {/* What's Included Section */}
        <section ref={includedRef} className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Image */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={includedInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/images/commercial/waste-station.jpg"
                    alt="Pet waste station installation"
                    fill
                    className="object-cover"
                  />
                </div>
                {/* Decorative element */}
                <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-navy-100 rounded-2xl -z-10" />
              </motion.div>

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={includedInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h2 className="text-display-sm font-bold text-navy-900 mb-6">
                  What&apos;s Included
                </h2>

                <div className="space-y-4">
                  {servicesIncluded.map((service, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={includedInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle className="w-6 h-6 text-teal-500 flex-shrink-0 mt-0.5" />
                      <span className="text-navy-700">{service}</span>
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  onClick={openModal}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-8 btn-primary inline-flex items-center gap-2"
                >
                  Get Your Free Consultation
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            </div>
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
                Why Partner With Us
              </h2>
              <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
                Professional pet waste management that benefits your property,
                residents, and bottom line.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={benefitsInView ? "visible" : "hidden"}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={benefit.title}
                    variants={itemVariants}
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all duration-300"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl ${benefit.color} flex items-center justify-center mb-4`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-navy-900 mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-navy-700/70">{benefit.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Commercial CTA Section */}
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
                Ready to Take Back Your{" "}
                <span className="text-teal-400">Commercial Property</span>?
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl text-white/80 mb-10 max-w-2xl mx-auto"
              >
                Join the growing number of property managers who trust us to
                keep their communities clean. Get your free consultation today.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <motion.button
                  onClick={openModal}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary text-lg inline-flex items-center justify-center gap-2"
                >
                  Schedule Free Consultation
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={ctaInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-12 flex flex-wrap justify-center gap-8 text-white/60"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-400" />
                  <span>No Obligation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-400" />
                  <span>Custom Plans</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-400" />
                  <span>Vetted Staff</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />

      {/* Commercial Contact Modal */}
      <CommercialContactModal isOpen={isModalOpen} onClose={closeModal} />
    </SmoothScrollProvider>
  );
}
