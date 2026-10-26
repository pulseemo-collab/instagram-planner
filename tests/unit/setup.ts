/*
 * Browser APIs the demo repository uses, for Node:
 * - IndexedDB: fake-indexeddb (tests swap in a fresh factory per test).
 * - FileReader / Image: minimal stand-ins (data URL read, image "decode").
 * - BroadcastChannel: an in-process stand-in that holds no OS handles, so
 *   test workers exit cleanly.
 */
import "fake-indexeddb/auto";

class TestFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null =
    null;

  readAsDataURL(blob: Blob): void {
    blob.arrayBuffer().then(
      (buffer) => {
        this.onprogress?.({ lengthComputable: true, loaded: buffer.byteLength, total: buffer.byteLength });
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onload?.();
      },
      (error: Error) => {
        this.error = error;
        this.onerror?.();
      },
    );
  }
}

class TestImage {
  naturalWidth = 1080;
  naturalHeight = 1350;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class TestBroadcastChannel {
  private static channels = new Map<string, Set<TestBroadcastChannel>>();
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(readonly name: string) {
    const peers = TestBroadcastChannel.channels.get(name) ?? new Set();
    peers.add(this);
    TestBroadcastChannel.channels.set(name, peers);
  }

  postMessage(data: unknown): void {
    for (const peer of TestBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer !== this) queueMicrotask(() => peer.onmessage?.({ data }));
    }
  }

  close(): void {
    TestBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

const g = globalThis as Record<string, unknown>;
g.FileReader ??= TestFileReader;
g.Image ??= TestImage;
g.BroadcastChannel = TestBroadcastChannel;
