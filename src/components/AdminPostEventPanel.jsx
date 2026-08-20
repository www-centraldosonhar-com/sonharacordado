import {
  useEffect,
  useState,
} from 'react'


// =========================================================
// FORMAT CURRENCY
// =========================================================

function formatCurrency(value) {
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


// =========================================================
// STATUS LABEL
// =========================================================

function statusLabel(status) {
  const labels = {
    scheduled:
      '📅 Evento programado',

    post_event:
      '🌙 Pós-Evento aberto',

    closed:
      '✅ Pós-Evento concluído',

    open:
      '🟡 Em andamento',

    review:
      '🔎 Em revisão',

    pending:
      '⏳ Pendente',

    submitted:
      '📨 Enviado',

    approved:
      '✅ Aprovado',
  }

  return (
    labels[status] ||
    status ||
    'Sem status'
  )
}


function AdminPostEventPanel({
  events = [],
  onUpdated,
}) {
  const defaultEvent =
    events.find(
      (event) =>
        event.event_status ===
        'post_event'
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
    summary,
    setSummary,
  ] = useState(null)

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState('')


  // =====================================================
  // LOAD SUMMARY
  // =====================================================

  useEffect(() => {
    if (!selectedEventId) {
      return
    }

    let active = true

    const params =
      new URLSearchParams({
        action:
          'post-event',

        operation:
          'summary',

        eventId:
          selectedEventId,
      })

    fetch(
      `/api/admin?${params}`
    )
      .then(
        async (response) => {
          const result =
            await response.json()

          if (!response.ok) {
            throw new Error(
              result.error ||
              'Não foi possível carregar o Pós-Evento.'
            )
          }

          if (active) {
            setSummary(
              result
            )
          }
        }
      )
      .catch(
        (error) => {
          if (active) {
            setSummary(null)

            setMessage(
              error.message
            )
          }
        }
      )
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [selectedEventId])


  // =====================================================
  // RELOAD CURRENT SUMMARY
  // =====================================================

  async function reloadSummary() {
    if (!selectedEventId) {
      return
    }

    const params =
      new URLSearchParams({
        action:
          'post-event',

        operation:
          'summary',

        eventId:
          selectedEventId,
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
        'Não foi possível atualizar o Pós-Evento.'
      )
    }

    setSummary(
      result
    )
  }


  // =====================================================
  // OPEN POST EVENT
  // =====================================================

  async function openPostEvent() {
    const event =
      events.find(
        (candidate) =>
          Number(candidate.id) ===
          Number(selectedEventId)
      )

    if (!event) {
      return
    }

    const confirmed =
      window.confirm(
        `Iniciar o Pós-Evento de "${event.name}"?\n\nAs inscrições serão encerradas e o evento deixará de ficar ativo.`
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
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                operation:
                  'open',

                eventId:
                  Number(
                    selectedEventId
                  ),
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível iniciar o Pós-Evento.'
        )
      }

      setMessage(
        result.message ||
        'Pós-Evento iniciado! 🌙'
      )

      if (onUpdated) {
        await onUpdated()
      }

      await reloadSummary()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  // =====================================================
  // CLOSE EXPENSES
  // =====================================================

  async function closeExpenses() {
    if (!selectedEventId) {
      return
    }

    const confirmed =
      window.confirm(
        'Finalizar os gastos deste evento?\n\nDepois disso, novos lançamentos e cancelamentos ficarão bloqueados e os valores serão enviados oficialmente ao Financeiro.'
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

            body:
              JSON.stringify({
                operation:
                  'close-expenses',

                eventId:
                  Number(
                    selectedEventId
                  ),
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível finalizar os gastos.'
        )
      }

      setMessage(
        result.message ||
        'Fechamento de gastos concluído! 💰🔒'
      )

      await reloadSummary()

      if (onUpdated) {
        await onUpdated()
      }
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  // =====================================================
  // EMPTY
  // =====================================================

  if (events.length === 0) {
    return null
  }


  const attendance =
    summary?.attendance || {}

  const financial =
    summary?.financial || {}

  const teamReports =
    summary?.teamReports || []

  const currentStatus =
    summary?.event
      ?.event_status || null

  const canOpen =
    currentStatus &&
    currentStatus !==
      'post_event' &&
    currentStatus !==
      'closed'


  return (
    <section
      id="pos-evento"
      className="admin-section post-event-panel"
    >
      <div className="post-event-heading">
        <div>
          <p className="admin-eyebrow">
            DEPOIS QUE O SONHO ACONTECE
          </p>

          <h2>
            🌙 Pós-Evento
          </h2>

          <p>
            Presença, financeiro,
            equipes e resultados finais
            do evento em um só lugar.
          </p>
        </div>

        {summary?.event && (
          <span className="post-event-status">
            {statusLabel(
              currentStatus
            )}
          </span>
        )}
      </div>


      <div className="post-event-selector">
        <label>
          Evento
        </label>

        <select
          value={
            selectedEventId
          }
          onChange={
            (event) =>
              setSelectedEventId(
                event.target.value
              )
          }
        >
          {events.map(
            (event) => (
              <option
                key={
                  event.id
                }
                value={
                  event.id
                }
              >
                {event.name}
              </option>
            )
          )}
        </select>

        {canOpen && (
          <button
            type="button"
            className="post-event-open-button"
            disabled={
              isLoading
            }
            onClick={
              openPostEvent
            }
          >
            🌙 Iniciar Pós-Evento
          </button>
        )}
      </div>


      {message && (
        <p className="post-event-message">
          {message}
        </p>
      )}


      {isLoading &&
      !summary ? (
        <div className="post-event-loading">
          Carregando Pós-Evento...
        </div>
      ) : summary ? (
        <>
          {/* ============================================= */}
          {/* ATTENDANCE */}
          {/* ============================================= */}

          <div className="post-event-block">
            <div className="post-event-block-title">
              <div>
                <span>
                  👥
                </span>

                <div>
                  <small>
                    PARTICIPAÇÃO
                  </small>

                  <strong>
                    Presença no evento
                  </strong>
                </div>
              </div>

              <b>
                {
                  attendance
                    .attendanceRate ||
                  0
                }%
              </b>
            </div>

            <div className="post-event-metrics">
              <article>
                <strong>
                  {
                    attendance
                      .registeredCount ||
                    0
                  }
                </strong>

                <span>
                  Inscritos
                </span>
              </article>

              <article>
                <strong>
                  {
                    attendance
                      .presentCount ||
                    0
                  }
                </strong>

                <span>
                  Presentes
                </span>
              </article>

              <article>
                <strong>
                  {
                    attendance
                      .absentCount ||
                    0
                  }
                </strong>

                <span>
                  Ausentes
                </span>
              </article>
            </div>
          </div>


          {/* ============================================= */}
          {/* FINANCIAL */}
          {/* ============================================= */}

          <div className="post-event-block">
            <div className="post-event-block-title">
              <div>
                <span>
                  💰
                </span>

                <div>
                  <small>
                    BALANÇO
                  </small>

                  <strong>
                    Financeiro do evento
                  </strong>
                </div>
              </div>

              <b
                className={
                  Number(
                    financial
                      .balanceAmount ||
                    0
                  ) >= 0
                    ? 'post-event-balance-positive'
                    : 'post-event-balance-negative'
                }
              >
                {formatCurrency(
                  financial
                    .balanceAmount
                )}
              </b>
            </div>

            <div className="post-event-finance-grid">
              <article>
                <span>
                  💳 Pagantes
                </span>

                <strong>
                  {
                    financial
                      .paidCount ||
                    0
                  }
                </strong>
              </article>

              <article>
                <span>
                  🎟️ Gratuidade
                </span>

                <strong>
                  {
                    financial
                      .freeCount ||
                    0
                  }
                </strong>
              </article>

              <article>
                <span>
                  💚 Arrecadado
                </span>

                <strong>
                  {formatCurrency(
                    financial
                      .collectedAmount
                  )}
                </strong>
              </article>

              <article>
                <span>
                  🧾 Gastos
                </span>

                <strong>
                  {formatCurrency(
                    financial
                      .expensesAmount
                  )}
                </strong>
              </article>
            </div>

            <div className="post-event-final-balance">
              <span>
                Saldo final
              </span>

              <strong>
                {formatCurrency(
                  financial
                    .balanceAmount
                )}
              </strong>
            </div>


            {financial
              .expensesByTeam
              ?.length > 0 && (
              <div className="post-event-team-expenses">
                <h4>
                  Gastos por equipe
                </h4>

                {financial
                  .expensesByTeam
                  .map(
                    (team) => (
                      <div
                        key={
                          team.team_id
                        }
                      >
                        <span>
                          {
                            team.team_name
                          }
                        </span>

                        <strong>
                          {formatCurrency(
                            team.amount
                          )}
                        </strong>
                      </div>
                    )
                  )}
              </div>
            )}

            <div className="post-event-expense-closing">
              {Number(
                summary?.closure
                  ?.expenses_closed || 0
              ) === 1 ? (
                <>
                  <div>
                    <strong>
                      ✅ Gastos finalizados
                    </strong>

                    <span>
                      Os gastos deste evento foram
                      enviados oficialmente ao
                      Financeiro e estão bloqueados
                      para alterações.
                    </span>
                  </div>

                  {summary?.closure
                    ?.expenses_closed_at && (
                    <small>
                      Fechado em{' '}
                      {new Date(
                        summary.closure
                          .expenses_closed_at
                      ).toLocaleString(
                        'pt-BR'
                      )}
                    </small>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <strong>
                      💰 Fechamento de gastos
                    </strong>

                    <span>
                      Confira os lançamentos e
                      comprovantes das equipes
                      antes de finalizar.
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={closeExpenses}
                  >
                    🔒 Finalizar e enviar ao Financeiro
                  </button>
                </>
              )}
            </div>
          </div>


          {/* ============================================= */}
          {/* TEAMS */}
          {/* ============================================= */}

          <div className="post-event-block">
            <div className="post-event-block-title">
              <div>
                <span>
                  🤝
                </span>

                <div>
                  <small>
                    EQUIPES
                  </small>

                  <strong>
                    Fechamentos
                  </strong>
                </div>
              </div>

              <b>
                {
                  teamReports.filter(
                    (report) =>
                      report.status ===
                      'approved'
                  ).length
                }
                {' / '}
                {
                  teamReports.length
                }
              </b>
            </div>

            {teamReports.length === 0 ? (
              <p className="post-event-empty">
                Nenhuma equipe precisa de
                fechamento neste evento.
              </p>
            ) : (
              <div className="post-event-team-list">
                {teamReports.map(
                  (report) => (
                    <div
                      key={
                        report.id
                      }
                    >
                      <span>
                        {
                          report.team_name
                        }
                      </span>

                      <strong>
                        {statusLabel(
                          report.status
                        )}
                      </strong>
                    </div>
                  )
                )}
              </div>
            )}
          </div>


          {/* ============================================= */}
          {/* FEEDBACK */}
          {/* ============================================= */}

          <div className="post-event-feedback-summary">
            <span>
              ⭐ Avaliação do evento
            </span>

            <strong>
              {
                summary.feedback
                  ?.total > 0
                  ? `${summary.feedback.average.toFixed(1)} / 5`
                  : 'Ainda sem avaliações'
              }
            </strong>

            {summary.feedback
              ?.total > 0 && (
              <small>
                {
                  summary.feedback
                    .total
                } avaliações
              </small>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}

export default AdminPostEventPanel
