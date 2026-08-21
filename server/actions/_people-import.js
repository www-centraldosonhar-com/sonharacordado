/*
 * Helpers para importação de pessoas.
 *
 * IMPORTANTE:
 * - full_name = nome cadastral completo.
 * - name = nome usado pela Central/login.
 * - project continua obrigatório.
 * - Nenhuma lógica existente de login é alterada.
 */

export function normalizeFullName(value) {
  const lowercaseWords =
    new Set([
      'da',
      'das',
      'de',
      'do',
      'dos',
      'e',
    ])

  const normalized =
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('pt-BR')

  return normalized
    .split(' ')
    .map((word, index) => {
      if (
        index > 0 &&
        lowercaseWords.has(word)
      ) {
        return word
      }

      return word
        .split('-')
        .map((part) => {
          if (!part) {
            return part
          }

          return (
            part.charAt(0)
              .toLocaleUpperCase('pt-BR') +
            part.slice(1)
          )
        })
        .join('-')
    })
    .join(' ')
}

/*
 * Exemplo:
 * "Mariana de Souza Ferreira"
 *              ↓
 * "Mariana Ferreira"
 */
export function createCentralName(fullName) {
  const normalized =
    normalizeFullName(fullName)

  const parts =
    normalized.split(' ').filter(Boolean)

  if (parts.length < 2) {
    return normalized
  }

  return `${parts[0]} ${parts.at(-1)}`
}

/*
 * Quando dois usuários resultarem no mesmo
 * "Nome + Sobrenome", usamos uma inicial
 * intermediária como sugestão.
 *
 * João Pedro Silva → João P Silva
 */
export function createAlternativeCentralName(
  fullName
) {
  const normalized =
    normalizeFullName(fullName)

  const parts =
    normalized.split(' ').filter(Boolean)

  if (parts.length < 3) {
    return createCentralName(normalized)
  }

  return [
    parts[0],
    `${parts[1][0].toUpperCase()}`,
    parts.at(-1),
  ].join(' ')
}

export function normalizeProject(value) {
  const normalized =
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()

  /*
   * Primeiro tenta encontrar a sigla explícita.
   */
  const acronymMatch =
    normalized.match(
      /\b(APS|PPF|SJ)\b/
    )

  if (acronymMatch) {
    return acronymMatch[1]
  }


  /*
   * Depois reconhece nomes e apelidos
   * usados nos Forms/Sheets.
   */
  if (
    normalized.includes(
      'AMIGOS PARA SEMPRE'
    )
  ) {
    return 'APS'
  }

  if (
    normalized.includes(
      'PREPARANDO PARA O FUTURO'
    )
  ) {
    return 'PPF'
  }

  if (
    normalized.includes(
      'SONHANDO JUNTOS'
    ) ||
    normalized.includes(
      'SONHANDO'
    )
  ) {
    return 'SJ'
  }


  return normalized
}

export function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function normalizePhone(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .trim()
}


export function normalizeBirthDate(value) {
  const raw =
    String(value || '').trim()

  if (!raw) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  const match =
    raw.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    )

  if (!match) {
    return raw
  }

  const [, day, month, year] =
    match

  return [
    year,
    month.padStart(2, '0'),
    day.padStart(2, '0'),
  ].join('-')
}


// ============================================================
// USERNAME — IDENTIDADE DA CENTRAL
// ============================================================

export function normalizeUsername(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .replace(/^[._]+|[._]+$/g, '')
}


/*
 * Gera o username-base usando:
 *
 * primeiro nome + último sobrenome
 *
 * João Pedro da Silva
 * -> joaosilva
 *
 * Mariana de Souza Ferreira
 * -> marianaferreira
 *
 * O @ NÃO é salvo no banco.
 * Ele é apenas apresentado na interface.
 */
export function createUsernameBase(fullName) {
  const normalizedName =
    normalizeFullName(fullName)

  const parts =
    normalizedName
      .split(' ')
      .filter(Boolean)

  if (!parts.length) {
    return ''
  }

  const firstName =
    parts[0]

  const lastName =
    parts.length > 1
      ? parts.at(-1)
      : ''

  return normalizeUsername(
    `${firstName}${lastName}`
  )
}


/*
 * Resolve colisões:
 *
 * joaosilva
 * joaosilva2
 * joaosilva3
 */
export function createUniqueUsername(
  fullName,
  existingUsernames = []
) {
  const used =
    new Set(
      existingUsernames
        .map(normalizeUsername)
        .filter(Boolean)
    )

  let base =
    createUsernameBase(fullName)

  /*
   * Fallback raro para cadastro sem nome utilizável.
   */
  if (!base) {
    base = 'voluntario'
  }

  if (!used.has(base)) {
    return base
  }

  let suffix = 2

  while (
    used.has(
      `${base}${suffix}`
    )
  ) {
    suffix += 1
  }

  return `${base}${suffix}`
}
