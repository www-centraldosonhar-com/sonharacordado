import {
  useEffect,
  useState,
} from 'react'

function formatCurrency(value) {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(Number(value || 0))
}

function formatNumber(value) {
  return Number(value || 0)
    .toFixed(2)
    .replace('.', ',')
}

function formatEventDate(value) {
  if (!value) {
    return 'Data não informada'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }
  ).format(new Date(value))
}

function projectClass(project) {
  const value = String(
    project || ''
  ).toLowerCase()

  if (value === 'aps') {
    return 'dreamer-economy-project--aps'
  }

  if (value === 'ppf') {
    return 'dreamer-economy-project--ppf'
  }

  if (value === 'sj') {
    return 'dreamer-economy-project--sj'
  }

  return ''
}

export default function DreamerEventEconomyAdminPanel() {
  const [data, setData] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState(null)

  useEffect(() => {
    let active = true

    fetch(
      '/api/dreamer?action=event-economy'
    )
      .then(async response => {
        const payload =
          await response.json()

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível carregar a Economia de Eventos.'
          )
        }

        return payload
      })
      .then(payload => {
        if (active) {
          setData(payload)
        }
      })
      .catch(fetchError => {
        if (active) {
          setError(
            fetchError.message
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <section className="dreamer-economy-admin">
        <p>
          Carregando Economia de Eventos...
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="dreamer-economy-admin">
        <div className="dreamer-economy-error">
          {error}
        </div>
      </section>
    )
  }

  const projects =
    data?.projects || []

  return (
    <section className="dreamer-economy-admin">
      <header className="dreamer-economy-header">
        <div>
          <span className="dreamer-economy-kicker">
            Olimpíada Sonhadora
          </span>

          <h2>
            Economia de Eventos
          </h2>

          <p>
            Acompanhamento automático dos
            eventos após o fechamento geral
            das despesas.
          </p>
        </div>
      </header>

      <div className="dreamer-economy-grid">
        {projects.map(project => (
          <article
            key={project.projectId}
            className={[
              'dreamer-economy-project',
              projectClass(
                project.project
              ),
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <header className="dreamer-economy-project__header">
              <div>
                <strong>
                  {project.project}
                </strong>

                <small>
                  Base oficial:{' '}
                  {project.volunteerCount}{' '}
                  voluntários
                </small>
              </div>

              <div className="dreamer-economy-project__points">
                <strong>
                  {formatNumber(
                    project.economyPoints
                  )}
                </strong>
                <small>pontos</small>
              </div>
            </header>

            <div className="dreamer-economy-summary">
              <span>
                <small>
                  Economia acumulada
                </small>
                <strong>
                  {formatCurrency(
                    project.economyAmount
                  )}
                </strong>
              </span>

              <span>
                <small>
                  Eventos calculados
                </small>
                <strong>
                  {Number(
                    project.calculatedEvents ||
                      0
                  )}
                </strong>
              </span>
            </div>

            <div className="dreamer-economy-events">
              {project.events.length ? (
                project.events.map(event => (
                  <div
                    key={event.eventId}
                    className={[
                      'dreamer-economy-event',
                      event.calculated
                        ? 'dreamer-economy-event--calculated'
                        : 'dreamer-economy-event--pending',
                    ].join(' ')}
                  >
                    <div className="dreamer-economy-event__title">
                      <div>
                        <strong>
                          {event.eventName}
                        </strong>
                        <small>
                          {formatEventDate(
                            event.eventDate
                          )}
                        </small>
                      </div>

                      <span>
                        {event.calculated
                          ? '✓ Calculado'
                          : '⏳ Aguardando fechamento'}
                      </span>
                    </div>

                    {event.calculated ? (
                      <div className="dreamer-economy-event__numbers">
                        <span>
                          <small>
                            Arrecadado
                          </small>
                          <strong>
                            {formatCurrency(
                              event.collectedAmount
                            )}
                          </strong>
                        </span>

                        <span>
                          <small>
                            Despesas
                          </small>
                          <strong>
                            {formatCurrency(
                              event.expensesAmount
                            )}
                          </strong>
                        </span>

                        <span>
                          <small>
                            Economia
                          </small>
                          <strong>
                            {formatCurrency(
                              event.economyAmount
                            )}
                          </strong>
                        </span>

                        <span>
                          <small>
                            Pontos
                          </small>
                          <strong>
                            {formatNumber(
                              event.economyPoints
                            )}
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <p className="dreamer-economy-event__pending-copy">
                        O resultado será
                        calculado automaticamente
                        quando o Pós-Evento
                        concluir o fechamento
                        geral das despesas.
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="dreamer-economy-empty">
                  Nenhum evento de projeto
                  encontrado.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
