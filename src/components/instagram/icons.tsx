import type { SVGProps } from "react";

/**
 * Hand-drawn glyphs approximating the Instagram mobile app's icon set.
 * All icons render at 24x24 by default, inherit `currentColor`, and accept
 * standard SVG props so callers can size and color them freely.
 */

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    ...props,
  };
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ThreadsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.7" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M15.7 8.3v4.5a2.75 2.75 0 0 0 5.5 0V12a9.2 9.2 0 1 0-3.6 7.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CreateIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.2v7.6M8.2 12h7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M3.5 6h17M3.5 12h17M3.5 18h17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.2 3v18M14.8 3v18M3 9.2h18M3 14.8h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ReelsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="4.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8.1h18M9 3.2 12.5 8M15 3.2 18.4 8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M10.3 11.9c0-.86.94-1.4 1.68-.96l3.6 2.13c.73.43.73 1.49 0 1.92l-3.6 2.13c-.74.44-1.68-.1-1.68-.96v-4.26Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RepostIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M16.6 3.5 20 6.9l-3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 13.5V11a4.1 4.1 0 0 1 4.1-4.1H20M7.4 20.5 4 17.1l3.4-3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 10.5V13a4.1 4.1 0 0 1-4.1 4.1H4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TagPersonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M10.2 3.2a2 2 0 0 1 3.6 0l1 2.1h3.7a2.5 2.5 0 0 1 2.5 2.5v10.7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5V7.8a2.5 2.5 0 0 1 2.5-2.5h3.7l1-2.1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11.2" r="2.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.8 18c.75-2.1 2.3-3.2 4.2-3.2s3.45 1.1 4.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function HomeIcon({ active, ...props }: IconProps & { active?: boolean }) {
  if (active) {
    return (
      <svg {...base(props)}>
        <path
          d="M12 2.4 2.6 9.8a1 1 0 0 0-.38.78V20.7a1 1 0 0 0 1 1h6.06v-6.4h5.44v6.4h6.06a1 1 0 0 0 1-1V10.58a1 1 0 0 0-.38-.78L12 2.4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg {...base(props)}>
      <path
        d="M12 2.4 2.6 9.8a1 1 0 0 0-.38.78V20.7a1 1 0 0 0 1 1h6.06v-6.4h5.44v6.4h6.06a1 1 0 0 0 1-1V10.58a1 1 0 0 0-.38-.78L12 2.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10.8" cy="10.8" r="7.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.2 16.2 4.8 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function VerifiedIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polygon
        points="22,12 20.11,14.18 20.66,17 17.94,17.94 17,20.66 14.18,20.11 12,22 9.83,20.11 7,20.66 6.06,17.94 3.34,17 3.89,14.17 2,12 3.89,9.83 3.34,7 6.06,6.06 7,3.34 9.83,3.89 12,2 14.17,3.89 17,3.34 17.94,6.06 20.66,7 20.11,9.83"
        fill="#0095f6"
      />
      <path
        d="m7.9 12.3 2.7 2.7 5.5-5.6"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M10.2 13.8a4 4 0 0 0 5.66 0l3.2-3.2a4 4 0 1 0-5.66-5.66l-1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M13.8 10.2a4 4 0 0 0-5.66 0l-3.2 3.2a4 4 0 1 0 5.66 5.66l1.2-1.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* --- Grid overlay glyphs (rendered filled white on media) ---------------- */

export function PinFilledIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M14.9 2.6a1 1 0 0 1 1.4 0l5.1 5.1a1 1 0 0 1-.5 1.68l-2.9.6-3.1 3.1-.3 4.3a1 1 0 0 1-1.7.63l-3.5-3.5-5.2 5.2a1 1 0 0 1-1.4-1.4l5.2-5.2-3.5-3.5a1 1 0 0 1 .63-1.7l4.3-.3 3.1-3.1.6-2.9a1 1 0 0 1 .27-.51Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CarouselFilledIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8.5" y="2.5" width="13" height="13" rx="3" fill="currentColor" />
      <path
        d="M5.2 6.2v9.3a3.3 3.3 0 0 0 3.3 3.3h9.3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function ReelsFilledIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.9" y="2.9" width="18.2" height="18.2" rx="4.6" stroke="currentColor" strokeWidth="2" />
      <path d="M3.2 8.2h17.6M9 3.3 12.4 8.1M15 3.3 18.4 8.1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M10.3 11.9c0-.86.94-1.4 1.68-.96l3.6 2.13c.73.43.73 1.49 0 1.92l-3.6 2.13c-.74.44-1.68-.1-1.68-.96v-4.26Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlayFilledIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 4.6c0-1.2 1.3-1.94 2.33-1.33l12.1 6.98a1.54 1.54 0 0 1 0 2.66l-12.1 6.98A1.54 1.54 0 0 1 6.5 18.56V4.6Z" fill="currentColor" />
    </svg>
  );
}

/* --- Post-detail action glyphs ------------------------------------------- */

export function HeartIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 20.6 4.3 13a5.3 5.3 0 0 1 0-7.5 5.2 5.2 0 0 1 7.4 0l.3.32.3-.32a5.2 5.2 0 0 1 7.4 0 5.3 5.3 0 0 1 0 7.5L12 20.6Z"
        fill={filled ? "#ff3040" : "none"}
        stroke={filled ? "#ff3040" : "currentColor"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 2.8a9.2 9.2 0 0 1 0 18.4c-1.55 0-3.02-.38-4.3-1.06L3 21.2l1.12-4.5A9.2 9.2 0 0 1 12 2.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M21.3 3.3 9.7 13.6M21.3 3.3 14 21.3l-4.3-7.7L2 9.9l19.3-6.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M5.5 3.5h13v17.4l-6.5-4.7-6.5 4.7V3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="m15 5-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EllipsisIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
