"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Calendar,
  CalendarX,
  Clock,
  Shield,
  HelpCircle,
  FileText,
  Lock,
  Mail,
  Phone,
  MapPin,
  User,
  Settings,
  Bell,
  Star,
  Heart,
  CheckCircle,
  AlertCircle,
  Info,
  Sparkles,
  Zap,
  Home,
  Truck,
  DollarSign,
  Percent,
  Gift,
  Award,
  Target,
  Briefcase,
  Database,
  Share2,
  Ban,
  Activity,
  Monitor,
  Cookie,
  Link2,
  Baby,
  MessageSquare,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

// Available icons for sections
const availableIcons: { name: string; icon: LucideIcon }[] = [
  { name: "credit-card", icon: CreditCard },
  { name: "calendar", icon: Calendar },
  { name: "calendar-x", icon: CalendarX },
  { name: "clock", icon: Clock },
  { name: "shield", icon: Shield },
  { name: "help-circle", icon: HelpCircle },
  { name: "file-text", icon: FileText },
  { name: "lock", icon: Lock },
  { name: "mail", icon: Mail },
  { name: "phone", icon: Phone },
  { name: "map-pin", icon: MapPin },
  { name: "user", icon: User },
  { name: "settings", icon: Settings },
  { name: "bell", icon: Bell },
  { name: "star", icon: Star },
  { name: "heart", icon: Heart },
  { name: "check-circle", icon: CheckCircle },
  { name: "alert-circle", icon: AlertCircle },
  { name: "info", icon: Info },
  { name: "sparkles", icon: Sparkles },
  { name: "zap", icon: Zap },
  { name: "home", icon: Home },
  { name: "truck", icon: Truck },
  { name: "dollar-sign", icon: DollarSign },
  { name: "percent", icon: Percent },
  { name: "gift", icon: Gift },
  { name: "award", icon: Award },
  { name: "target", icon: Target },
  { name: "briefcase", icon: Briefcase },
  { name: "database", icon: Database },
  { name: "share", icon: Share2 },
  { name: "ban", icon: Ban },
  { name: "activity", icon: Activity },
  { name: "monitor", icon: Monitor },
  { name: "cookie", icon: Cookie },
  { name: "link", icon: Link2 },
  { name: "baby", icon: Baby },
  { name: "message-square", icon: MessageSquare },
  { name: "refresh", icon: RefreshCw },
  { name: "trash", icon: Trash2 },
];

// Get icon component by name
function getIconByName(name: string): LucideIcon {
  const found = availableIcons.find((i) => i.name === name);
  return found?.icon || HelpCircle;
}

// Default Terms of Service content
const defaultTermsOfService = {
  sections: [
    {
      id: "tos-1",
      icon: "credit-card",
      title: "How do I pay?",
      content: `<p>DooGoodScoopers processes payments via our client portal. Customers link their credit/debit card to the portal, and invoices are generated and paid automatically.</p><p><strong>Please note: your card will need to be linked to your account by the time we arrive at your home for service.</strong></p>`,
    },
    {
      id: "tos-2",
      icon: "calendar",
      title: "Do you bill monthly?",
      content: `<p>We bill on the 1st of each month before service delivery. For initial and one-time cleanups, we bill upon job completion.</p><p>If you are a new customer signing up for recurring services, you will be billed at the time of sign-up for your initial cleanup. You will then be billed for the remaining portion of the month on your first regular service date.</p><p><strong>Example:</strong> A customer, let's call him John, signs up for weekly service on 1/14/2025 with a monthly rate of $80/month. John would be charged at the time of sign-up for his initial cleanup. Then, on his first regular service date, John would be billed for the remainder of January. Since his service date would fall two more times in January (on 1/22 &amp; 1/29), he would be charged $40 that day (or $20 per visit). Going forward, John would be charged $80 per month.</p><p><em>Note: if your account is unpaid, you will be removed from our service schedule until payment processes.</em></p><p><strong>Monthly service charges are non-refundable.</strong></p>`,
    },
    {
      id: "tos-3",
      icon: "clock",
      title: "What time will you be at my home?",
      content: `<p>We can't guarantee a specific time since our service days are optimized as routes. Depending on time of year, routes may run 7am to dark. Customers should expect an approximate 60 minute heads up via text when we are on the way.</p><p>If you sign up with us, and we tell you that your service day is Wednesday, it will be Wednesday every week, unless we advise you otherwise in advance.</p>`,
    },
    {
      id: "tos-4",
      icon: "calendar-x",
      title: "What Happens If my Service Day is on a Holiday?",
      content: `<p>On occasion, your service date may fall on a holiday. When this happens, we may skip service that week, and perform a double cleanup the following week. You will still be charged for the waste accumulated during this period.</p>`,
    },
    {
      id: "tos-5",
      icon: "sparkles",
      title: "Do you disinfect your equipment?",
      content: `<p>Yes! We disinfect all equipment after each and every cleanup. We use an organic, kennel grade disinfectant. This ensures that we don't pass germs from one home to the next.</p>`,
    },
    {
      id: "tos-6",
      icon: "database",
      title: "Data Usage",
      content: `<p>DooGoodScoopers retains the data collected to assess business performance and improve quality of service. By accepting these terms, DooGoodScoopers may use the data provided for advertising and/or marketing purposes.</p>`,
    },
  ],
  lastUpdated: "January 2025",
};

