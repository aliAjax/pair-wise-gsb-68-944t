// localStorage / window 打桩（zustand persist、axios 在模块加载时即读取）
class MemStorage {
  map = new Map<string, string>()
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null }
  setItem(key: string, value: string) { this.map.set(key, value) }
  removeItem(key: string) { this.map.delete(key) }
  clear() { this.map.clear() }
  key(index: number) { return [...this.map.keys()][index] ?? null }
  get length() { return this.map.size }
}
const localStorage = new MemStorage()
const window = { location: { href: 'http://localhost/' }, localStorage, addEventListener() {} }
;(globalThis as unknown as { localStorage: MemStorage }).localStorage = localStorage
;(globalThis as unknown as { window: typeof window }).window = window
;(globalThis as unknown as { document: unknown }).document = { addEventListener() {} }
