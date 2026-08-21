/*
 * Regra oficial de acesso da Central do Sonhar.
 *
 * PIN:
 * - exatamente 4 caracteres;
 * - somente números;
 * - tratado como string para permitir PINs como "0123".
 */

export function normalizePin(value) {
  return String(value ?? '').trim()
}

export function isValidPin(value) {
  return /^\d{4}$/.test(
    normalizePin(value)
  )
}
