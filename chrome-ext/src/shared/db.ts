// IndexedDB storage layer for Imagine Power Tools
// Provides per-record read/write instead of full-blob operations

import { HistoryEntry } from "./storage";

const DB_NAME = "ImaginePowerTools";
const DB_VERSION = 1;
const STORE_NAME = "postHistory";

let dbPromise: Promise<IDBDatabase> | null = null;

// Open or create the database
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store with postId as key
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "postId" });
      }
    };
  });

  return dbPromise;
}

// Record structure in IndexedDB
interface PostRecord {
  postId: string;
  entries: HistoryEntry[];
}

// Get entries for a specific post - O(1) lookup
export async function getEntries(postId: string): Promise<HistoryEntry[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(postId);

    request.onsuccess = () => {
      const record = request.result as PostRecord | undefined;
      resolve(record?.entries || []);
    };

    request.onerror = () => reject(request.error);
  });
}

// Set entries for a specific post - O(1) write
export async function setEntries(
  postId: string,
  entries: HistoryEntry[],
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    if (entries.length === 0) {
      // Delete the record if no entries remain
      const request = store.delete(postId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } else {
      const record: PostRecord = { postId, entries };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  });
}

// Get all records - for export functionality
export async function getAllRecords(): Promise<Map<string, HistoryEntry[]>> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result as PostRecord[];
      const map = new Map<string, HistoryEntry[]>();
      for (const record of records) {
        map.set(record.postId, record.entries);
      }
      resolve(map);
    };

    request.onerror = () => reject(request.error);
  });
}

// Bulk insert records - for import functionality
export async function bulkSetRecords(
  records: Map<string, HistoryEntry[]>,
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    for (const [postId, entries] of records) {
      if (entries.length > 0) {
        store.put({ postId, entries });
      }
    }
  });
}

// Clear all data
export async function clearAll(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get count of records
export async function getRecordCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
