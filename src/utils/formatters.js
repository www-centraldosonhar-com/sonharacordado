export function formatDateBr(value) {
  if (!value) {
    return ''
  }

  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  ).format(date)
}

export function formatTimeBr(value) {
  if (!value) {
    return ''
  }

  return String(value).slice(0, 5)
}

export function formatDateTimeBr(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date)
}
