import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The standard admin page header — the dark "hero" banner used across every
 * section so the pages read as one system. Put page-level actions in `actions`
 * and use the exported button styles below so their text stays readable on the
 * dark background (dark-on-dark is the bug this component exists to prevent).
 */

/** Violet primary action (e.g. "Add lead", "New template"). Pair with an inline
 *  style={heroPrimaryStyle} for the fill. */
export const heroBtnPrimary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px] font-bold text-white transition-colors hover:brightness-110";
export const heroPrimaryStyle = { background: "#8B6BFF" } as const;

/** Translucent secondary action (e.g. "Templates", "Contacts", "Archive"). */
export const heroBtnSecondary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px] font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors";

export function PageHero({
  title,
  subtitle,
  badge,
  actions,
  icon,
  backHref,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small pill(s) shown inline next to the title. */
  badge?: React.ReactNode;
  /** Right-side buttons — style with heroBtnPrimary / heroBtnSecondary. */
  actions?: React.ReactNode;
  /** Optional decorative right-side icon tile. */
  icon?: React.ReactNode;
  /** Renders a back arrow linking here. */
  backHref?: string;
}) {
  return (
    <div className="dgs-hero p-[22px] sm:p-[26px] mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="p-2 rounded-[10px] bg-white/10 hover:bg-white/15 transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[30px] font-extrabold text-white tracking-[-0.03em] leading-none">{title}</h1>
              {badge}
            </div>
            {subtitle != null && <p className="text-[12.5px] text-[#9C9CB0] mt-2">{subtitle}</p>}
          </div>
        </div>
        {(actions || icon) && <div className="flex items-center gap-2 flex-shrink-0">{actions}{icon}</div>}
      </div>
    </div>
  );
}
