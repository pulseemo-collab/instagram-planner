/**
 * Where to go after signing in, from an untrusted `?next=` value. Only a
 * same-origin path is accepted (e.g. "/clients/abc?tab=posts"); anything that
 * could leave the site — "https://evil.example", "//evil.example",
 * "/\evil.example", "javascript:…" — falls back to `fallback`.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  try {
    // Resolve against a placeholder origin: a value that still escapes it
    // (after the browser's own URL parsing rules) is rejected.
    const base = "https://gridline.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
