export function uuidv7Like(now = Date.now()): string {
  const unixTsMs = BigInt(now)
  const rand = randomBytes(10)
  const bytes = new Uint8Array(16)

  bytes[0] = Number((unixTsMs >> 40n) & 0xffn)
  bytes[1] = Number((unixTsMs >> 32n) & 0xffn)
  bytes[2] = Number((unixTsMs >> 24n) & 0xffn)
  bytes[3] = Number((unixTsMs >> 16n) & 0xffn)
  bytes[4] = Number((unixTsMs >> 8n) & 0xffn)
  bytes[5] = Number(unixTsMs & 0xffn)
  bytes[6] = (rand[0] & 0x0f) | 0x70
  bytes[7] = rand[1]
  bytes[8] = (rand[2] & 0x3f) | 0x80
  bytes[9] = rand[3]
  bytes.set(rand.slice(4, 10), 10)

  return hex(bytes.slice(0, 4)) + '-' +
    hex(bytes.slice(4, 6)) + '-' +
    hex(bytes.slice(6, 8)) + '-' +
    hex(bytes.slice(8, 10)) + '-' +
    hex(bytes.slice(10, 16))
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
    return bytes
  }
  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }
  return bytes
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
