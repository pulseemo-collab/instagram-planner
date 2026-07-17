import type { Metadata } from "next";
import { PreviewStage } from "@/components/preview/preview-stage";

export const metadata: Metadata = { title: "Profile preview" };

export default function ProfilePreviewPage() {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Instagram profile preview
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft sm:text-sm">
          A faithful recreation of the Instagram mobile profile. This screen becomes
          the canvas for grid planning, uploads, and client approvals.
        </p>
      </div>
      <PreviewStage />
    </div>
  );
}
