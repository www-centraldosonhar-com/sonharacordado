import PostEventFinancialReview from './PostEventFinancialReview'
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
    showFeedbackComments,
    setShowFeedbackComments,
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

  const selectedEvent =
    events.find(
      item =>
        Number(item.id) ===
        Number(selectedEventId)
    ) || null

  const postEventAvailable =
    (() => {
      if (!selectedEvent?.event_date) {
        return false
      }

      const today =
        new Date()

      today.setHours(
        0,
        0,
        0,
        0
      )

      const eventDateValue =
        String(
          selectedEvent.event_date
        ).slice(
          0,
          10
        )

      const eventDate =
        new Date(
          `${eventDateValue}T00:00:00`
        )

      return (
        !Number.isNaN(
          eventDate.getTime()
        ) &&
        eventDate <= today
      )
    })()


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
  // CLOSE POST EVENT
  // =====================================================

  async function closePostEvent() {
    if (!selectedEventId) {
      return
    }

    const confirmed =
      window.confirm(
        'Encerrar definitivamente este Pós-Evento?\n\nA prestação financeira ficará congelada. As avaliações dos voluntários continuarão disponíveis para quem teve check-in.'
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
                  'close-post-event',

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
          'Não foi possível encerrar o Pós-Evento.'
        )
      }

      setMessage(
        result.message ||
        'Pós-Evento encerrado. ✅'
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


  // =========================================================
  // PÓS-EVENTO 2.0 — PROGRESSO DE ENCERRAMENTO
  // =========================================================

  const postEventOpened =
    Boolean(
      summary?.event?.post_event_opened_at ||
      summary?.post_event_opened_at ||
      summary?.opened_at
    )

  const expensesClosed =
    Number(
      summary?.closure?.expenses_closed ||
      0
    ) === 1

  const approvedTeamReports =
    teamReports.filter(
      (report) =>
        report.status === 'approved'
    ).length

  const reportsComplete =
    teamReports.length > 0 &&
    approvedTeamReports ===
      teamReports.length

  const postEventClosed =
    Boolean(
      summary?.event?.post_event_closed_at ||
      summary?.post_event_closed_at ||
      summary?.closure?.post_event_closed_at
    )

  const closingSteps = [
    {
      key: 'opened',
      label: 'Pós-evento aberto',
      complete: postEventOpened,
    },
    {
      key: 'expenses',
      label: 'Gastos finalizados',
      complete: expensesClosed,
    },
    {
      key: 'reports',
      label: 'Prestações das equipes',
      complete: reportsComplete,
    },
    {
      key: 'closed',
      label: 'Encerramento administrativo',
      complete: postEventClosed,
    },
  ]

  const completedClosingSteps =
    closingSteps.filter(
      (step) => step.complete
    ).length

  const closingProgress =
    Math.round(
      (
        completedClosingSteps /
        closingSteps.length
      ) * 100
    )

  const pendingTeamReports =
    teamReports.filter(
      (report) =>
        report.status !== 'approved'
    )

  // O fechamento financeiro global só pode
  // acontecer quando todos os fechamentos das
  // equipes estiverem aprovados.
  const allTeamReportsApproved =
    teamReports.length > 0 &&
    pendingTeamReports.length === 0


  const nextClosingAction =
    !postEventOpened
      ? {
          key: 'opened',
          label: 'Abrir o Pós-evento',
          description:
            'Inicie oficialmente o processo de encerramento deste evento.',
        }
      : !expensesClosed
        ? {
            key: 'expenses',
            label: 'Finalizar os gastos',
            description:
              'Revise os lançamentos financeiros antes de concluir esta etapa.',
          }
        : pendingTeamReports.length > 0
          ? {
              key: 'reports',
              label:
                pendingTeamReports.length === 1
                  ? `Concluir prestação de ${pendingTeamReports[0].team_name}`
                  : `Concluir ${pendingTeamReports.length} prestações de equipe`,
              description:
                'As prestações financeiras precisam ser concluídas e aprovadas para avançar.',
            }
          : !postEventClosed
            ? {
                key: 'closed',
                label: 'Realizar o encerramento administrativo',
                description:
                  'As etapas anteriores estão concluídas. O evento pode ser finalizado.',
              }
            : {
                key: 'complete',
                label: 'Pós-evento concluído',
                description:
                  'Todas as etapas administrativas deste evento foram concluídas.',
              }


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
              isLoading ||
              !postEventAvailable
            }
            onClick={
              openPostEvent
            }
          >
            🌙 Iniciar Pós-Evento
          </button>
        )}

        {canOpen &&
          !postEventAvailable && (
          <p className="post-event-open-hint">
            Disponível a partir da data do evento.
          </p>
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
          {/* POST-EVENT PROGRESS */}
          {/* ============================================= */}

          <div className="post-event-progress-card">
            <div className="post-event-progress-head">
              <div>
                <small>
                  ENCERRAMENTO DO EVENTO
                </small>

                <strong>
                  Progresso do Pós-evento
                </strong>

                <span>
                  Acompanhe o que ainda precisa
                  ser concluído.
                </span>
              </div>

              <div className="post-event-progress-percentage">
                <strong>
                  {closingProgress}%
                </strong>

                <span>
                  concluído
                </span>
              </div>
            </div>

            <div className="post-event-progress-track">
              <div
                className="post-event-progress-value"
                style={{
                  width:
                    `${closingProgress}%`,
                }}
                role="progressbar"
                aria-valuenow={
                  closingProgress
                }
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>

            <div
              className={`post-event-next-action ${
                nextClosingAction.key === 'complete'
                  ? 'is-complete'
                  : ''
              }`}
            >
              <div className="post-event-next-action-icon">
                {nextClosingAction.key === 'complete'
                  ? '✓'
                  : '→'}
              </div>

              <div className="post-event-next-action-copy">
                <small>
                  {nextClosingAction.key === 'complete'
                    ? 'ENCERRAMENTO'
                    : 'PRÓXIMA AÇÃO'}
                </small>

                <strong>
                  {nextClosingAction.label}
                </strong>

                <span>
                  {nextClosingAction.description}
                </span>
              </div>
            </div>


            {nextClosingAction.key ===
              'closed' && (
              <button
                type="button"
                className="post-event-finalize-button"
                disabled={isLoading}
                onClick={closePostEvent}
              >
                ✓ Encerrar Pós-Evento
              </button>
            )}


            <div className="post-event-progress-steps">
              {closingSteps.map(
                (step) => (
                  <div
                    key={step.key}
                    className={`post-event-progress-step ${
                      step.complete
                        ? 'is-complete'
                        : 'is-pending'
                    }`}
                  >
                    <span>
                      {step.complete
                        ? '✓'
                        : '○'}
                    </span>

                    <strong>
                      {step.label}
                    </strong>

                    {step.key ===
                      'reports' && (
                      <small>
                        {approvedTeamReports}
                        {' / '}
                        {teamReports.length}
                      </small>
                    )}
                  </div>
                )
              )}
            </div>

            {pendingTeamReports.length > 0 && (
              <div className="post-event-progress-pending">
                <small>
                  AINDA FALTA
                </small>

                <div>
                  {pendingTeamReports.map(
                    (report) => (
                      <span key={report.id}>
                        🤝 {report.team_name}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {Number(
              summary?.feedback?.total || 0
            ) > 0 && (
              <div className="post-event-progress-feedback">
                <span>
                  ♥
                </span>

                <strong>
                  {Number(
                    summary.feedback.average || 0
                  ).toFixed(1)}
                  {' / 5'}
                </strong>

                <small>
                  {summary.feedback.total}
                  {' '}
                  avaliações recebidas
                </small>
              </div>
            )}
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

                                <div
                className={[
                  'post-event-financial-gate',
                  allTeamReportsApproved
                    ? 'is-ready'
                    : 'is-locked',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <strong>
                  {approvedTeamReports}
                  {' de '}
                  {teamReports.length}
                  {' '}
                  {teamReports.length === 1
                    ? 'prestação aprovada'
                    : 'prestações aprovadas'}
                </strong>

                <small>
                  {allTeamReportsApproved
                    ? 'Todas as prestações foram concluídas e aprovadas. O financeiro global pode ser finalizado.'
                    : `${pendingTeamReports.length} ${
                        pendingTeamReports.length === 1
                          ? 'equipe ainda precisa'
                          : 'equipes ainda precisam'
                      } concluir a aprovação.`}
                </small>
              </div>

<button
                    type="button"
                    disabled={(isLoading) || !allTeamReportsApproved}
                    onClick={closeExpenses}
                  >
                    🔒 {allTeamReportsApproved
                    ? 'Finalizar e enviar ao Financeiro'
                    : 'Aguardando prestações das equipes'}
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
                    Prestação de contas
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

            
            <PostEventFinancialReview
              eventId={
                selectedEventId
              }
              reports={
                teamReports
              }
              onChanged={
                reloadSummary
              }
            />


          </div>


          {/* ============================================= */}
          {/* FEEDBACK */}
          {/* ============================================= */}

          <section className="post-event-feedback-card">
            <div className="post-event-feedback-card-head">
              <div>
                <small>
                  AVALIAÇÃO DO EVENTO
                </small>

                <h3>
                  Experiência dos voluntários
                </h3>

                <p>
                  Avaliações enviadas por quem
                  teve check-in confirmado.
                </p>
              </div>

              {summary.feedback
                ?.total > 0 && (
                <span>
                  {summary.feedback.total}
                  {' '}
                  {summary.feedback.total === 1
                    ? 'avaliação'
                    : 'avaliações'}
                </span>
              )}
            </div>


            {summary.feedback
              ?.total > 0 ? (
              <>
                <div className="post-event-feedback-score">
                  <strong>
                    ♥
                  </strong>

                  <div>
                    <b>
                      {
                        summary.feedback.average.toFixed(
                          1
                        )
                      }
                    </b>

                    <span>
                      de 5 corações
                    </span>
                  </div>
                </div>


                {summary.feedback
                  .comments
                  ?.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="post-event-feedback-toggle"
                      onClick={() =>
                        setShowFeedbackComments(
                          (current) =>
                            !current
                        )
                      }
                    >
                      {showFeedbackComments
                        ? 'Ocultar comentários'
                        : `Ver comentários (${summary.feedback.comments.length})`}
                    </button>


                    {showFeedbackComments && (
                      <div className="post-event-feedback-comments">
                        {summary.feedback.comments.map(
                          (feedback) => (
                            <article
                              key={
                                feedback.id
                              }
                            >
                              <div>
                                <strong>
                                  {
                                    feedback.userName
                                  }
                                </strong>

                                <span>
                                  {
                                    '♥'.repeat(
                                      feedback.rating
                                    )
                                  }
                                </span>
                              </div>

                              <p>
                                {
                                  feedback.comment
                                }
                              </p>

                              {feedback.createdAt && (
                                <small>
                                  {new Date(
                                    feedback.createdAt
                                  ).toLocaleString(
                                    'pt-BR'
                                  )}
                                </small>
                              )}
                            </article>
                          )
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="post-event-feedback-empty">
                Ainda não há avaliações
                para este evento.
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}

export default AdminPostEventPanel
