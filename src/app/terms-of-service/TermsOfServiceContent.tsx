"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  FileText,
  ArrowRight,
  Phone,
  CreditCard,
  Calendar,
  Clock,
  CalendarX,
  Sparkles,
  Database,
  Shield,
  HelpCircle,
  Lock,
  Mail,
  MapPin,
  User,
  Settings,
  Bell,
  Star,
  Heart,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Home,
  Truck,
  DollarSign,
  Percent,
  Gift,
  Award,
  Target,
  Briefcase,
  Share2,
  Ban,
  Activity,
  Monitor,
  Cookie,
  Link2,
  Baby,
  MessageSquare,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Icon mapping for dynamic content
const iconMap: Record<string, LucideIcon> = {
  "credit-card": CreditCard,
  calendar: Calendar,
  "calendar-x": CalendarX,
  clock: Clock,
  shield: Shield,
  "help-circle": HelpCircle,
  "file-text": FileText,
  lock: Lock,
  mail: Mail,
  phone: Phone,
  "map-pin": MapPin,
  user: User,
  settings: Settings,
  bell: Bell,
  star: Star,
  heart: Heart,
  "check-circle": CheckCircle,
  "alert-circle": AlertCircle,
  info: Info,
  sparkles: Sparkles,
  zap: Zap,
  home: Home,
  truck: Truck,
  "dollar-sign": DollarSign,
  percent: Percent,
  gift: Gift,
  award: Award,
  target: Target,
  briefcase: Briefcase,
  database: Database,
  share: Share2,
  ban: Ban,
  activity: Activity,
  monitor: Monitor,
  cookie: Cookie,
  link: Link2,
  baby: Baby,
  "message-square": MessageSquare,
  refresh: RefreshCw,
  trash: Trash2,
};

interface TermsSection {
  icon: LucideIcon;
  title: string;
  content: React.ReactNode;
}

// Dynamic section from database
interface DynamicSection {
  id: string;
  icon: string;
  title: string;
  content: string;
}

interface TermsOfServiceContentProps {
  dynamicSections?: DynamicSection[] | null;
  lastUpdated?: string | null;
}

const termsData: TermsSection[] = [
  {
    icon: CreditCard,
    title: "How do I pay?",
    content: (
      <>
        <p className="text-gray-600 mb-4">
          DooGoodScoopers processes payments via our client portal. Customers link their credit/debit card to the portal, and invoices are generated and paid automatically.
        </p>
        <p className="text-gray-600">
          <strong>Please note: your card will need to be linked to your account by the time we arrive at your home for service.</strong>
        </p>
      </>
    ),
  },
  {
    icon: Calendar,
    title: "Do you bill monthly?",
    content: (
      <>
        <p className="text-gray-600 mb-4">
          We bill on the 1st of each month before service delivery. For initial and one-time cleanups, we bill upon job completion.
        </p>
        <p className="text-gray-600 mb-4">
          If you are a new customer signing up for recurring services, you will be billed at the time of sign-up for your initial cleanup. You will then be billed for the remaining portion of the month on your first regular service date.
        </p>
        <p className="text-gray-600 mb-4">
          <strong>Example:</strong> A customer, let&apos;s call him John, signs up for weekly service on 1/14/2025 with a monthly rate of $80/month. John would be charged at the time of sign-up for his initial cleanup. Then, on his first regular service date, John would be billed for the remainder of January. Since his service date would fall two more times in January (on 1/22 &amp; 1/29), he would be charged $40 that day (or $20 per visit). Going forward, John would be charged $80 per month.
        </p>
        <p className="text-gray-600 mb-4">
          <em>Note: if your account is unpaid, you will be removed from our service schedule until payment processes.</em>
        </p>
        <p className="text-gray-600">
          <strong>Monthly service charges are non-refundable.</strong>
        </p>
      </>
    ),
  },
  {
    icon: Clock,
    title: "What time will you be at my home?",
    content: (
      <>
        <p className="text-gray-600 mb-4">
          We can&apos;t guarantee a specific time since our service days are optimized as routes. Depending on time of year, routes may run 7am to dark. Customers should expect an approximate 60 minute heads up via text when we are on the way.
        </p>
        <p className="text-gray-600">
          If you sign up with us, and we tell you that your service day is Wednesday, it will be Wednesday every week, unless we advise you otherwise in advance.
        </p>
      </>
    ),
  },
  {
    icon: CalendarX,
    title: "What Happens If my Service Day is on a Holiday?",
    content: (
      <p className="text-gray-600">
        On occasion, your service date may fall on a holiday. When this happens, we may skip service that week, and perform a double cleanup the following week. You will still be charged for the waste accumulated during this period.
      </p>
    ),
  },
  {
    icon: Sparkles,
    title: "Do you disinfect your equipment?",
    content: (
      <p className="text-gray-600">
        Yes! We disinfect all equipment after each and every cleanup. We use an organic, kennel grade disinfectant. This ensures that we don&apos;t pass germs from one home to the next.
      </p>
    ),
  },
  {
    icon: Database,
    title: "Data Usage",
    content: (
      <p className="text-gray-600">
        DooGoodScoopers retains the data collected to assess business performance and improve quality of service. By accepting these terms, DooGoodScoopers may use the data provided for advertising and/or marketing purposes.
      </p>
    ),
  },
];

export function TermsOfServiceContent({ dynamicSections, lastUpdated }: TermsOfServiceContentProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });
  const contentRef = useRef<HTMLDivElement>(null);
  const contentInView = useInView(contentRef, { once: true, margin: "-100px" });
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  // Use dynamic sections if available, otherwise fall back to hardcoded data
  const useDynamic = dynamicSections && dynamicSections.length > 0;

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
            >
              <p className="text-gray-600 text-lg leading-relaxed mb-12">
                By using DooGoodScoopers services, you agree to the following
                terms and conditions. These policies ensure a smooth and
                professional experience for all our customers.
              </p>

              <div className="space-y-8">
                {useDynamic
                  ? dynamicSections.map((section, index) => {
                      const Icon = iconMap[section.icon] || HelpCircle;
                      return (
                        <motion.div
                          key={section.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={contentInView ? { opacity: 1, y: 0 } : {}}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="bg-gray-50 rounded-2xl p-8"
                        >
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white">
                              <Icon className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-bold text-navy-900">
                              {section.title}
                            </h2>
                          </div>
                          <div
                            className="prose prose-gray max-w-none [&_p]:text-gray-600 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:space-y-2 [&_ul]:mb-4 [&_li]:text-gray-600 [&_strong]:font-semibold [&_em]:italic [&_a]:text-teal-600 [&_a]:underline [&_a:hover]:text-teal-700"
                            dangerouslySetInnerHTML={{ __html: section.content }}
                          />
                        </motion.div>
                      );
                    })
                  : termsData.map((section, index) => {
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
                            <h2 className="text-2xl font-bold text-navy-900">
                              {section.title}
                            </h2>
                          </div>
                          {section.content}
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
                  Last updated: {lastUpdated || "January 2025"}
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
