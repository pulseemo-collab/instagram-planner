export interface ProfileActionsProps {
  /** Own-profile view shows Edit/Share; kept as props for later view modes. */
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function ProfileActions({
  primaryLabel = "Edit profile",
  secondaryLabel = "Share profile",
}: ProfileActionsProps) {
  return (
    <div className="flex gap-2 px-4 pb-4 pt-3">
      <button
        type="button"
        className="h-8 flex-1 rounded-lg bg-(--ig-button) text-[14px] font-semibold text-(--ig-button-text) active:opacity-70"
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        className="h-8 flex-1 rounded-lg bg-(--ig-button) text-[14px] font-semibold text-(--ig-button-text) active:opacity-70"
      >
        {secondaryLabel}
      </button>
    </div>
  );
}
