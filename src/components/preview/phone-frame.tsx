import type { IgTheme } from "@/lib/instagram/types";
import type { ReactNode } from "react";

interface PhoneFrameProps {
  theme: IgTheme;
  children: ReactNode;
}

/**
 * iPhone-style device shell: bezel, status bar, home indicator. Purely
 * presentational — the screen content is whatever gets passed as children.
 */
export function PhoneFrame({ theme, children }: PhoneFrameProps) {
  const dark = theme === "dark";
  const chrome = dark ? "#f5f5f5" : "#000000";

  return (
    <div className="w-[393px] max-w-full rounded-[54px] bg-[#0c0c0c] p-[10px] shadow-[0_24px_60px_-24px_rgba(33,30,26,0.5)]">
      <div
        className="relative flex h-[790px] flex-col overflow-hidden rounded-[44px]"
        style={{ backgroundColor: dark ? "#000000" : "#ffffff" }}
      >
        {/* Status bar */}
        <div
          className="ig-root flex h-[46px] shrink-0 items-end justify-between px-8 pb-1.5"
          style={{ color: chrome }}
        >
          <span className="w-12 text-[15px] font-semibold leading-none">9:41</span>
          {/* Dynamic island */}
          <span className="absolute left-1/2 top-3 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-[#0c0c0c]" />
          <span className="flex items-center gap-1.5" aria-hidden="true">
            {/* Signal */}
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
              <rect x="0" y="7" width="3" height="4" rx="0.8" />
              <rect x="4.5" y="5" width="3" height="6" rx="0.8" />
              <rect x="9" y="2.5" width="3" height="8.5" rx="0.8" />
              <rect x="13.5" y="0" width="3" height="11" rx="0.8" />
            </svg>
            {/* Wi-Fi */}
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
              <path d="M8 9.2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM8 5.4c1.6 0 3.05.6 4.15 1.6l-1.4 1.45A4.1 4.1 0 0 0 8 7.4c-1.05 0-2 .4-2.75 1.05L3.85 7C4.95 6 6.4 5.4 8 5.4ZM8 1.5c2.7 0 5.15 1.05 6.95 2.75L13.5 5.7A8.03 8.03 0 0 0 8 3.5c-2.1 0-4.05.85-5.5 2.2L1.05 4.25A10.03 10.03 0 0 1 8 1.5Z" transform="translate(0,-1.5)" />
            </svg>
            {/* Battery */}
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.4" />
              <rect x="2" y="2" width="18" height="8" rx="1.8" fill="currentColor" />
              <path d="M23 4v4c1-.35 1.7-1.05 1.7-2S24 4.35 23 4Z" fill="currentColor" opacity="0.4" />
            </svg>
          </span>
        </div>

        {/* Screen content */}
        <div className="min-h-0 flex-1">{children}</div>

        {/* Home indicator */}
        <div className="flex h-[24px] shrink-0 items-center justify-center" style={{ backgroundColor: dark ? "#000000" : "#ffffff" }}>
          <span
            className="h-[5px] w-[130px] rounded-full"
            style={{ backgroundColor: chrome, opacity: dark ? 0.9 : 1 }}
          />
        </div>
      </div>
    </div>
  );
}
