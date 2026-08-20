import {
  useEffect,
  useState,
} from 'react'


function getStatusLabel(status) {
  const labels = {
    pending: '⏳ Pendente',
    submitted: '📨 Enviado',
    approved: '✅ Aprovado',
  }

  return labels[status] || status
}


function AdminPostEventTeamReports({
  events = [],
  access,
}) {
  const defaultEvent =
    events.find(
      (event) =>
        event.event_status === 'post_event'
    ) ||
    events[0] ||
    null

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState(
    defaultEvent
      ? String(defaultEvent.id)
      : ''
  )

  const [
    reports,
    setReports,
  ] = useState([])

  const [
    reportAccess,
    setReportAccess,
  ] = useState(null)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)


  const isManagement =
    access?.scope === 'global' ||
    access?.scope === 'project'


  // =====================================================
  // LOAD REPORTS
  // =====================================================

  useEffect(() => {
    if (!selectedEventId) {
      return
    }

    let active = true

    async function loadReports() {
      try {
        const params =
          new URLSearchParams({
            action: 'post-event',
            operation: 'team-reports',
            eventId: selectedEventId,
          })

        const response =
          await fetch(
            `/api/admin?${params}`
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar os relatórios.'
          )
        }

        if (!active) {
          return
        }

        setReports(
          result.reports || []
        )

        setReportAccess(
          result.access || null
        )

        setMessage('')
      } catch (error) {
        if (active) {
          setMessage(
            error.message
          )
        }
      }
    }

    loadReports()

    return () => {
      active = false
    }
  }, [selectedEventId])


  async function reloadReports() {
    const params =
      new URLSearchParams({
        action: 'post-event',
        operation: 'team-reports',
        eventId: selectedEventId,
      })

    const response =
      await fetch(
        `/api/admin?${params}`
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível atualizar os relatórios.'
      )
    }

    setReports(
      result.reports || []
    )

    setReportAccess(
      result.access || null
    )
  }


  // =====================================================
  // SUBMIT / UPDATE REPORT
  // =====================================================

  async function handleSubmit(
    event,
    report
  ) {
    event.preventDefault()

    const form =
      new FormData(
        event.currentTarget
      )

    setIsLoading(true)
    setMessage('')

    try {
      const response =
        await fetch(
          '/api/admin?action=post-event',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation:
                'submit-team-report',

              eventId:
                Number(
                  selectedEventId
                ),

              teamId:
                Number(
                  report.team_id
                ),

              summary:
                form.get('summary'),

              whatWorked:
                form.get(
                  'whatWorked'
                ),

              whatToImprove:
                form.get(
                  'whatToImprove'
                ),

              nextEventNotes:
                form.get(
                  'nextEventNotes'
                ),
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível enviar o relatório.'
        )
      }

      setMessage(
        result.message
      )

      await reloadReports()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  // =====================================================
  // APPROVE REPORT
  // =====================================================

  async function handleApprove(
    report
  ) {
    const confirmed =
      window.confirm(
        `Aprovar o relatório da equipe "${report.team_name}"?\n\nDepois da aprovação ele ficará bloqueado para edição.`
      )

    if (!confirmed) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response =
        await fetch(
          '/api/admin?action=post-event',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation:
                'approve-team-report',

              eventId:
                Number(
                  selectedEventId
                ),

              reportId:
                Number(
                  report.id
                ),
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível aprovar o relatório.'
        )
      }

      setMessage(
        result.message
      )

      await reloadReports()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  if (events.length === 0) {
    return null
  }


  return (
    <section
      id="relatorios-equipes"
      className="admin-section post-event-team-reports"
    >
      <p className="admin-eyebrow">
        APRENDER COM CADA EVENTO
      </p>

      <h2>
        🤝 Relatórios das Equipes
      </h2>

      <p className="post-event-team-intro">
        Um espaço para registrar aprendizados
        e deixar o próximo evento ainda melhor.
      </p>


      <div className="post-event-team-event-select">
        <label htmlFor="post-event-team-event">
          Evento
        </label>

        <select
          id="post-event-team-event"
          value={selectedEventId}
          onChange={(event) =>
            setSelectedEventId(
              event.target.value
            )
          }
        >
          {events.map(
            (event) => (
              <option
                key={event.id}
                value={event.id}
              >
                {event.name}
              </option>
            )
          )}
        </select>
      </div>


      {message && (
        <p className="post-event-message">
          {message}
        </p>
      )}


      <div className="post-event-report-grid">
        {reports.map(
          (report) => {
            const approved =
              report.status ===
              'approved'

            const canEdit =
              reportAccess?.canSubmit &&
              !approved

            return (
              <article
                className="post-event-report-card"
                key={report.id}
              >
                <header className="post-event-report-header">
                  <div>
                    <strong>
                      {report.team_name}
                    </strong>

                    <span>
                      {getStatusLabel(
                        report.status
                      )}
                    </span>
                  </div>
                </header>


                {canEdit ? (
                  <form
                    onSubmit={(event) =>
                      handleSubmit(
                        event,
                        report
                      )
                    }
                  >
                    <label>
                      Resumo do evento
                    </label>

                    <textarea
                      name="summary"
                      defaultValue={
                        report.summary || ''
                      }
                      placeholder="Como foi a atuação da equipe?"
                      required
                    />


                    <label>
                      ✨ O que funcionou bem?
                    </label>

                    <textarea
                      name="whatWorked"
                      defaultValue={
                        report.what_worked ||
                        ''
                      }
                      placeholder="O que vale repetir?"
                    />


                    <label>
                      💡 O que podemos melhorar?
                    </label>

                    <textarea
                      name="whatToImprove"
                      defaultValue={
                        report.what_to_improve ||
                        ''
                      }
                      placeholder="O que pode ser melhor no próximo?"
                    />


                    <label>
                      🚀 Para o próximo evento
                    </label>

                    <textarea
                      name="nextEventNotes"
                      defaultValue={
                        report.next_event_notes ||
                        ''
                      }
                      placeholder="Ideias, cuidados ou próximos passos..."
                    />


                    <button
                      type="submit"
                      disabled={isLoading}
                    >
                      {report.status ===
                      'submitted'
                        ? '💾 Atualizar relatório'
                        : '📨 Enviar relatório'}
                    </button>
                  </form>
                ) : (
                  <div className="post-event-report-content">
                    <div>
                      <small>
                        RESUMO
                      </small>

                      <p>
                        {report.summary ||
                          'Ainda não enviado.'}
                      </p>
                    </div>


                    {report.what_worked && (
                      <div>
                        <small>
                          ✨ FUNCIONOU BEM
                        </small>

                        <p>
                          {report.what_worked}
                        </p>
                      </div>
                    )}


                    {report.what_to_improve && (
                      <div>
                        <small>
                          💡 PODE MELHORAR
                        </small>

                        <p>
                          {report.what_to_improve}
                        </p>
                      </div>
                    )}


                    {report.next_event_notes && (
                      <div>
                        <small>
                          🚀 PRÓXIMO EVENTO
                        </small>

                        <p>
                          {report.next_event_notes}
                        </p>
                      </div>
                    )}


                    {report.submitted_by_name && (
                      <span className="post-event-report-author">
                        Enviado por{' '}
                        {report.submitted_by_name}
                      </span>
                    )}
                  </div>
                )}


                {isManagement &&
                  report.status ===
                    'submitted' && (
                    <button
                      type="button"
                      className="post-event-approve-button"
                      disabled={isLoading}
                      onClick={() =>
                        handleApprove(
                          report
                        )
                      }
                    >
                      ✅ Aprovar relatório
                    </button>
                  )}
              </article>
            )
          }
        )}
      </div>


      {reports.length === 0 && (
        <p className="post-event-empty">
          Nenhum relatório de equipe
          disponível para este evento.
        </p>
      )}
    </section>
  )
}


export default AdminPostEventTeamReports
