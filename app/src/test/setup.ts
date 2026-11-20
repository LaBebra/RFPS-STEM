import '@testing-library/jest-dom/vitest';

/**
 * Node.js 25+ має власний експериментальний глобальний localStorage, який без
 * прапорця --localstorage-file недоступний і перекриває реалізацію jsdom.
 * Для тестів підставляємо просте сховище в памʼяті з інтерфейсом Web Storage.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let usable = false;
  try {
    usable = typeof globalThis[name]?.setItem === 'function';
  } catch {
    usable = false;
  }
  if (!usable) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true });
  }
}
