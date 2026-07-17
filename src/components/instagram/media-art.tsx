import type { IgPlaceholderArt } from "@/lib/instagram/types";

interface MediaArtProps {
  art: IgPlaceholderArt;
  imageUrl?: string;
  alt?: string;
  className?: string;
}

/**
 * Fills its parent with the media image, or a soft-lit gradient placeholder
 * until real uploads exist. Parent must be `position: relative`.
 */
export function MediaArt({ art, imageUrl, alt = "", className }: MediaArtProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded media, dimensions unknown ahead of time
      <img
        src={imageUrl}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover ${className ?? ""}`}
      />
    );
  }

  const angle = art.angle ?? 150;
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 ${className ?? ""}`}
      style={{
        background: `linear-gradient(${angle}deg, ${art.from} 0%, ${art.via} 52%, ${art.to} 100%)`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 85% at 22% 8%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)",
        }}
      />
    </div>
  );
}
