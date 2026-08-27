import {
  useState,
} from 'react'


const FINANCIAL_LABELS = {
  expenses:
    'Com gastos',

  no_expenses:
    'Sem gastos',

  donation:
    'Doação',

  pending:
    'Pendente',
}


function PostEventTeamReviewList({
  eventId,
  reports = [],
  onChanged,
}) {
  const [
    openedTeamId,
    setOpenedTeamId,
  ] = useState(null)

  const [
    details,
    setDetails,
  ] = useState({})

  const [
    loadingTeamId,
    setLoadingTeamId,
  ] = useState(null)

  const [
    actionReportId,
    setActionReportId,
  ] = useState(null)

  const [
    returnReportId,
    setReturnReportId,
  ] = useState(null)

  const [
    returnReason,
    setReturnReason,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')


  async function request(
    operation,
    payload = {}
  ) {
    const response = await fetch(
      '/api/admin?action=post-event',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          operation,
          eventId:
            Number(eventId),

          ...payload,
        }),
      }
    )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível concluir a operação.'
      )
    }

    return result
  }


  async function toggleDetails(
    report
  ) {
    const teamId =
      Number(report.team_id)

    if (
      openedTeamId ===
      teamId
    ) {
      setOpenedTeamId(null)
      return
    }

    setOpenedTeamId(teamId)

    if (details[teamId]) {
      return
    }

    setLoadingTeamId(teamId)
    setMessage('')

    try {
      const result =
        await request(
          'team-report-form',
          {
            teamId,
          }
        )

      setDetails(
        (current) => ({
          ...current,

          [teamId]:
            result,
        })
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setLoadingTeamId(null)
    }
  }


  async function approve(
    report
  ) {
    if (!report.report_id) {
      return
    }

    const confirmed =
      window.confirm(
        `Aprovar o fechamento de ${report.team_name}?`
      )

    if (!confirmed) {
      return
    }

    setActionReportId(
      report.report_id
    )

    setMessage('')

    try {
      await request(
        'approve-team-report',
        {
          reportId:
            report.report_id,
        }
      )

      setDetails(
        (current) => ({
          ...current,
        })
      )

      setMessage(
        'Fechamento aprovado. ✅'
      )

      if (onChanged) {
        await onChanged()
      }

      setActionReportId(null)
    } catch (error) {
      setMessage(
        error.message
      )

      setActionReportId(null)
    }
  }


  async function returnForChanges(
    report
  ) {
    const clean =
      returnReason.trim()

    if (!clean) {
      setMessage(
        'Informe o que precisa ser ajustado.'
      )

      return
    }

    setActionReportId(
      report.report_id
    )

    setMessage('')

    try {
      await request(
        'return-team-report',
        {
          reportId:
            report.report_id,

          reason:
            clean,
        }
      )

      setMessage(
        'Fechamento devolvido para ajustes. ↩️'
      )

      if (onChanged) {
        await onChanged()
      }

      setReturnReportId(null)
      setReturnReason('')
      setActionReportId(null)
    } catch (error) {
      setMessage(
        error.message
      )

      setActionReportId(null)
    }
  }


  if (
    !eventId ||
    reports.length === 0
  ) {
    return null
  }


  return (
    <section className="post-event-review">
      <div className="post-event-review-head">
        <div>
          <small>
            REVISÃO GERENCIAL
          </small>

          <h3>
            Fechamentos das Equipes
          </h3>

          <p>
            Revise o relatório,
            avaliação e financeiro
            antes da aprovação.
          </p>
        </div>

        <span>
          {
            reports.filter(
              (report) =>
                report.status ===
                'approved'
            ).length
          }
          /
          {reports.length}
          {' '}
          aprovados
        </span>
      </div>


      <div className="post-event-review-list">
        {reports.map(
          (report) => {
            const teamId =
              Number(
                report.team_id
              )

            const isOpen =
              openedTeamId ===
              teamId

            const loaded =
              details[teamId]

            const rating =
              Number(
                loaded
                  ?.report
                  ?.rating ??
                report.rating ??
                0
              )

            const financialStatus =
              loaded
                ?.report
                ?.financial_status ??
              report.financial_status ??
              'pending'

            const isSubmitted =
              report.status ===
              'submitted'

            const isApproved =
              report.status ===
              'approved'

            return (
              <article
                key={
                  report.team_id
                }
                className="post-event-review-card"
              >
                <div className="post-event-review-card-head">
                  <div>
                    <strong>
                      {report.team_name}
                    </strong>

                    <span>
                      Responsável:
                      {' '}
                      {
                        report
                          .responsible_user_name ||
                        report
                          .submitted_by_name ||
                        'não definido'
                      }
                    </span>
                  </div>

                  <span
                    className={
                      `post-event-review-status is-${report.status}`
                    }
                  >
                    {isApproved
                      ? 'Aprovado'
                      : isSubmitted
                        ? 'Aguardando aprovação'
                        : 'Em andamento'}
                  </span>
                </div>


                <div className="post-event-review-summary">
                  <span>
                    <small>
                      FINANCEIRO
                    </small>

                    <strong>
                      {
                        FINANCIAL_LABELS[
                          financialStatus
                        ] ||
                        'Pendente'
                      }
                    </strong>
                  </span>

                  <span>
                    <small>
                      RELATÓRIO
                    </small>

                    <strong>
                      {isSubmitted ||
                      isApproved
                        ? 'Enviado'
                        : 'Pendente'}
                    </strong>
                  </span>

                  <span>
                    <small>
                      AVALIAÇÃO
                    </small>

                    <strong>
                      {rating > 0
                        ? `${rating}/5 ★`
                        : 'Pendente'}
                    </strong>
                  </span>
                </div>


                {report.return_reason && (
                  <div className="post-event-review-returned">
                    <small>
                      DEVOLVIDO PARA AJUSTES
                    </small>

                    <p>
                      {
                        report
                          .return_reason
                      }
                    </p>
                  </div>
                )}


                <button
                  type="button"
                  className="post-event-review-toggle"
                  onClick={() =>
                    toggleDetails(
                      report
                    )
                  }
                >
                  {isOpen
                    ? 'Fechar detalhes'
                    : 'Ver fechamento completo'}
                </button>


                {isOpen && (
                  <div className="post-event-review-details">
                    {loadingTeamId ===
                    teamId ? (
                      <p>
                        Carregando fechamento...
                      </p>
                    ) : !loaded ? (
                      <p>
                        Não foi possível
                        carregar os detalhes.
                      </p>
                    ) : (
                      <>
                        <section>
                          <small>
                            RELATÓRIO DA EQUIPE
                          </small>

                          {loaded.questions
                            ?.length ? (
                            <div className="post-event-review-answers">
                              {
                                loaded.questions.map(
                                  (
                                    question,
                                    index
                                  ) => (
                                    <div
                                      key={
                                        question.id
                                      }
                                    >
                                      <strong>
                                        {index + 1}.
                                        {' '}
                                        {
                                          question.question_text
                                        }
                                      </strong>

                                      <p>
                                        {
                                          question.answer_text ||
                                          'Sem resposta.'
                                        }
                                      </p>
                                    </div>
                                  )
                                )
                              }
                            </div>
                          ) : (
                            <p>
                              Nenhuma pergunta
                              configurada.
                            </p>
                          )}
                        </section>


                        <section>
                          <small>
                            AVALIAÇÃO
                          </small>

                          <div className="post-event-review-stars">
                            {[1, 2, 3, 4, 5]
                              .map(
                                (
                                  star
                                ) => (
                                  <span
                                    key={
                                      star
                                    }
                                    className={
                                      star <=
                                      rating
                                        ? 'is-active'
                                        : ''
                                    }
                                  >
                                    ★
                                  </span>
                                )
                              )}
                          </div>

                          {loaded
                            .report
                            ?.rating_comment && (
                            <p>
                              {
                                loaded
                                  .report
                                  .rating_comment
                              }
                            </p>
                          )}
                        </section>


                        <section>
                          <small>
                            FINANCEIRO
                          </small>

                          <p>
                            {
                              FINANCIAL_LABELS[
                                financialStatus
                              ] ||
                              'Pendente'
                            }
                          </p>
                        </section>


                        {isSubmitted && (
                          <div className="post-event-review-actions">
                            <div className="post-event-review-return-box">
                              {returnReportId ===
                              report.report_id ? (
                                <>
                                  <textarea
                                    rows="3"
                                    maxLength="1000"
                                    placeholder="Explique o que precisa ser ajustado..."
                                    value={
                                      returnReason
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      setReturnReason(
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  />

                                  <div>
                                    <button
                                      type="button"
                                      disabled={
                                        actionReportId ===
                                        report.report_id
                                      }
                                      onClick={() => {
                                        setReturnReportId(
                                          null
                                        )

                                        setReturnReason(
                                          ''
                                        )
                                      }}
                                    >
                                      Cancelar
                                    </button>

                                    <button
                                      type="button"
                                      className="is-return"
                                      disabled={
                                        actionReportId ===
                                        report.report_id
                                      }
                                      onClick={() =>
                                        returnForChanges(
                                          report
                                        )
                                      }
                                    >
                                      Confirmar devolução
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="is-return"
                                  onClick={() => {
                                    setReturnReportId(
                                      report.report_id
                                    )

                                    setReturnReason(
                                      ''
                                    )
                                  }}
                                >
                                  ↩ Devolver para ajustes
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              className="is-approve"
                              disabled={
                                actionReportId ===
                                report.report_id
                              }
                              onClick={() =>
                                approve(
                                  report
                                )
                              }
                            >
                              ✓ Aprovar fechamento
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            )
          }
        )}
      </div>


      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}
    </section>
  )
}


export default PostEventTeamReviewList
