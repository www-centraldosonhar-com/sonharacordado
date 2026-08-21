import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(crypto.scrypt)

/*
 * Gera hashes compatíveis com o formato Werkzeug
 * já utilizado pela Central.
 */
export async function createWerkzeugHash(password) {
  const salt = crypto
    .randomBytes(8)
    .toString('hex')

  const n = 32768
  const r = 8
  const p = 1

  const key = await scryptAsync(
    String(password),
    salt,
    64,
    {
      N: n,
      r,
      p,
      maxmem: 132 * n * r * p,
    }
  )

  return (
    `scrypt:${n}:${r}:${p}` +
    `$${salt}` +
    `$${key.toString('hex')}`
  )
}
