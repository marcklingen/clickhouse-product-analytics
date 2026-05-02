type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export class MemoryStorage implements StorageLike {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

export function createStorage(mode: 'localStorage' | 'memory' | 'localStorage+cookie', disabled: boolean): StorageLike {
  if (disabled || mode === 'memory' || typeof window === 'undefined') {
    return new MemoryStorage()
  }

  const localStorage = getLocalStorage()
  if (localStorage && canWrite(localStorage)) {
    return localStorage
  }

  if (mode === 'localStorage+cookie' && typeof document !== 'undefined') {
    return cookieStorage()
  }

  return new MemoryStorage()
}

function getLocalStorage(): StorageLike | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function canWrite(storage: StorageLike): boolean {
  try {
    const key = 'cpa_storage_probe'
    storage.setItem(key, '1')
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function cookieStorage(): StorageLike {
  return {
    getItem(key) {
      const encoded = encodeURIComponent(key)
      const cookie = document.cookie
        .split('; ')
        .find((value) => value.startsWith(`${encoded}=`))
      return cookie ? decodeURIComponent(cookie.slice(encoded.length + 1)) : null
    },
    setItem(key, value) {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
    },
    removeItem(key) {
      document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
  }
}