// Default Privacy Policy content
const defaultPrivacyPolicy = {
  sections: [
    {
      id: "pp-1",
      icon: "user",
      title: "Collection of your Personal Information",
      content: `<p>In order to better provide you with products and services offered, DooGoodScoopers may collect personally identifiable information, such as your:</p><ul><li>First and Last Name</li><li>Mailing &amp; Physical Address</li><li>E-mail Address</li><li>Phone Number</li><li>Information about your home such as gate locations, areas to be cleaned.</li><li>Information about your pets including names &amp; birthdays.</li><li>Images including but not limited to before and after photos and gate photos to display we secured it before leaving. These images will be available to you at your request. The gate photo will be sent to you immediately following your service to put your mind at ease. All images are subject to use as we see fit including but not limited to advertisements and social media.</li></ul><p>If you purchase DooGoodScoopers' products and services, we collect billing and credit card information. This information is used to complete the purchase transaction.</p><p>DooGoodScoopers may also collect anonymous demographic information, which is not unique to you, such as your:</p><ul><li>Age</li><li>Gender</li><li>Household Income</li><li>Locations</li></ul><p>Please keep in mind that if you directly disclose personally identifiable information or personally sensitive data through DooGoodScoopers' public message boards, this information may be collected and used by others.</p><p>We do not collect any personal information about you unless you voluntarily provide it to us. However, you may be required to provide certain personal information to us when you elect to use certain products or services. These may include: (a) registering for an account; (b) entering a sweepstakes or contest sponsored by us or one of our partners; (c) signing up for special offers from selected third parties; (d) sending us an email message; (e) submitting your credit card or other payment information when ordering and purchasing products and services. To wit, we will use your information for, but not limited to, communicating with you in relation to services and/or products you have requested from us. We also may gather additional personal or non-personal information in the future.</p>`,
    },
    {
      id: "pp-2",
      icon: "file-text",
      title: "Use of your Personal Information",
      content: `<p>DooGoodScoopers collects and uses your personal information to operate and deliver the services you have requested.</p><p>DooGoodScoopers may also use your personally identifiable information to inform you of other products or services available from DooGoodScoopers and its affiliates.</p>`,
    },
    {
      id: "pp-3",
      icon: "share",
      title: "Sharing Information with Third Parties",
      content: `<p>DooGoodScoopers does not sell, rent or lease its customer lists to third parties.</p><p>DooGoodScoopers may, from time to time, contact you on behalf of external business partners about a particular offering that may be of interest to you. In those cases, your unique personally identifiable information (e-mail, name, address, telephone number) is transferred to the third party. DooGoodScoopers may share data with trusted partners to help perform statistical analysis, send you email or postal mail, provide customer support, or arrange for deliveries. All such third parties are prohibited from using your personal information except to provide these services to DooGoodScoopers, and they are required to maintain the confidentiality of your information.</p><p>DooGoodScoopers may disclose your personal information, without notice, if required to do so by law or in the good faith belief that such action is necessary to: (a) conform to the edicts of the law or comply with legal process served on DooGoodScoopers or the site; (b) protect and defend the rights or property of DooGoodScoopers; and/or (c) act under exigent circumstances to protect the personal safety of users of DooGoodScoopers, or the public.</p><p>DooGoodScoopers may utilize user information on 3rd party advertising platforms such as google ads, facebook ads, or other social media sites, and marketing channels.</p><p>DooGoodScoopers may also conduct user surveys with 3rd party software with information collected.</p>`,
    },
    {
      id: "pp-4",
      icon: "ban",
      title: "Opt-Out of Disclosure of Personal Information to Third Parties",
      content: `<p>In connection with any personal information we may disclose to a third party for a business purpose, you have the right to know:</p><ul><li>The categories of personal information that we disclosed about you for a business purpose.</li></ul><p>You have the right under the California Consumer Privacy Act of 2018 (CCPA) and certain other privacy and data protection laws, as applicable, to opt-out of the disclosure of your personal information. If you exercise your right to opt-out of the disclosure of your personal information, we will refrain from disclosing your personal information, unless you subsequently provide express authorization for the disclosure of your personal information. To opt-out of the disclosure of your personal information, email <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a></p>`,
    },
    {
      id: "pp-5",
      icon: "activity",
      title: "Tracking User Behavior",
      content: `<p>DooGoodScoopers may keep track of the websites and pages our users visit within DooGoodScoopers, in order to determine what DooGoodScoopers services are the most popular. This data is used to deliver customized content and advertising within DooGoodScoopers to customers whose behavior indicates that they are interested in a particular subject area.</p>`,
    },
    {
      id: "pp-6",
      icon: "monitor",
      title: "Automatically Collected Information",
      content: `<p>Information about your computer hardware and software may be automatically collected by DooGoodScoopers. This information can include: your IP address, browser type, domain names, access times and referring website addresses. This information is used for the operation of the service, to maintain quality of the service, and to provide general statistics regarding use of the DooGoodScoopers website.</p>`,
    },
    {
      id: "pp-7",
      icon: "cookie",
      title: "Use of Cookies",
      content: `<p>The DooGoodScoopers website may use "cookies" to help you personalize your online experience. A cookie is a text file that is placed on your hard disk by a web page server. Cookies cannot be used to run programs or deliver viruses to your computer. Cookies are uniquely assigned to you, and can only be read by a web server in the domain that issued the cookie to you.</p><p>One of the primary purposes of cookies is to provide a convenience feature to save you time. The purpose of a cookie is to tell the Web server that you have returned to a specific page. For example, if you personalize DooGoodScoopers pages, or register with DooGoodScoopers site or services, a cookie helps DooGoodScoopers to recall your specific information on subsequent visits. This simplifies the process of recording your personal information, such as billing addresses, shipping addresses, and so on. When you return to the same DooGoodScoopers website, the information you previously provided can be retrieved, so you can easily use the DooGoodScoopers features that you customized.</p><p>You have the ability to accept or decline cookies. Most Web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. If you choose to decline cookies, you may not be able to fully experience the interactive features of the DooGoodScoopers services or websites you visit.</p>`,
    },
    {
      id: "pp-8",
      icon: "link",
      title: "Links",
      content: `<p>This website contains links to other sites. Please be aware that we are not responsible for the content or privacy practices of such other sites. We encourage our users to be aware when they leave our site and to read the privacy statements of any other site that collects personally identifiable information.</p>`,
    },
    {
      id: "pp-9",
      icon: "lock",
      title: "Security of your Personal Information",
      content: `<p>DooGoodScoopers secures your personal information from unauthorized access, use, or disclosure. DooGoodScoopers uses the following methods for this purpose:</p><ul><li>SSL Protocol</li></ul><p>When personal information (such as a credit card number) is transmitted to other websites, it is protected through the use of encryption, such as the Secure Sockets Layer (SSL) protocol.</p><p>We strive to take appropriate security measures to protect against unauthorized access to or alteration of your personal information. Unfortunately, no data transmission over the Internet or any wireless network can be guaranteed to be 100% secure. As a result, while we strive to protect your personal information, you acknowledge that: (a) there are security and privacy limitations inherent to the Internet which are beyond our control; and (b) security, integrity, and privacy of any and all information and data exchanged between you and us through this Site cannot be guaranteed.</p>`,
    },
    {
      id: "pp-10",
      icon: "trash",
      title: "Right to Deletion",
      content: `<p>Subject to certain exceptions set out below, on receipt of a verifiable request from you, we will:</p><ul><li>Delete your personal information from our records; and</li><li>Direct any service providers to delete your personal information from their records.</li></ul><p>Please note that we may not be able to comply with requests to delete your personal information if it is necessary to:</p><ul><li>Complete the transaction for which the personal information was collected, fulfill the terms of a written warranty or product recall conducted in accordance with federal law, provide a good or service requested by you, or reasonably anticipated within the context of our ongoing business relationship with you, or otherwise perform a contract between you and us;</li><li>Detect security incidents, protect against malicious, deceptive, fraudulent, or illegal activity; or prosecute those responsible for that activity;</li><li>Debug to identify and repair errors that impair existing intended functionality;</li><li>Exercise free speech, ensure the right of another consumer to exercise his or her right of free speech, or exercise another right provided for by law;</li><li>Comply with the California Electronic Communications Privacy Act;</li><li>Engage in public or peer-reviewed scientific, historical, or statistical research in the public interest that adheres to all other applicable ethics and privacy laws, when our deletion of the information is likely to render impossible or seriously impair the achievement of such research, provided we have obtained your informed consent;</li><li>Enable solely internal uses that are reasonably aligned with your expectations based on your relationship with us;</li><li>Comply with an existing legal obligation; or</li><li>Otherwise use your personal information, internally, in a lawful manner that is compatible with the context in which you provided the information.</li></ul>`,
    },
    {
      id: "pp-11",
      icon: "baby",
      title: "Children Under Thirteen",
      content: `<p>DooGoodScoopers does not knowingly collect personally identifiable information from children under the age of thirteen. If you are under the age of thirteen, you must ask your parent or guardian for permission to use this website.</p>`,
    },
    {
      id: "pp-12",
      icon: "bell",
      title: "Opt-Out & Unsubscribe from Third Party Communications",
      content: `<p>We respect your privacy and give you an opportunity to opt-out of receiving announcements of certain information. Users may opt-out of receiving any or all communications from third-party partners of DooGoodScoopers by contacting us here:</p><ul><li>Email: <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a></li><li>Phone: <a href="tel:909-366-3744">909-366-3744</a></li><li>Replying "Stop" to SMS messages.</li></ul>`,
    },
    {
      id: "pp-13",
      icon: "mail",
      title: "E-mail Communications",
      content: `<p>From time to time, DooGoodScoopers may contact you via email for the purpose of providing announcements, promotional offers, alerts, confirmations, surveys, and/or other general communication. In order to improve our Services, we may receive a notification when you open an email from DooGoodScoopers or click on a link therein.</p><p>If you would like to stop receiving marketing or promotional communications via email from DooGoodScoopers, you may opt out of such communications by clicking the "Unsubscribe" button.</p>`,
    },
    {
      id: "pp-14",
      icon: "message-square",
      title: "SMS/Text Communications",
      content: `<p>Users that receive a free quote on DooGoodScoopers.com and provide their phone number agree to receive calls and text messages from DooGoodScoopers, including for marketing and promotional purposes.</p><p>Users may opt out of these messages in the future by replying "stop"</p><p>From time to time, DooGoodScoopers may contact you via SMS/Text Message for the purpose of providing announcements, promotional offers, alerts, confirmations, surveys, and/or other general communication. In order to improve our Services, we may receive a notification when you open an SMS message from DooGoodScoopers or click on a link therein.</p><p>If you would like to stop receiving marketing or promotional communications via email from DooGoodScoopers, you may opt out of such communications by replying "stop" to the SMS message or emailing us at <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a> to be removed.</p>`,
    },
    {
      id: "pp-15",
      icon: "database",
      title: "External Data Storage Sites",
      content: `<p>We may store your data on servers provided by third party hosting vendors with whom we have contracted.</p>`,
    },
    {
      id: "pp-16",
      icon: "refresh",
      title: "Changes to this Statement",
      content: `<p>DooGoodScoopers reserves the right to change this Privacy Policy from time to time. We will notify you about significant changes in the way we treat personal information by sending a notice to the primary email address specified in your account, by placing a prominent notice on our website, and/or by updating any privacy information. Your continued use of the website and/or Services available after such modifications will constitute your: (a) acknowledgment of the modified Privacy Policy; and (b) agreement to abide and be bound by that Policy.</p>`,
    },
    {
      id: "pp-17",
      icon: "help-circle",
      title: "Contact Information",
      content: `<p>DooGoodScoopers welcomes your questions or comments regarding this Statement of Privacy. If you believe that DooGoodScoopers has not adhered to this Statement, please contact DooGoodScoopers at:</p><p><strong>DooGoodScoopers, LLC</strong><br>11799 Sebastian Way, Suite 103<br>Rancho Cucamonga, CA 91730</p><p>Email Address: <a href="mailto:service@doogoodscoopers.com">service@doogoodscoopers.com</a></p><p>Telephone number: <a href="tel:(909) 366-3744">(909) 366-3744</a></p><p><strong>Effective as of December 1, 2024</strong></p>`,
    },
  ],
  lastUpdated: "December 2024",
};

