export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') {
    return value
  }
  Object.freeze(value)
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key]
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child)
    }
  }
  return value
}

export function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
