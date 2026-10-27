/**
 * Cross-tab change notifications for demo mode (the demo stand-in for
 * Supabase Realtime). One BroadcastChannel per tab: a channel never receives
 * its own messages, so listeners only hear writes made in OTHER tabs.
 * Listeners run in registration order — the demo repository registers first
 * (when it is constructed), so its cache is dropped before UI listeners
 * reload the workspace.
 */

const CHANNEL_NAME = "gridline-workspace";

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => {
        for (const listener of [...listeners]) listener();
      };
    } catch {
      channel = null; // unsupported — refresh-on-focus still covers it
    }
  }
  return channel;
}

/** Tell other tabs that the stored workspace changed. */
export function announceWorkspaceChange(): void {
  try {
    getChannel()?.postMessage("changed");
  } catch {
    // channel closed — other tabs catch up on focus
  }
}

/** Run `listener` whenever another tab persists a change. Returns unsubscribe. */
export function onWorkspaceChange(listener: () => void): () => void {
  listeners.add(listener);
  getChannel();
  return () => {
    listeners.delete(listener);
  };
}
