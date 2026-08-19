function formatMoney(value) {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(
    Number(value || 0)
  )
}


function formatDate(value) {
  if (!value) {
    return ''
  }

  const date =
    new Date(
      `${String(value).slice(0, 10)}T12:00:00`
    )

  return new Intl.DateTimeFormat(
    'pt-BR'
  ).format(date)
}


function AdminVolunteerOverview({
  events = [],
}) {
  if (events.length === 0) {
    return null
  }

  return (
    <section
      id="controle-voluntarios"
      className="admin-section"
    >
      <p className="admin-eyebrow admin-orange">
        EQUIPE DE VOLUNTÁRIOS
      </p>

      <h2>
        🙋 Controle dos eventos
      </h2>

      <p className="admin-form-help">
        Inscrições, presença e arrecadação
        organizadas por projeto e evento.
      </p>

      <div className="volunteer-overview-list">
        {events.map((event) => {
          const total =
            Number(
              event.total_volunteers || 0
            )

          const registered =
            Number(
              event.registered_count || 0
            )

          const present =
            Number(
              event.present_count || 0
            )

          const notRegistered =
            Math.max(
              0,
              total - registered
            )

          const absent =
            Math.max(
              0,
              registered - present
            )

          const eventDate =
            new Date(
              `${String(
                event.event_date
              ).slice(0, 10)}T23:59:59`
            )

          const eventFinished =
            eventDate < new Date()

          const showAttendance =
            eventFinished ||
            Boolean(
              event.has_checklist
            )

          return (
            <article
              key={event.event_id}
              className="volunteer-overview-card"
            >
              <header className="volunteer-overview-header">
                <div>
                  <h3>
                    {event.event_name}
                  </h3>

                  <small>
                    {event.project_name}
                    {' · '}
                    {formatDate(
                      event.event_date
                    )}
                  </small>
                </div>

                <strong className="volunteer-overview-money">
                  💰{' '}
                  {formatMoney(
                    event.collected_amount
                  )}
                </strong>
              </header>

              <div className="volunteer-overview-stats">
                <div>
                  <strong>
                    {total}
                  </strong>

                  <span>
                    voluntários
                  </span>
                </div>

                <div>
                  <strong>
                    {registered}
                  </strong>

                  <span>
                    inscritos
                  </span>
                </div>

                <div>
                  <strong>
                    {notRegistered}
                  </strong>

                  <span>
                    não inscritos
                  </span>
                </div>

                <div>
                  <strong>
                    {showAttendance
                      ? present
                      : '—'}
                  </strong>

                  <span>
                    presentes
                  </span>
                </div>

                <div>
                  <strong>
                    {showAttendance
                      ? absent
                      : '—'}
                  </strong>

                  <span>
                    faltaram
                  </span>
                </div>
              </div>

              {!showAttendance && (
                <small className="volunteer-overview-note">
                  ☑️ Presença será calculada
                  pelo check-in no dia do evento.
                </small>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}


export default AdminVolunteerOverview
