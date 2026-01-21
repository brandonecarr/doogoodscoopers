"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Briefcase,
  Sun,
  Clock,
  Heart,
  CheckCircle,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

const benefits = [
  {
    icon: Sun,
    title: "Outdoor Work",
    description: "Enjoy working outside in the beautiful Inland Empire weather.",
  },
  {
    icon: Clock,
    title: "Flexible Hours",
    description: "Work schedules that fit your lifestyle and commitments.",
  },
  {
    icon: Heart,
    title: "Pet-Friendly",
    description: "Perfect for animal lovers who enjoy being around dogs.",
  },
  {
    icon: Briefcase,
    title: "Growth Opportunity",
    description: "Join a growing company with room for advancement.",
  },
];

export function CareersContent() {
  const heroRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);

  const heroInView = useInView(heroRef, { once: true });
  const formInView = useInView(formRef, { once: true, margin: "-100px" });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/careers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit application");
      }

      setSubmitSuccess(true);
    } catch {
      setError("Something went wrong. Please try again or call us directly.");
    } finally {
      setIsSubmitting(false);
    }
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Content */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={heroInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-6"
                >
                  <Briefcase className="w-4 h-4" />
                  We&apos;re Hiring!
                </motion.div>

                <h1 className="text-display-md font-bold text-navy-900 mb-6">
                  Looking For A Career In{" "}
                  <span className="text-teal-600">Dog Poop</span>?
                </h1>

                <p className="text-xl text-navy-700/80 mb-4">
                  Who isn&apos;t? Am I right? Come join our team!
                </p>

                <p className="text-navy-700/70 mb-8">
                  We&apos;re looking for hardworking, reliable individuals who
                  love being outdoors and aren&apos;t afraid to get their hands
                  dirty (well, gloved). If you&apos;re ready for flexible hours,
                  great pay, and a job that makes a real difference for families
                  and their furry friends, we want to hear from you!
                </p>

                {/* Benefits */}
                <div className="grid grid-cols-2 gap-4">
                  {benefits.map((benefit, index) => {
                    const Icon = benefit.icon;
                    return (
                      <motion.div
                        key={benefit.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={heroInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-navy-900 text-sm">
                            {benefit.title}
                          </h3>
                          <p className="text-navy-700/70 text-xs">
                            {benefit.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Image */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={heroInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/images/commercial/team-scooping.jpg"
                    alt="DooGoodScoopers team at work"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-teal-100 rounded-2xl -z-10" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Application Form Section */}
        <section ref={formRef} className="py-24 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={formInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-display-sm font-bold text-navy-900 mb-4">
                Apply Now
              </h2>
              <p className="text-navy-700/70">
                Fill out all fields below. If something doesn&apos;t apply,
                simply type &quot;NA&quot;.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={formInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-card p-8 md:p-10"
            >
              {submitSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-teal-100 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-teal-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-navy-900 mb-3">
                    Application Submitted!
                  </h3>
                  <p className="text-navy-700/70 max-w-md mx-auto">
                    Your application will be kept on file. We will reach out to
                    you for next steps. Thank you so very much for your
                    interest!
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-navy-900 mb-4 pb-2 border-b border-gray-200">
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="address"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Date of Birth <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Driver&apos;s License Number{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="driversLicense"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Last 4 of SSN <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="ssnLast4"
                          required
                          maxLength={4}
                          pattern="[0-9]{4}"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Employment Eligibility */}
                  <div>
                    <h3 className="text-lg font-semibold text-navy-900 mb-4 pb-2 border-b border-gray-200">
                      Employment Eligibility
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-2">
                          Are you a legal citizen of the United States?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="legalCitizen"
                              value="yes"
                              required
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="legalCitizen"
                              value="no"
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">No</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-2">
                          Do you have auto insurance?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="hasAutoInsurance"
                              value="yes"
                              required
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="hasAutoInsurance"
                              value="no"
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">No</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-2">
                          Have you ever been convicted of a felony?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="convictedFelony"
                              value="yes"
                              required
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="convictedFelony"
                              value="no"
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">No</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work History */}
                  <div>
                    <h3 className="text-lg font-semibold text-navy-900 mb-4 pb-2 border-b border-gray-200">
                      Work History
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          References <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="references"
                          required
                          rows={3}
                          placeholder="Please provide 2-3 references with contact information"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Current Employment{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="currentEmployment"
                          required
                          placeholder="Company name and position (or NA if not employed)"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Describe Your Work Duties{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="workDuties"
                          required
                          rows={3}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          Why&apos;d You Leave Your Previous Job?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="whyLeftPrevious"
                          required
                          rows={2}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-2">
                          May we contact your current or previous employers?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="mayContactEmployers"
                              value="yes"
                              required
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="mayContactEmployers"
                              value="no"
                              className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-navy-700">No</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-900 mb-1.5">
                          What is your old boss&apos; name and phone number?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="previousBossContact"
                          required
                          placeholder="Name and phone number (or NA)"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Motivation */}
                  <div>
                    <h3 className="text-lg font-semibold text-navy-900 mb-4 pb-2 border-b border-gray-200">
                      Tell Us About Yourself
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-1.5">
                        Why do you want to work here?{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="whyWorkHere"
                        required
                        rows={4}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
                      />
                    </div>
                  </div>

                  {/* Agreement */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="agreement"
                        required
                        className="mt-1 w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-navy-700/80">
                        I certify that all information provided is accurate and
                        complete. I authorize DooGoodScoopers to conduct
                        background checks if necessary.{" "}
                        <span className="text-red-500">*</span>
                      </span>
                    </label>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                    className={cn(
                      "w-full py-4 px-6 rounded-full font-semibold text-white transition-all",
                      "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700",
                      "shadow-lg hover:shadow-xl",
                      "disabled:opacity-70 disabled:cursor-not-allowed"
                    )}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      "Submit Application"
                    )}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
