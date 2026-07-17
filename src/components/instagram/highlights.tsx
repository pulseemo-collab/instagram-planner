import type { IgHighlight } from "@/lib/instagram/types";
import { PlusIcon } from "./icons";
import { MediaArt } from "./media-art";

export interface HighlightsProps {
  highlights: IgHighlight[];
  /** Own-profile view appends the "New" highlight bubble. */
  showNewButton?: boolean;
}

function HighlightRing({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-[66px] items-center justify-center rounded-full border border-(--ig-highlight-ring)">
      {children}
    </span>
  );
}

export function Highlights({ highlights, showNewButton = true }: HighlightsProps) {
  return (
    <div
      className="flex gap-[14px] overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="list"
      aria-label="Story highlights"
    >
      {highlights.map((highlight) => (
        <button
          key={highlight.id}
          type="button"
          role="listitem"
          className="flex w-[66px] shrink-0 flex-col items-center gap-1"
        >
          <HighlightRing>
            <span className="relative block size-[58px] overflow-hidden rounded-full">
              <MediaArt art={highlight.cover} imageUrl={highlight.imageUrl} alt="" />
            </span>
          </HighlightRing>
          <span className="w-full truncate text-center text-[12px] leading-[15px] text-(--ig-text)">
            {highlight.label}
          </span>
        </button>
      ))}

      {showNewButton && (
        <button
          type="button"
          role="listitem"
          className="flex w-[66px] shrink-0 flex-col items-center gap-1"
          aria-label="Create new highlight"
        >
          <HighlightRing>
            <span className="flex size-[58px] items-center justify-center rounded-full text-(--ig-text)">
              <PlusIcon size={26} strokeWidth={1} />
            </span>
          </HighlightRing>
          <span className="w-full truncate text-center text-[12px] leading-[15px] text-(--ig-text)">
            New
          </span>
        </button>
      )}
    </div>
  );
}
