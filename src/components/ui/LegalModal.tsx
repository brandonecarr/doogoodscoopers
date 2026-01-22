"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useSmoothScroll } from "@/components/providers/SmoothScrollProvider";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "terms" | "privacy";
}

export function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  const smoothScroll = useSmoothScroll();

  // Lock body scroll and stop Lenis when modal is open
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      smoothScroll?.stopScroll();
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      smoothScroll?.startScroll();
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      smoothScroll?.startScroll();
    };
  }, [isOpen, onClose, smoothScroll]);

  const handleClose = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Container */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-navy-800 to-navy-900 rounded-t-2xl">
                <h2 className="text-xl font-bold text-white">
                  {type === "terms" ? "Terms of Service" : "Privacy Policy"}
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content - scrollable */}
              <div
                className="flex-1 overflow-y-scroll overscroll-contain p-6"
                style={{ WebkitOverflowScrolling: "touch" }}
                onWheel={(e) => e.stopPropagation()}
              >
                {type === "terms" ? <TermsContent /> : <PrivacyContent />}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                <button
                  onClick={handleClose}
                  className="w-full sm:w-auto px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function TermsContent() {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-navy-900 prose-p:text-gray-600">
      <h3>How do I pay?</h3>
      <p>
        DooGoodScoopers processes payments via our client portal. Customers link their credit/debit card to the portal, and invoices are generated and paid automatically.
      </p>
      <p>
        <strong>Please note: your card will need to be linked to your account by the time we arrive at your home for service.</strong>
      </p>

      <h3>Do you bill monthly?</h3>
      <p>
        We bill on the 1st of each month before service delivery. For initial and one-time cleanups, we bill upon job completion.
      </p>
      <p>
        If you are a new customer signing up for recurring services, you will be billed at the time of sign-up for your initial cleanup. You will then be billed for the remaining portion of the month on your first regular service date.
      </p>
      <p>
        <strong>Example:</strong> A customer, let&apos;s call him John, signs up for weekly service on 1/14/2025 with a monthly rate of $80/month. John would be charged at the time of sign-up for his initial cleanup. Then, on his first regular service date, John would be billed for the remainder of January. Since his service date would fall two more times in January (on 1/22 &amp; 1/29), he would be charged $40 that day (or $20 per visit). Going forward, John would be charged $80 per month.
      </p>
      <p>
        <em>Note: if your account is unpaid, you will be removed from our service schedule until payment processes.</em>
      </p>
      <p>
        <strong>Monthly service charges are non-refundable.</strong>
      </p>

      <h3>What time will you be at my home?</h3>
      <p>
        We can&apos;t guarantee a specific time since our service days are optimized as routes. Depending on time of year, routes may run 7am to dark. Customers should expect an approximate 60 minute heads up via text when we are on the way.
      </p>
      <p>
        If you sign up with us, and we tell you that your service day is Wednesday, it will be Wednesday every week, unless we advise you otherwise in advance.
      </p>

      <h3>What Happens If my Service Day is on a Holiday?</h3>
      <p>
        On occasion, your service date may fall on a holiday. When this happens, we may skip service that week, and perform a double cleanup the following week. You will still be charged for the waste accumulated during this period.
      </p>

      <h3>Do you disinfect your equipment?</h3>
      <p>
        Yes! We disinfect all equipment after each and every cleanup. We use an organic, kennel grade disinfectant. This ensures that we don&apos;t pass germs from one home to the next.
      </p>

      <h3>Data Usage</h3>
      <p>
        DooGoodScoopers retains the data collected to assess business performance and improve quality of service. By accepting these terms, DooGoodScoopers may use the data provided for advertising and/or marketing purposes.
      </p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-navy-900 prose-p:text-gray-600">
      <p>
        Protecting your private information is our priority. This Statement of Privacy applies to DooGoodScoopers.com, and DooGoodScoopers, LLC and governs data collection and usage. For the purposes of this Privacy Policy, unless otherwise noted, all references to DooGoodScoopers, LLC include DooGoodScoopers.com, DooGoodScoopers, and DooGoodScoopers.com. The DooGoodScoopers website is a Marketing &amp; Promotions site. By using the DooGoodScoopers website, you consent to the data practices described in this statement.
      </p>

      <h3>Collection of your Personal Information</h3>
      <p>
        In order to better provide you with products and services offered, DooGoodScoopers may collect personally identifiable information, such as your:
      </p>
      <ul>
        <li>First and Last Name</li>
        <li>Mailing &amp; Physical Address</li>
        <li>E-mail Address</li>
        <li>Phone Number</li>
        <li>Information about your home such as gate locations, areas to be cleaned.</li>
        <li>Information about your pets including names &amp; birthdays.</li>
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

      <h3>Use of your Personal Information</h3>
      <p>
        DooGoodScoopers collects and uses your personal information to operate and deliver the services you have requested.
      </p>
      <p>
        DooGoodScoopers may also use your personally identifiable information to inform you of other products or services available from DooGoodScoopers and its affiliates.
      </p>

      <h3>Sharing Information with Third Parties</h3>
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

      <h3>Opt-Out of Disclosure of Personal Information to Third Parties</h3>
      <p>
        In connection with any personal information we may disclose to a third party for a business purpose, you have the right to know:
      </p>
      <ul>
        <li>The categories of personal information that we disclosed about you for a business purpose.</li>
      </ul>
      <p>
        You have the right under the California Consumer Privacy Act of 2018 (CCPA) and certain other privacy and data protection laws, as applicable, to opt-out of the disclosure of your personal information. If you exercise your right to opt-out of the disclosure of your personal information, we will refrain from disclosing your personal information, unless you subsequently provide express authorization for the disclosure of your personal information. To opt-out of the disclosure of your personal information, email service@doogoodscoopers.com
      </p>

      <h3>Tracking User Behavior</h3>
      <p>
        DooGoodScoopers may keep track of the websites and pages our users visit within DooGoodScoopers, in order to determine what DooGoodScoopers services are the most popular. This data is used to deliver customized content and advertising within DooGoodScoopers to customers whose behavior indicates that they are interested in a particular subject area.
      </p>

      <h3>Automatically Collected Information</h3>
      <p>
        Information about your computer hardware and software may be automatically collected by DooGoodScoopers. This information can include: your IP address, browser type, domain names, access times and referring website addresses. This information is used for the operation of the service, to maintain quality of the service, and to provide general statistics regarding use of the DooGoodScoopers website.
      </p>

      <h3>Use of Cookies</h3>
      <p>
        The DooGoodScoopers website may use &quot;cookies&quot; to help you personalize your online experience. A cookie is a text file that is placed on your hard disk by a web page server. Cookies cannot be used to run programs or deliver viruses to your computer. Cookies are uniquely assigned to you, and can only be read by a web server in the domain that issued the cookie to you.
      </p>
      <p>
        One of the primary purposes of cookies is to provide a convenience feature to save you time. The purpose of a cookie is to tell the Web server that you have returned to a specific page. For example, if you personalize DooGoodScoopers pages, or register with DooGoodScoopers site or services, a cookie helps DooGoodScoopers to recall your specific information on subsequent visits. This simplifies the process of recording your personal information, such as billing addresses, shipping addresses, and so on. When you return to the same DooGoodScoopers website, the information you previously provided can be retrieved, so you can easily use the DooGoodScoopers features that you customized.
      </p>
      <p>
        You have the ability to accept or decline cookies. Most Web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. If you choose to decline cookies, you may not be able to fully experience the interactive features of the DooGoodScoopers services or websites you visit.
      </p>

      <h3>Links</h3>
      <p>
        This website contains links to other sites. Please be aware that we are not responsible for the content or privacy practices of such other sites. We encourage our users to be aware when they leave our site and to read the privacy statements of any other site that collects personally identifiable information.
      </p>

      <h3>Security of your Personal Information</h3>
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

      <h3>Right to Deletion</h3>
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

      <h3>Children Under Thirteen</h3>
      <p>
        DooGoodScoopers does not knowingly collect personally identifiable information from children under the age of thirteen. If you are under the age of thirteen, you must ask your parent or guardian for permission to use this website.
      </p>

      <h3>Opt-Out &amp; Unsubscribe from Third Party Communications</h3>
      <p>
        We respect your privacy and give you an opportunity to opt-out of receiving announcements of certain information. Users may opt-out of receiving any or all communications from third-party partners of DooGoodScoopers by contacting us here:
      </p>
      <ul>
        <li>Email: service@doogoodscoopers.com</li>
        <li>Phone: 909-366-3744</li>
        <li>Replying &quot;Stop&quot; to SMS messages.</li>
      </ul>

      <h3>E-mail Communications</h3>
      <p>
        From time to time, DooGoodScoopers may contact you via email for the purpose of providing announcements, promotional offers, alerts, confirmations, surveys, and/or other general communication. In order to improve our Services, we may receive a notification when you open an email from DooGoodScoopers or click on a link therein.
      </p>
      <p>
        If you would like to stop receiving marketing or promotional communications via email from DooGoodScoopers, you may opt out of such communications by clicking the &quot;Unsubscribe&quot; button.
      </p>

      <h3>SMS/Text Communications</h3>
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
        If you would like to stop receiving marketing or promotional communications via email from DooGoodScoopers, you may opt out of such communications by replying &quot;stop&quot; to the SMS message or emailing us at service@doogoodscoopers.com to be removed.
      </p>

      <h3>External Data Storage Sites</h3>
      <p>
        We may store your data on servers provided by third party hosting vendors with whom we have contracted.
      </p>

      <h3>Changes to this Statement</h3>
      <p>
        DooGoodScoopers reserves the right to change this Privacy Policy from time to time. We will notify you about significant changes in the way we treat personal information by sending a notice to the primary email address specified in your account, by placing a prominent notice on our website, and/or by updating any privacy information. Your continued use of the website and/or Services available after such modifications will constitute your: (a) acknowledgment of the modified Privacy Policy; and (b) agreement to abide and be bound by that Policy.
      </p>

      <h3>Contact Information</h3>
      <p>
        DooGoodScoopers welcomes your questions or comments regarding this Statement of Privacy. If you believe that DooGoodScoopers has not adhered to this Statement, please contact DooGoodScoopers at:
      </p>
      <p>
        <strong>DooGoodScoopers, LLC</strong><br />
        11799 Sebastian Way, Suite 103<br />
        Rancho Cucamonga, CA 91730
      </p>
      <p>
        Email Address: service@doogoodscoopers.com
      </p>
      <p>
        Telephone number: (909) 366-3744
      </p>
      <p>
        <strong>Effective as of December 1, 2024</strong>
      </p>
    </div>
  );
}
