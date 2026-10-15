"use client";

import type { DragEvent, ReactNode } from "react";
import {
  Type, AlignLeft, Image as ImageIcon, Video, MousePointerClick, Braces, BadgeCheck, Share2, Code2, Minus, ShoppingBag, Menu, Space, GripHorizontal, Bookmark,
} from "lucide-react";
import { type BlockType, type BrandLibrary, BLOCK_LABEL } from "@/lib/email-designer/model";
import { SECTION_PRESETS } from "@/lib/email-designer/presets";

/* Content tab: draggable blocks, prebuilt sections, and (phase 2) saved sections. */

export type RailTab = "blocks" | "sections" | "saved";

const BLOCK_ICONS: Record<BlockType, ReactNode> = {
  title: <Type className="w-6 h-6" />, text: <AlignLeft className="w-6 h-6" />, image: <ImageIcon className="w-6 h-6" />, video: <Video className="w-6 h-6" />,
  button: <MousePointerClick className="w-6 h-6" />, dynamic: <Braces className="w-6 h-6" />, logo: <BadgeCheck className="w-6 h-6" />, social: <Share2 className="w-6 h-6" />,
  html: <Code2 className="w-6 h-6" />, divider: <Minus className="w-6 h-6" />, product: <ShoppingBag className="w-6 h-6" />, navigation: <Menu className="w-6 h-6" />, spacer: <Space className="w-6 h-6" />,
};
const ORDER: BlockType[] = ["title", "text", "image", "video", "button", "dynamic", "logo", "social", "html", "divider", "product", "navigation", "spacer"];

export function ContentRail({ tab, setTab, brand, onDragStart, onDragEnd, onAddBlock, onAddSection }: {
  tab: RailTab; setTab: (t: RailTab) => void; brand: BrandLibrary;
  onDragStart: (e: DragEvent, payload: { newBlock?: BlockType; newSection?: string }) => void; onDragEnd: () => void;
  onAddBlock: (type: BlockType) => void; onAddSection: (key: string) => void;
}) {
  void brand;
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-5 px-4 border-b border-gray-100">
        {(["blocks", "sections", "saved"] as RailTab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`py-3 text-[14px] font-medium border-b-2 -mb-px capitalize ${tab === t ? "border-violet-600 text-navy-900" : "border-transparent text-gray-500 hover:text-navy-900"}`}>{t}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "blocks" && (
          <div className="grid grid-cols-3 gap-3">
            {ORDER.map((type) => (
              <button key={type} type="button" draggable title={`Drag onto the email, or click to add at the end`}
                onDragStart={(e) => onDragStart(e, { newBlock: type })} onDragEnd={onDragEnd} onClick={() => onAddBlock(type)}
                className="group flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-gray-200 bg-white hover:border-violet-400 hover:shadow-sm cursor-grab active:cursor-grabbing text-gray-700">
                <GripHorizontal className="w-3.5 h-3.5 text-gray-300 -mb-1 group-hover:text-violet-400" />
                <span className="text-teal-700">{BLOCK_ICONS[type]}</span>
                <span className="text-[12px] font-medium">{BLOCK_LABEL[type]}</span>
              </button>
            ))}
          </div>
        )}
        {tab === "sections" && (
          <div className="space-y-2">
            {SECTION_PRESETS.map((p) => (
              <button key={p.key} type="button" draggable title="Drag onto the email, or click to add at the end"
                onDragStart={(e) => onDragStart(e, { newSection: p.key })} onDragEnd={onDragEnd} onClick={() => onAddSection(p.key)}
                className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white hover:border-violet-400 hover:shadow-sm cursor-grab active:cursor-grabbing">
                <p className="text-[13px] font-semibold text-navy-900 flex items-center gap-2"><GripHorizontal className="w-3.5 h-3.5 text-gray-300" /> {p.label}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">{p.hint}</p>
              </button>
            ))}
          </div>
        )}
        {tab === "saved" && (
          <div className="text-center py-10 text-gray-400">
            <Bookmark className="w-8 h-8 mx-auto mb-2" />
            <p className="text-[13px]">Saved sections arrive in phase 2.</p>
            <p className="text-[12px] mt-1">You&apos;ll be able to save any section here and reuse it in other emails.</p>
          </div>
        )}
      </div>
    </div>
  );
}
