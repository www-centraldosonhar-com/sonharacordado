import {
  useEffect,
  useMemo,
  useState,
} from 'react'

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

function formatEventTime(value) {
  if (!value) {
    return null
  }

  return String(value).slice(0, 5)
}

function getProjectClass(project) {
  const normalized = String(
    project || ''
  ).toLowerCase()

  if (normalized === 'aps') {
    return 'dreamer-admin-event--aps'
  }

  if (normalized === 'ppf') {
    return 'dreamer-admin-event--ppf'
  }

  if (normalized === 'sj') {
    return 'dreamer-admin-event--sj'
  }

  return 'dreamer-admin-event--general'
}

function DreamerAttendanceAdminPanel() {
  const [data, setData] =
    useState(null)
  const [loading, setLoading] =
    useState(true)
  const [busyEventId, setBusyEventId] =
    useState(null)
  const [message, setMessage] =
    useState(null)

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=frequency')
      .then(async response => {
        const payload =
          await response.json()

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível carregar a frequência.'
          )
        }

        return payload
      })
      .then(payload => {
        if (active) {
          setData(payload)
        }
      })
      .catch(error => {
        if (active) {
          setMessage({
            type: 'error',
            text: error.message,
          })
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

  const events = useMemo(
    () => data?.availableEvents || [],
    [data?.availableEvents]
  )

  const upcomingEvents = useMemo(
    () =>
      events
        .filter(event => event.canSelect)
        .sort(
          (a, b) =>
            new Date(a.eventDate) -
            new Date(b.eventDate)
        ),
    [events]
  )

  const historicalEvents = useMemo(
    () =>
      events.filter(
        event => !event.canSelect
      ),
    [events]
  )

  const selectedCount =
    events.filter(
      event => event.selected
    ).length

  async function toggleEvent(event) {
    if (busyEventId) {
      return
    }

    const nextActive =
      !event.selected

    if (
      nextActive &&
      !event.canSelect
    ) {
      setMessage({
        type: 'error',
        text:
          'Eventos anteriores ao início da contagem não podem ser adicionados.',
      })
      return
    }

    setBusyEventId(event.id)
    setMessage(null)

    try {
      const response = await fetch(
        '/api/dreamer?action=frequency',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            operation: 'set-event',
            eventId: event.id,
            active: nextActive,
          }),
        }
      )

      const payload =
        await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível atualizar o evento.'
        )
      }

      setData(payload)
      setMessage({
        type: 'success',
        text: nextActive
          ? `${event.name} foi selecionado para a frequência da Olimpíada.`
          : `${event.name} foi removido da seleção da frequência da Olimpíada.`,
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message,
      })
    } finally {
      setBusyEventId(null)
    }
  }

  function renderEvent(event) {
    const time =
      formatEventTime(event.eventTime)

    return (
      <article
        className={`dreamer-admin-event ${getProjectClass(event.project)}`}
        key={event.id}
      >
        <div className="dreamer-admin-event__content">
          <div className="dreamer-admin-event__meta">
            <span>
              {event.project || 'GERAL'}
            </span>
            <span>•</span>
            <span>
              {formatEventDate(
                event.eventDate
              )}
              {time ? ` • ${time}` : ''}
            </span>
          </div>

          <h4>{event.name}</h4>

          <p>
            {event.selected
              ? event.canSelect
                ? 'Pré-selecionado. Passará a contar automaticamente depois do evento.'
                : 'Selecionado e já elegível para o cálculo oficial.'
              : event.canSelect
                ? 'Disponível para entrar na frequência oficial.'
                : 'Histórico anterior ao início da contagem.'}
          </p>
        </div>

        <button
          type="button"
          className={`dreamer-event-toggle${event.selected ? ' is-selected' : ''}`}
          onClick={() =>
            toggleEvent(event)
          }
          disabled={
            busyEventId === event.id ||
            (!event.selected &&
              !event.canSelect)
          }
          aria-pressed={event.selected}
        >
          {busyEventId === event.id
            ? 'Salvando…'
            : event.selected
              ? 'Selecionado'
              : 'Selecionar'}
        </button>
      </article>
    )
  }

  if (loading) {
    return (
      <section className="dreamer-admin-card">
        <p className="dreamer-admin-loading">
          Organizando os eventos da Olimpíada… ✨
        </p>
      </section>
    )
  }

  return (
    <section className="dreamer-admin-card">
      <header className="dreamer-admin-heading">
        <div>
          <span className="dreamer-eyebrow">
            ADMIN SÓCIO SONHADOR
          </span>
          <h2>Frequência da Olimpíada</h2>
          <p>
            Escolha antecipadamente os eventos que farão parte da média oficial. O cálculo só começa depois que cada evento acontecer.
          </p>
        </div>

        <div className="dreamer-admin-summary">
          <strong>{selectedCount}</strong>
          <span>
            {selectedCount === 1
              ? 'evento selecionado'
              : 'eventos selecionados'}
          </span>
        </div>
      </header>

      <div className="dreamer-frequency-status-grid">
        <div>
          <span>Já calculados</span>
          <strong>
            {data?.frequency?.eventCount || 0}
          </strong>
        </div>
        <div>
          <span>APS</span>
          <strong>52</strong>
        </div>
        <div>
          <span>PPF</span>
          <strong>42</strong>
        </div>
        <div>
          <span>SJ</span>
          <strong>26</strong>
        </div>
      </div>

      {message ? (
        <div
          className={`dreamer-admin-message dreamer-admin-message--${message.type}`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      <div className="dreamer-admin-section-title">
        <div>
          <h3>Próximos eventos</h3>
          <p>
            Somente eventos desta fase em diante podem ser adicionados.
          </p>
        </div>
      </div>

      <div className="dreamer-admin-events">
        {upcomingEvents.length > 0
          ? upcomingEvents.map(
              renderEvent
            )
          : (
            <p className="dreamer-admin-empty">
              Nenhum próximo evento disponível no momento.
            </p>
          )}
      </div>

      {historicalEvents.length > 0 ? (
        <details className="dreamer-admin-history">
          <summary>
            Ver histórico anterior ({historicalEvents.length})
          </summary>

          <div className="dreamer-admin-events dreamer-admin-events--history">
            {historicalEvents.map(
              renderEvent
            )}
          </div>
        </details>
      ) : null}
    </section>
  )
}

export default DreamerAttendanceAdminPanel
