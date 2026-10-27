"use client";

import { useId, useMemo, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { FileImage, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { searchWorkspace, type SearchResult } from "@/lib/search";
import { useWorkspace } from "@/lib/store/hooks";

interface GlobalSearchProps {
  inputRef: RefObject<HTMLInputElement | null>;
  /** Keyboard-shortcut hint shown inside the field (desktop). */
  shortcutHint?: string;
  autoFocus?: boolean;
  /** Called after a result is opened, or on Escape in an empty field. */
  onDone?: () => void;
  className?: string;
  inputClassName?: string;
  listClassName?: string;
}

/**
 * Search over the already-loaded workspace (clients and posts), as an ARIA
 * combobox: type to filter, ↑/↓ to move, Enter to open, Escape to clear/close.
 */
export function GlobalSearch({
  inputRef,
  shortcutHint,
  autoFocus,
  onDone,
  className,
  inputClassName,
  listClassName,
}: GlobalSearchProps) {
  const router = useRouter();
  const { snapshot } = useWorkspace();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => (snapshot ? searchWorkspace(snapshot, query) : { clients: [], posts: [] }),
    [snapshot, query],
  );
  const flat = [...results.clients, ...results.posts];
  const open = focused && query.trim().length > 0;
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0));

  function openResult(result: SearchResult | undefined) {
    if (!result) return;
    setQuery("");
    setActive(0);
    inputRef.current?.blur();
    router.push(result.href);
    onDone?.();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && flat.length) {
      event.preventDefault();
      setActive((activeIndex + 1) % flat.length);
    } else if (event.key === "ArrowUp" && flat.length) {
      event.preventDefault();
      setActive((activeIndex - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openResult(flat[activeIndex]);
    } else if (event.key === "Escape") {
      if (query) {
        setQuery("");
      } else {
        inputRef.current?.blur();
        onDone?.();
      }
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;

  function renderGroup(label: string, items: SearchResult[], offset: number) {
    if (!items.length) return null;
    const Icon = label === "Clients" ? UserRound : FileImage;
    const headingId = `${listId}-${label}`;
    return (
      <div role="group" aria-labelledby={headingId}>
        <div
          id={headingId}
          className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint"
        >
          {label}
        </div>
        {items.map((item, i) => {
          const index = offset + i;
          return (
            <div
              key={`${item.kind}-${item.id}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              // Keep focus in the field so the click lands before blur closes the list.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openResult(item)}
              onMouseMove={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 px-3 py-2",
                index === activeIndex && "bg-panel-raised",
              )}
            >
              <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{item.title}</span>
                <span className="block truncate text-[11.5px] text-ink-faint">{item.subtitle}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search clients and posts"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && flat.length ? optionId(activeIndex) : undefined}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="Search clients, posts…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-9 w-full rounded-lg border border-line bg-panel pl-9 text-[13px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none",
          shortcutHint ? "pr-14" : "pr-3",
          inputClassName,
        )}
      />
      {shortcutHint && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-panel-raised px-1.5 font-mono text-[10px] text-ink-faint"
        >
          {shortcutHint}
        </kbd>
      )}

      {/* Always in the DOM (the input's aria-controls points at the listbox), hidden when closed. */}
      <div
        hidden={!open}
        className={cn(
          "absolute z-40 mt-1.5 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-panel py-1 shadow-panel-hover",
          listClassName,
        )}
      >
          <div id={listId} role="listbox" aria-label="Search results">
            {renderGroup("Clients", results.clients, 0)}
            {renderGroup("Posts", results.posts, results.clients.length)}
          </div>
          {open && !flat.length && (
            <p role="status" className="px-3 py-3 text-[12.5px] text-ink-faint">
              No matches for “{query.trim()}”
            </p>
          )}
      </div>
    </div>
  );
}
