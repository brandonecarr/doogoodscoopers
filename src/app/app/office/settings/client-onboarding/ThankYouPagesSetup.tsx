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
} from "lucide-react";

// Type definitions for thank you page settings
interface ThankYouPageSettings {
  checkPayment: string;
  creditCard: string;
  oneTimeCleanup: string;
}

const defaultSettings: ThankYouPageSettings = {
  checkPayment: `<p><strong>Thank You for Signing Up</strong></p>
<p>We have just sent you an email confirmation and login information to our client portal. We will also contact you to confirm your information and schedule a start date!</p>
<p><strong>Payment Details:</strong></p>
<ul>
<li>You have chosen to pay by check for your services.</li>
<li>Payment is required for the initial cleanup on completion. Your technician can collect a check at time of cleanup. If you will not be home, please leave a check for the larger amount of the Estimated Initial Cleanup (please see your confirmation email for estimate).</li>
<li>For regular services, we will email your recurring invoices according to your billing option and cycle, payment is due according to NET terms on your account.</li>
<li>If you would like to switch to auto pay, please just enter you credit card details within your client portal.</li>
</ul>
<p>If at any time, you have questions about your service, please contact us via email or phone.</p>
<p>Thank you.</p>`,
  creditCard: `<p><strong>Thank You For Signing Up</strong></p>
<p>We have just sent you an email confirmation and login information to our client portal. We will also contact you to confirm your information and schedule a start date!</p>
<p><strong>Payment Details:</strong></p>
<ul>
<li>You have enrolled in our subscription payment option.</li>
<li>By far, the easiest way to pay for services.</li>
<li>Your card will be charged after the completion of the initial cleanup.</li>
<li>We will send you invoices according to your billing option and billing cycle and your card will be auto-debited according to NET terms on your account.</li>
</ul>
<p>If at any time, you have questions about your service or would like to change your card information or cancel monthly service, please contact us via client portal, email or phone.</p>
<p>Thank you.</p>`,
  oneTimeCleanup: `<p><strong>Thank you for Requesting a One Time Cleanup</strong></p>
<p>We have just sent you an email confirmation and login information to our client portal. We will also contact you to confirm your information and schedule your cleanup.</p>
<p>Thank you.</p>`,
};

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
    <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
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

// Rich text editor component wrapper
function RichTextEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
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
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none",
      },
    },
  });

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

// Individual section component
function ThankYouPageSection({
  title,
  content,
  onChange,
  onSave,
  onReset,
  saving,
  defaultContent,
}: {
  title: string;
  content: string;
  onChange: (html: string) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  defaultContent: string;
}) {
  const hasChanges = content !== defaultContent;

  return (
    <section className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Thank You Page Content
          </label>
          <RichTextEditor content={content} onChange={onChange} />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={onSave}
            disabled={saving}
            className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {hasChanges && (
            <button
              onClick={onReset}
              className="text-teal-600 text-sm font-medium hover:text-teal-700"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ThankYouPagesSetup() {
  const [settings, setSettings] = useState<ThankYouPageSettings>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<ThankYouPageSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
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
      const thankYouSettings = data.settings?.thankYouPages || defaultSettings;

      setSettings(thankYouSettings);
      setOriginalSettings(thankYouSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSection = async (section: keyof ThankYouPageSettings) => {
    const sectionNames: Record<keyof ThankYouPageSettings, string> = {
      checkPayment: "Check Payment",
      creditCard: "Credit Card",
      oneTimeCleanup: "One Time Cleanup",
    };

    setSaving(section);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/onboarding-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thankYouPages: settings }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setOriginalSettings({ ...settings });
      setSuccessMessage(`${sectionNames[section]} page saved successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(null);
    }
  };

  const resetSection = (section: keyof ThankYouPageSettings) => {
    setSettings((prev) => ({
      ...prev,
      [section]: defaultSettings[section],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      <ThankYouPageSection
        title="Thank You Page - Check Payment Sign Up"
        content={settings.checkPayment}
        onChange={(html) => setSettings((prev) => ({ ...prev, checkPayment: html }))}
        onSave={() => saveSection("checkPayment")}
        onReset={() => resetSection("checkPayment")}
        saving={saving === "checkPayment"}
        defaultContent={originalSettings.checkPayment}
      />

      <ThankYouPageSection
        title="Thank You Page - Credit Card Sign Up"
        content={settings.creditCard}
        onChange={(html) => setSettings((prev) => ({ ...prev, creditCard: html }))}
        onSave={() => saveSection("creditCard")}
        onReset={() => resetSection("creditCard")}
        saving={saving === "creditCard"}
        defaultContent={originalSettings.creditCard}
      />

      <ThankYouPageSection
        title="Thank You Page - One Time Clean Up"
        content={settings.oneTimeCleanup}
        onChange={(html) => setSettings((prev) => ({ ...prev, oneTimeCleanup: html }))}
        onSave={() => saveSection("oneTimeCleanup")}
        onReset={() => resetSection("oneTimeCleanup")}
        saving={saving === "oneTimeCleanup"}
        defaultContent={originalSettings.oneTimeCleanup}
      />
    </div>
  );
}
