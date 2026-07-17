/**
 * Minimal promise wrapper over IndexedDB used by the demo repository.
 * Two object stores: "state" (single JSON snapshot) and "media" (id → data URL).
 */

const DB_NAME = "gridline-studio";
const DB_VERSION = 1;
const STATE_STORE = "state";
const MEDIA_STORE = "media";
export const STATE_KEY = "workspace-v1";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
        if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    });
  }
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function idbGetState<T>(): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(STATE_STORE, "readonly");
  return requestToPromise(tx.objectStore(STATE_STORE).get(STATE_KEY) as IDBRequest<T | undefined>);
}

export async function idbPutState<T>(value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STATE_STORE, "readwrite");
  tx.objectStore(STATE_STORE).put(value, STATE_KEY);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
}

export async function idbGetMedia(id: string): Promise<string | undefined> {
  const db = await openDb();
  const tx = db.transaction(MEDIA_STORE, "readonly");
  return requestToPromise(tx.objectStore(MEDIA_STORE).get(id) as IDBRequest<string | undefined>);
}

export async function idbPutMedia(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEDIA_STORE, "readwrite");
  tx.objectStore(MEDIA_STORE).put(dataUrl, id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB media write failed"));
  });
}

export async function idbDeleteMedia(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEDIA_STORE, "readwrite");
  tx.objectStore(MEDIA_STORE).delete(id);
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function idbClearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STATE_STORE, MEDIA_STORE], "readwrite");
  tx.objectStore(STATE_STORE).clear();
  tx.objectStore(MEDIA_STORE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear failed"));
  });
}
