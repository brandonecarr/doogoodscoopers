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
  type LucideIcon,
} from "lucide-react";

// Available icons for sections
const availableIcons: { name: string; icon: LucideIcon }[] = [
  { name: "credit-card", icon: CreditCard },
  { name: "calendar", icon: Calendar },
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
];

// Get icon component by name
function getIconByName(name: string): LucideIcon {
  const found = availableIcons.find((i) => i.name === name);
  return found?.icon || HelpCircle;
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
      const docSettings = data.settings?.[documentType] || { sections: [], lastUpdated: null };

      setSections(docSettings.sections || []);
      setLastUpdated(docSettings.lastUpdated || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
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