// Get default content based on document type
function getDefaultContent(documentType: "termsOfService" | "privacyPolicy") {
  return documentType === "termsOfService" ? defaultTermsOfService : defaultPrivacyPolicy;
}

// Section type
interface DocumentSection {
  id: string;
  icon: string;
  title: string;
  content: string;
}

// Editor toolbar component
function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive("bold") ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive("italic") ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive("underline") ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Underline"
      >
        <UnderlineIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={addLink}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive("link") ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Link"
      >
        <LinkIcon className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive("bulletList") ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive("orderedList") ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "left" }) ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Align Left"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "center" }) ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Align Center"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "right" }) ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Align Right"
      >
        <AlignRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: "justify" }) ? "bg-gray-200 text-teal-600" : "text-gray-600"}`}
        title="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </button>
    </div>
  );
}

// Section editor component
function SectionEditor({
  section,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  section: DocumentSection;
  onChange: (section: DocumentSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const IconComponent = getIconByName(section.icon);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-teal-600 underline",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: section.content,
    onUpdate: ({ editor }) => {
      onChange({ ...section, content: editor.getHTML() });
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none p-4 min-h-[120px] focus:outline-none",
      },
    },
  });

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Section Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1 text-gray-400">
          <GripVertical className="w-5 h-5 cursor-grab" />
        </div>

        {/* Icon Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100"
            title="Select Icon"
          >
            <IconComponent className="w-5 h-5 text-teal-600" />
          </button>

          {showIconPicker && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-7 gap-1 w-64">
              {availableIcons.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange({ ...section, icon: name });
                    setShowIconPicker(false);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 ${section.icon === name ? "bg-teal-100 text-teal-600" : "text-gray-600"}`}
                  title={name}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Title Input */}
        <input
          type="text"
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Section Title"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 text-sm font-medium"
        />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move Up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move Down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-red-400 hover:text-red-600"
            title="Delete Section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Editor */}
      <div>
        <EditorToolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// Props for the main component
