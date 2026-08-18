// =========================================================
// DATE / TIME FORMATTERS
// =========================================================
// Formatação visual da Central.
//
// Exemplos:
// 2026-08-18T00:00:00.000Z -> 18/08/2026
// 2026-08-18              -> 18/08/2026
// 15:00:00                -> 15:00
// datetime                 -> 18/08/2026 às 15:00
//
// Para datas puras vindas do PostgreSQL, evitamos conversão
// de timezone para não correr o risco de mudar o dia.
// =========================================================

export function formatDateBr(value) {
  if (!value) {
    return ''
  }

  const raw =
    String(value)

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    )

  if (!match) {
    return raw
  }

  const [
    ,
    year,
    month,
    day,
  ] = match

  return `${day}/${month}/${year}`
}

export function formatTimeBr(value) {
  if (!value) {
    return ''
  }

  const raw =
    String(value)

  const match =
    raw.match(
      /(?:T|\s)?(\d{2}):(\d{2})/
    )

  if (!match) {
    return raw
  }

  const [
    ,
    hour,
    minute,
  ] = match

  return `${hour}:${minute}`
}

export function formatDateTimeBr(value) {
  if (!value) {
    return ''
  }

  const raw =
    String(value)

  const dateMatch =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    )

  const timeMatch =
    raw.match(
      /(?:T|\s)(\d{2}):(\d{2})/
    )

  if (
    !dateMatch ||
    !timeMatch
  ) {
    return raw
  }

  const [
    ,
    year,
    month,
    day,
  ] = dateMatch

  const [
    ,
    hour,
    minute,
  ] = timeMatch

  return (
    `${day}/${month}/${year}` +
    ` às ${hour}:${minute}`
  )
}
