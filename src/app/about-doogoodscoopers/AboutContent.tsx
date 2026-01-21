"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import {
  Heart,
  Target,
  Eye,
  Users,
  Star,
  Leaf,
  Shield,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Values
const values = [
  {
    icon: Star,
    title: "Excellence",
    description:
      "We strive to deliver five-star service experiences with every visit.",
  },
  {
    icon: Heart,
    title: "Care",
    description:
      "We treat every yard like our own and every pet like family.",
  },
  {
    icon: Leaf,
    title: "Eco-Friendly",
    description:
      "We use environmentally responsible practices to keep communities clean.",
  },
  {
    icon: Shield,
    title: "Reliability",
    description:
      "You can count on us to show up on time, every time.",
  },
];

export function AboutContent() {
  const heroRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const missionRef = useRef<HTMLElement>(null);
  const teamRef = useRef<HTMLElement>(null);
  const valuesRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  const heroInView = useInView(heroRef, { once: true });
  const storyInView = useInView(storyRef, { once: true, margin: "-100px" });
  const missionInView = useInView(missionRef, { once: true, margin: "-100px" });
  const teamInView = useInView(teamRef, { once: true, margin: "-100px" });
  const valuesInView = useInView(valuesRef, { once: true, margin: "-100px" });
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
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={heroInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.2 }}
                className="inline-block px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-6"
              >
                About DooGoodScoopers
              </motion.span>

              <h1 className="text-display-md font-bold text-navy-900 mb-6">
                Meet the Team Behind{" "}
                <span className="text-teal-600">Your Clean Yard</span>
              </h1>

              <p className="text-xl text-navy-700/80">
                Founded in 2024 by a husband-and-wife team with a passion for
                pets and helping families, DooGoodScoopers is here to make
                your life easier—one scoop at a time.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Our Story Section */}
        <section ref={storyRef} className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Polaroid Stack */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={storyInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="relative flex items-center justify-center h-[480px] md:h-[560px]"
              >
                {/* Background Polaroid 1 - Bottom of stack */}
                <div
                  className="absolute bg-white p-4 shadow-lg opacity-60"
                  style={{ transform: "rotate(8deg) translate(40px, 25px)" }}
                >
                  <div className="relative w-[340px] h-[270px] md:w-[400px] md:h-[320px] bg-gray-200 overflow-hidden">
                    <Image
                      src="/images/residential/yard-cleanup.jpg"
                      alt=""
                      fill
                      className="object-cover blur-[2px] opacity-50"
                    />
                  </div>
                  <div className="h-10 mt-2" />
                </div>

                {/* Background Polaroid 2 - Middle of stack */}
                <div
                  className="absolute bg-white p-4 shadow-lg opacity-70"
                  style={{ transform: "rotate(-6deg) translate(-35px, 20px)" }}
                >
                  <div className="relative w-[340px] h-[270px] md:w-[400px] md:h-[320px] bg-gray-200 overflow-hidden">
                    <Image
                      src="/images/residential/scooper-professional.jpg"
                      alt=""
                      fill
                      className="object-cover blur-[2px] opacity-50"
                    />
                  </div>
                  <div className="h-10 mt-2" />
                </div>

                {/* Main Polaroid - Top of stack */}
                <motion.div
                  initial={{ opacity: 0, rotate: -2, y: 20 }}
                  animate={storyInView ? { opacity: 1, rotate: -2, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="relative bg-white p-4 shadow-2xl z-10"
                  style={{ transform: "rotate(-2deg)" }}
                >
                  <div className="relative w-[340px] h-[270px] md:w-[400px] md:h-[320px]">
                    <Image
                      src="/images/about/dream-team.jpg"
                      alt="Brandon and Valerie"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="text-center text-navy-700 text-2xl md:text-3xl mt-3 pb-1 font-handwriting">
                    The Dream Team
                  </p>
                </motion.div>
              </motion.div>

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={storyInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h2 className="text-display-sm font-bold text-navy-900 mb-6">
                  Our Story
                </h2>

                <div className="space-y-4 text-navy-700/80">
                  <p>
                    Hi there! We&apos;re Brandon and Valerie, the husband-and-wife
                    duo behind DooGoodScoopers. After 12 years of teamwork,
                    laughter, and a shared passion for making life easier for
                    others, we decided to turn our love of pets into a business
                    that helps families across the Inland Empire.
                  </p>
                  <p>
                    We founded DooGoodScoopers in 2024 right here in the
                    Inland Empire, California, because we saw a need—and a lot
                    of dog poop. We know that scooping isn&apos;t exactly the most
                    glamorous chore, but someone&apos;s gotta do it. Why not let it
                    be us?
                  </p>
                  <p>
                    Our goal is simple: to provide cleaner, healthier spaces for
                    families and their furry friends. Whether you have one dog
                    or a whole pack, we&apos;re here to help you reclaim your yard
                    and your free time.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Mission & Vision Section */}
        <section ref={missionRef} className="py-24 bg-gray-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={missionInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-display-sm font-bold text-navy-900 mb-4">
                Our Mission & Vision
              </h2>
              <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
                We&apos;re not just cleaning yards—we&apos;re building healthier
                communities, one scoop at a time.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Mission */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={missionInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white rounded-2xl p-8 shadow-card"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-6">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-4">
                  Our Mission
                </h3>
                <p className="text-navy-700/80">
                  To be the best poop cleaners in Fontana and the Inland Empire,
                  while raising awareness that professional dog waste removal is
                  a valuable service many pet owners don&apos;t realize exists. We
                  want to make it easy for families to enjoy their outdoor
                  spaces without the mess.
                </p>
              </motion.div>

              {/* Vision */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={missionInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-white rounded-2xl p-8 shadow-card"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-navy-500 to-navy-600 flex items-center justify-center mb-6">
                  <Eye className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-4">
                  Our Vision
                </h3>
                <p className="text-navy-700/80">
                  To revolutionize the pet waste removal industry by setting the
                  highest standards of service, cleanliness, and customer
                  satisfaction. We strive to improve community environments
                  through reliability and eco-friendly practices, making the
                  Inland Empire a cleaner place for everyone.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* True Professionals Section */}
        <section ref={teamRef} className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Content */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={teamInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6 }}
              >
                <span className="inline-block px-4 py-2 bg-navy-100 text-navy-700 rounded-full text-sm font-medium mb-4">
                  True Professionals
                </span>
                <h2 className="text-display-sm font-bold text-navy-900 mb-6">
                  Dedicated to{" "}
                  <span className="text-teal-600">Five-Star Service</span>
                </h2>

                <div className="space-y-4 text-navy-700/80">
                  <p>
                    At DooGoodScoopers, we take pride in being true
                    professionals. Every member of our team is committed to
                    delivering a five-star service experience with every single
                    visit.
                  </p>
                  <p>
                    We show up on time, do thorough work, and treat your
                    property with respect. Our team undergoes background checks
                    and training to ensure you can trust us in your yard—whether
                    you&apos;re home or not.
                  </p>
                  <p>
                    We believe that professional pet waste removal should be
                    just that: professional. That means reliable scheduling,
                    clear communication, and results you can see (or rather,
                    can&apos;t see!).
                  </p>
                </div>

                <div className="mt-8 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600" />
                    <span className="text-navy-900 font-medium">
                      Trusted Professionals
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-teal-600" />
                    <span className="text-navy-900 font-medium">
                      5-Star Service
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Image */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={teamInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/images/residential/scooper-professional.jpg"
                    alt="DooGoodScoopers team at work"
                    fill
                    className="object-cover"
                  />
                </div>
                {/* Decorative element */}
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-navy-100 rounded-2xl -z-10" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Our Values Section */}
        <section ref={valuesRef} className="py-24 bg-gray-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={valuesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-display-sm font-bold text-navy-900 mb-4">
                Our Values
              </h2>
              <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
                These core values guide everything we do at DooGoodScoopers.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={valuesInView ? "visible" : "hidden"}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
            >
              {values.map((value) => {
                const Icon = value.icon;
                return (
                  <motion.div
                    key={value.title}
                    variants={itemVariants}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="bg-white rounded-2xl p-6 text-center shadow-card hover:shadow-elevated transition-all duration-300"
                  >
                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-navy-900 mb-2">
                      {value.title}
                    </h3>
                    <p className="text-navy-700/70 text-sm">
                      {value.description}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
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
                Ready to Reclaim Your{" "}
                <span className="text-teal-400">Yard</span>?
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl text-white/80 mb-10 max-w-2xl mx-auto"
              >
                Let Brandon, Valerie, and the DooGoodScoopers team take care
                of the dirty work. Get your free quote today!
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
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
          </div>
        </section>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
