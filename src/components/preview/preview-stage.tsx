"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { mockProfile } from "@/lib/instagram/mock-profile";
import type { IgTheme } from "@/lib/instagram/types";
import { InstagramProfile } from "@/components/instagram/instagram-profile";
import { PhoneFrame } from "./phone-frame";

const themes: Array<{ id: IgTheme; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

export function PreviewStage() {
  const [theme, setTheme] = useState<IgTheme>("light");

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        role="radiogroup"
        aria-label="Preview theme"
        className="flex rounded-lg border border-line bg-panel p-1 shadow-panel"
      >
        {themes.map((option) => {
          const active = option.id === theme;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                active ? "bg-ink text-panel" : "text-ink-soft hover:text-ink",
              )}
            >
              <option.icon className="size-3.5" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>

      <PhoneFrame theme={theme}>
        <InstagramProfile profile={mockProfile} theme={theme} />
      </PhoneFrame>
    </div>
  );
}
