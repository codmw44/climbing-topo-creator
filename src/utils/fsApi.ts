/**
 * File System Access API — desktop folder integration.
 *
 * Lets the user pick a folder on their local filesystem.
 * The handle is persisted in IndexedDB so it survives page reloads.
 * (Browser requires re-grant of permission after restart, but the
 *  handle itself is remembered.)
 */

// ── Feature detection ─────────────────────────────────────────────────────────

export function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ── IndexedDB persistence ─────────────────────────────────────────────────────

const DB_NAME = 'beta-creator-fs';
const STORE   = 'handles';
const DIR_KEY  = 'projectDir';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function persistDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function loadPersistedDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(DIR_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearPersistedHandle(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Permission helpers ────────────────────────────────────────────────────────

/** Returns true if the handle has (or can obtain) readwrite permission. */
export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  // @ts-expect-error — queryPermission is in the spec but TS types lag
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return true;
  // @ts-expect-error
  const requested = await handle.requestPermission({ mode: 'readwrite' });
  return requested === 'granted';
}

// ── File I/O ──────────────────────────────────────────────────────────────────

export async function writeTextToDir(
  dir: FileSystemDirectoryHandle,
  filename: string,
  text: string,
): Promise<void> {
  const fh = await dir.getFileHandle(filename, { create: true });
  const w  = await fh.createWritable();
  await w.write(text);
  await w.close();
}

export async function writeBlobToDir(
  dir: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<void> {
  const fh = await dir.getFileHandle(filename, { create: true });
  const w  = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

export async function readFileFromDir(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<File | null> {
  try {
    const fh = await dir.getFileHandle(filename);
    return fh.getFile();
  } catch {
    return null;
  }
}

/** Returns sorted list of filenames with the given extension. */
export async function listFilesInDir(
  dir: FileSystemDirectoryHandle,
  ext: string,
): Promise<string[]> {
  const names: string[] = [];
  // @ts-expect-error — AsyncIterable iteration not in TS DOM types yet
  for await (const entry of dir.values()) {
    if (entry.kind === 'file' && entry.name.endsWith(ext)) names.push(entry.name);
  }
  return names.sort();
}
