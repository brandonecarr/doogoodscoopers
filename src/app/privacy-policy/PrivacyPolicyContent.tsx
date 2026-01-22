"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Shield, ArrowRight, Phone } from "lucide-react";
import Link from "next/link";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

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
              className="prose prose-lg max-w-none prose-headings:text-navy-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-a:text-teal-600 hover:prose-a:text-teal-700"
            >
              <p>
                Protecting your private information is our priority. This Statement of Privacy applies to DooGoodScoopers.com, and DooGoodScoopers, LLC and governs data collection and usage. For the purposes of this Privacy Policy, unless otherwise noted, all references to DooGoodScoopers, LLC include DooGoodScoopers.com, DooGoodScoopers, and DooGoodScoopers.com. The DooGoodScoopers website is a Marketing & Promotions site. By using the DooGoodScoopers website, you consent to the data practices described in this statement.
              </p>

              <h2>Collection of your Personal Information</h2>
              <p>
                In order to better provide you with products and services offered, DooGoodScoopers may collect personally identifiable information, such as your:
              </p>
              <ul>
                <li>First and Last Name</li>
                <li>Mailing & Physical Address</li>
                <li>E-mail Address</li>
                <li>Phone Number</li>
                <li>Information about your home such as gate locations, areas to be cleaned.</li>
                <li>Information about your pets including names & birthdays.</li>
                <li>Images including but not limited to before and after photos and gate photos to display we secured it before leaving. These images will be available to you at your request. The gate photo will be sent to you immediately following your service to put your mind at ease. All images are subject to use as we see fit including but not limited to advertisements and social media.</li>
              </ul>
              <p>
                If you purchase DooGoodScoopers&apos; products and services, we collect billing and credit card information. This information is used to complete the purchase transaction.
              </p>
              <p>
                DooGoodScoopers may also collect anonymous demographic information, which is not unique to you, such as your:
              </p>
              <ul>
                <li>Age</li>
                <li>Gender</li>
                <li>Household Income</li>
                <li>Locations</li>
              </ul>
              <p>
                Please keep in mind that if you directly disclose personally identifiable information or personally sensitive data through DooGoodScoopers&apos; public message boards, this information may be collected and used by others.
              </p>
              <p>
                We do not collect any personal information about you unless you voluntarily provide it to us. However, you may be required to provide certain personal information to us when you elect to use certain products or services. These may include: (a) registering for an account; (b) entering a sweepstakes or contest sponsored by us or one of our partners; (c) signing up for special offers from selected third parties; (d) sending us an email message; (e) submitting your credit card or other payment information when ordering and purchasing products and services. To wit, we will use your information for, but not limited to, communicating with you in relation to services and/or products you have requested from us. We also may gather additional personal or non-personal information in the future.
              </p>

              <h2>Use of your Personal Information</h2>
              <p>
                DooGoodScoopers collects and uses your personal information to operate and deliver the services you have requested.
              </p>
              <p>
                DooGoodScoopers may also use your personally identifiable information to inform you of other products or services available from DooGoodScoopers and its affiliates.
              </p>

              <h2>Sharing Information with Third Parties</h2>
              <p>
                DooGoodScoopers does not sell, rent or lease its customer lists to third parties.
              </p>
              <p>
                DooGoodScoopers may, from time to time, contact you on behalf of external business partners about a particular offering that may be of interest to you. In those cases, your unique personally identifiable information (e-mail, name, address, telephone number) is transferred to the third party. DooGoodScoopers may share data with trusted partners to help perform statistical analysis, send you email or postal mail, provide customer support, or arrange for deliveries. All such third parties are prohibited from using your personal information except to provide these services to DooGoodScoopers, and they are required to maintain the confidentiality of your information.
              </p>
              <p>
                DooGoodScoopers may disclose your personal information, without notice, if required to do so by law or in the good faith belief that such action is necessary to: (a) conform to the edicts of the law or comply with legal process served on DooGoodScoopers or the site; (b) protect and defend the rights or property of DooGoodScoopers; and/or (c) act under exigent circumstances to protect the personal safety of users of DooGoodScoopers, or the public.
              </p>
              <p>
                DooGoodScoopers may utilize user information on 3rd party advertising platforms such as google ads, facebook ads, or other social media sites, and marketing channels.
              </p>
              <p>
                DooGoodScoopers may also conduct user surveys with 3rd party software with information collected.
              </p>

              <h2>Opt-Out of Disclosure of Personal Information to Third Parties</h2>
              <p>
                In connection with any personal information we may disclose to a third party for a business purpose, you have the right to know:
              </p>
              <ul>
                <li>The categories of personal information that we disclosed about you for a business purpose.</li>
              </ul>
              <p>
                You have the right under the California Consumer Privacy Act of 2018 (CCPA) and certain other privacy and data protection laws, as applicable, to opt-out of the disclosure of your personal information. If you exercise your right to opt-out of the disclosure of your personal information, we will refrain from disclosing your personal information, unless you subsequently provide express authorization for the disclosure of your personal information. To opt-out of the disclosure of your personal information, email <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a>
              </p>

              <h2>Tracking User Behavior</h2>
              <p>
                DooGoodScoopers may keep track of the websites and pages our users visit within DooGoodScoopers, in order to determine what DooGoodScoopers services are the most popular. This data is used to deliver customized content and advertising within DooGoodScoopers to customers whose behavior indicates that they are interested in a particular subject area.
              </p>

              <h2>Automatically Collected Information</h2>
              <p>
                Information about your computer hardware and software may be automatically collected by DooGoodScoopers. This information can include: your IP address, browser type, domain names, access times and referring website addresses. This information is used for the operation of the service, to maintain quality of the service, and to provide general statistics regarding use of the DooGoodScoopers website.
              </p>

              <h2>Use of Cookies</h2>
              <p>
                The DooGoodScoopers website may use &quot;cookies&quot; to help you personalize your online experience. A cookie is a text file that is placed on your hard disk by a web page server. Cookies cannot be used to run programs or deliver viruses to your computer. Cookies are uniquely assigned to you, and can only be read by a web server in the domain that issued the cookie to you.
              </p>
              <p>
                One of the primary purposes of cookies is to provide a convenience feature to save you time. The purpose of a cookie is to tell the Web server that you have returned to a specific page. For example, if you personalize DooGoodScoopers pages, or register with DooGoodScoopers site or services, a cookie helps DooGoodScoopers to recall your specific information on subsequent visits. This simplifies the process of recording your personal information, such as billing addresses, shipping addresses, and so on. When you return to the same DooGoodScoopers website, the information you previously provided can be retrieved, so you can easily use the DooGoodScoopers features that you customized.
              </p>
              <p>
                You have the ability to accept or decline cookies. Most Web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. If you choose to decline cookies, you may not be able to fully experience the interactive features of the DooGoodScoopers services or websites you visit.
              </p>

              <h2>Links</h2>
              <p>
                This website contains links to other sites. Please be aware that we are not responsible for the content or privacy practices of such other sites. We encourage our users to be aware when they leave our site and to read the privacy statements of any other site that collects personally identifiable information.
              </p>

              <h2>Security of your Personal Information</h2>
              <p>
                DooGoodScoopers secures your personal information from unauthorized access, use, or disclosure. DooGoodScoopers uses the following methods for this purpose:
              </p>
              <ul>
                <li>SSL Protocol</li>
              </ul>
              <p>
                When personal information (such as a credit card number) is transmitted to other websites, it is protected through the use of encryption, such as the Secure Sockets Layer (SSL) protocol.
              </p>
              <p>
                We strive to take appropriate security measures to protect against unauthorized access to or alteration of your personal information. Unfortunately, no data transmission over the Internet or any wireless network can be guaranteed to be 100% secure. As a result, while we strive to protect your personal information, you acknowledge that: (a) there are security and privacy limitations inherent to the Internet which are beyond our control; and (b) security, integrity, and privacy of any and all information and data exchanged between you and us through this Site cannot be guaranteed.
              </p>

              <h2>Right to Deletion</h2>
              <p>
                Subject to certain exceptions set out below, on receipt of a verifiable request from you, we will:
              </p>
              <ul>
                <li>Delete your personal information from our records; and</li>
                <li>Direct any service providers to delete your personal information from their records.</li>
              </ul>
              <p>
                Please note that we may not be able to comply with requests to delete your personal information if it is necessary to:
              </p>
              <ul>
                <li>Complete the transaction for which the personal information was collected, fulfill the terms of a written warranty or product recall conducted in accordance with federal law, provide a good or service requested by you, or reasonably anticipated within the context of our ongoing business relationship with you, or otherwise perform a contract between you and us;</li>
                <li>Detect security incidents, protect against malicious, deceptive, fraudulent, or illegal activity; or prosecute those responsible for that activity;</li>
                <li>Debug to identify and repair errors that impair existing intended functionality;</li>
                <li>Exercise free speech, ensure the right of another consumer to exercise his or her right of free speech, or exercise another right provided for by law;</li>
                <li>Comply with the California Electronic Communications Privacy Act;</li>
                <li>Engage in public or peer-reviewed scientific, historical, or statistical research in the public interest that adheres to all other applicable ethics and privacy laws, when our deletion of the information is likely to render impossible or seriously impair the achievement of such research, provided we have obtained your informed consent;</li>
                <li>Enable solely internal uses that are reasonably aligned with your expectations based on your relationship with us;</li>
                <li>Comply with an existing legal obligation; or</li>
                <li>Otherwise use your personal information, internally, in a lawful manner that is compatible with the context in which you provided the information.</li>
              </ul>

              <h2>Children Under Thirteen</h2>
              <p>
                DooGoodScoopers does not knowingly collect personally identifiable information from children under the age of thirteen. If you are under the age of thirteen, you must ask your parent or guardian for permission to use this website.
              </p>

              <h2>Opt-Out & Unsubscribe from Third Party Communications</h2>
              <p>
                We respect your privacy and give you an opportunity to opt-out of receiving announcements of certain information. Users may opt-out of receiving any or all communications from third-party partners of DooGoodScoopers by contacting us here:
              </p>
              <ul>
                <li>Email: <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a></li>
                <li>Phone: <a href="tel:909-366-3744">909-366-3744</a></li>
                <li>Replying &quot;Stop&quot; to SMS messages.</li>
              </ul>

              <h2>E-mail Communications</h2>
              <p>
                From time to time, DooGoodScoopers may contact you via email for the purpose of providing announcements, promotional offers, alerts, confirmations, surveys, and/or other general communication. In order to improve our Services, we may receive a notification when you open an email from DooGoodScoopers or click on a link therein.
              </p>
              <p>
                If you would like to stop receiving marketing or promotional communications via email from DooGoodScoopers, you may opt out of such communications by clicking the &quot;Unsubscribe&quot; button.
              </p>

              <h2>SMS/Text Communications</h2>
              <p>
                Users that receive a free quote on DooGoodScoopers.com and provide their phone number agree to receive calls and text messages from DooGoodScoopers, including for marketing and promotional purposes.
              </p>
              <p>
                Users may opt out of these messages in the future by replying &quot;stop&quot;
              </p>
              <p>
                From time to time, DooGoodScoopers may contact you via SMS/Text Message for the purpose of providing announcements, promotional offers, alerts, confirmations, surveys, and/or other general communication. In order to improve our Services, we may receive a notification when you open an SMS message from DooGoodScoopers or click on a link therein.
              </p>
              <p>
                If you would like to stop receiving marketing or promotional communications via email from DooGoodScoopers, you may opt out of such communications by replying &quot;stop&quot; to the SMS message or emailing us at <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a> to be removed.
              </p>

              <h2>External Data Storage Sites</h2>
              <p>
                We may store your data on servers provided by third party hosting vendors with whom we have contracted.
              </p>

              <h2>Changes to this Statement</h2>
              <p>
                DooGoodScoopers reserves the right to change this Privacy Policy from time to time. We will notify you about significant changes in the way we treat personal information by sending a notice to the primary email address specified in your account, by placing a prominent notice on our website, and/or by updating any privacy information. Your continued use of the website and/or Services available after such modifications will constitute your: (a) acknowledgment of the modified Privacy Policy; and (b) agreement to abide and be bound by that Policy.
              </p>

              <h2>Contact Information</h2>
              <p>
                DooGoodScoopers welcomes your questions or comments regarding this Statement of Privacy. If you believe that DooGoodScoopers has not adhered to this Statement, please contact DooGoodScoopers at:
              </p>
              <p>
                <strong>DooGoodScoopers, LLC</strong><br />
                11799 Sebastian Way, Suite 103<br />
                Rancho Cucamonga, CA 91730
              </p>
              <p>
                Email Address: <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a>
              </p>
              <p>
                Telephone number: <a href="tel:(909) 366-3744">(909) 366-3744</a>
              </p>
              <p>
                <strong>Effective as of December 1, 2024</strong>
              </p>
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
