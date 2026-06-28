import '@testing-library/jest-dom/vitest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// localStorage / sessionStorage polyfill.
//
// Node 22+ ships an experimental global `localStorage` that is only functional
// when started with `--localstorage-file=<path>`. Without a valid path it is a
// non-functional stub (`localStorage.getItem` is undefined) that SHADOWS the
// working implementation jsdom installs on `window`. That breaks any test that
// touches Web Storage. We install a deterministic in-memory implementation on
// both `globalThis` and `window` so tests behave consistently across Node
// versions.
// ---------------------------------------------------------------------------
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function installStorage(name: 'localStorage' | 'sessionStorage') {
  const storage = new MemoryStorage();
  const targets = [globalThis, typeof window !== 'undefined' ? window : undefined];
  for (const target of targets) {
    if (!target) continue;
    Object.defineProperty(target, name, {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

installStorage('localStorage');
installStorage('sessionStorage');
