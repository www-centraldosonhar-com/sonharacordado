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


function AdminActivitiesOverview({
  events = [],
}) {
  if (events.length === 0) {
    return null
  }

  return (
    <section
      id="controle-atividades"
      className="admin-section"
    >
      <p className="admin-eyebrow admin-orange">
        EQUIPE DE ATIVIDADES
      </p>

      <h2>
        🎨 Inscritos nos eventos
      </h2>

      <p className="admin-form-help">
        Visão simples de quem escolheu a
        Equipe de Atividades na inscrição.
      </p>

      <div className="activities-overview-list">
        {events.map((event) => {
          const registrations =
            Array.isArray(
              event.registrations
            )
              ? event.registrations
              : []

          return (
            <details
              key={event.event_id}
              className="activities-overview-card"
            >
              <summary>
                <div className="activities-overview-event">
                  <div>
                    <strong>
                      {event.event_name}
                    </strong>

                    <small>
                      {event.project_name}
                      {' · '}
                      {formatDate(
                        event.event_date
                      )}
                    </small>
                  </div>

                  <span>
                    🎨{' '}
                    {
                      event.registered_count
                    }{' '}
                    inscrito
                    {Number(
                      event.registered_count
                    ) !== 1
                      ? 's'
                      : ''}
                  </span>
                </div>
              </summary>

              {registrations.length > 0 ? (
                <div className="activities-people-list">
                  {registrations.map(
                    (registration) => (
                      <div
                        key={
                          registration.registration_id
                        }
                        className="activities-person-row"
                      >
                        <span>
                          🎨
                        </span>

                        <div>
                          <strong>
                            {
                              registration.name
                            }
                          </strong>

                          {registration.email && (
                            <small>
                              {
                                registration.email
                              }
                            </small>
                          )}
                        </div>

                        <span className="activities-confirmed">
                          ✅ Confirmado
                        </span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="activities-empty">
                  Nenhum voluntário de
                  Atividades confirmado neste
                  evento.
                </div>
              )}
            </details>
          )
        })}
      </div>
    </section>
  )
}

export default AdminActivitiesOverview
