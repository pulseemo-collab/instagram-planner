import { Grid3x3 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-panel">
          <Grid3x3 className="size-4.5" aria-hidden="true" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          Gridline<span className="text-ink-faint"> Studio</span>
        </span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-panel sm:p-7">
        {children}
      </div>
    </div>
  );
}