interface LegalDocumentSetupProps {
  documentType: "termsOfService" | "privacyPolicy";
  title: string;
}

export default function LegalDocumentSetup({ documentType, title }: LegalDocumentSetupProps) {
  const [sections, setSections] = useState<DocumentSection[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/onboarding-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      const docSettings = data.settings?.[documentType];

      // If no saved settings, use default content
      if (!docSettings || !docSettings.sections || docSettings.sections.length === 0) {
        const defaults = getDefaultContent(documentType);
        setSections(defaults.sections);
        setLastUpdated(defaults.lastUpdated);
      } else {
        setSections(docSettings.sections);
        setLastUpdated(docSettings.lastUpdated || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
      // On error, still show default content
      const defaults = getDefaultContent(documentType);
      setSections(defaults.sections);
      setLastUpdated(defaults.lastUpdated);
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const now = new Date().toISOString().split("T")[0].replace(/-/g, "/");
      const payload = {
        [documentType]: {
          sections,
          lastUpdated: now,
        },
      };

      const response = await fetch("/api/admin/onboarding-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setLastUpdated(now);
      setSuccessMessage(`${title} saved successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    const newSection: DocumentSection = {
      id: crypto.randomUUID(),
      icon: "help-circle",
      title: "",
      content: "<p></p>",
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (id: string, updated: DocumentSection) => {
    setSections(sections.map((s) => (s.id === id ? updated : s)));
  };

  const deleteSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const newSections = [...sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    setSections(newSections);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700">
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {lastUpdated && (
            <p className="text-sm text-gray-500">Last updated {lastUpdated}</p>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No sections yet. Add your first section to get started.</p>
            <button
              onClick={addSection}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              Add Section
            </button>
          </div>
        ) : (
          sections.map((section, index) => (
            <SectionEditor
              key={section.id}
              section={section}
              onChange={(updated) => updateSection(section.id, updated)}
              onDelete={() => deleteSection(section.id)}
              onMoveUp={() => moveSection(section.id, "up")}
              onMoveDown={() => moveSection(section.id, "down")}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
            />
          ))
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={addSection}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
