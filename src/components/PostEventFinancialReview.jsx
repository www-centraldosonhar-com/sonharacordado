import {
  useEffect,
  useMemo,
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


function formatCurrency(
  value
) {
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


function PostEventFinancialReview({
  eventId,
  reports = [],
  onChanged,
}) {
  const [
    expenses,
    setExpenses,
  ] = useState([])

  const [
    teamReportRows,
    setTeamReportRows,
  ] = useState([])

  const [
    reportAccess,
    setReportAccess,
  ] = useState({
    isGeneralEvent: false,
    canAssignResponsible: false,
  })

  const [
    postEventData,
    setPostEventData,
  ] = useState(null)

  const [
    assigningTeamId,
    setAssigningTeamId,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    actionReportId,
    setActionReportId,
  ] = useState(null)

  const [
    openedTeamId,
    setOpenedTeamId,
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


  // =====================================================
  // EVENTO GERAL — EQUIPES + RESPONSÁVEIS
  // =====================================================

  async function loadTeamReports() {
    if (!eventId) {
      setTeamReportRows([])
      return
    }

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
                'team-reports',

              eventId:
                Number(eventId),
            }),
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível carregar as equipes.'
      )
    }

    setTeamReportRows(
      result.reports || []
    )

    setPostEventData(
      result.event || null
    )

    setReportAccess(
      result.access || {
        isGeneralEvent: false,
        canAssignResponsible: false,
      }
    )
  }


  // =====================================================
  // CARREGA GASTOS QUE O ADMIN PODE CONSULTAR
  // =====================================================

  useEffect(() => {
    let active = true

    async function load() {
      if (!eventId) {
        if (active) {
          setExpenses([])
          setLoading(false)
        }

        return
      }

      setLoading(true)

      try {
        const response =
          await fetch(
            '/api/admin?action=expenses&operation=list'
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar os gastos.'
          )
        }

        if (active) {
          setExpenses(
            result.expenses || []
          )
        }
      } catch (error) {
        if (active) {
          setMessage(
            error.message
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [
    eventId,
  ])


  useEffect(() => {
    let active = true

    async function loadReports() {
      if (!eventId) {
        if (active) {
          setTeamReportRows([])
        }

        return
      }

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
                    'team-reports',

                  eventId:
                    Number(eventId),
                }),
            }
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar as equipes.'
          )
        }

        if (active) {
          setTeamReportRows(
            result.reports || []
          )

          setPostEventData(
            result.event || null
          )

          setReportAccess(
            result.access || {
              isGeneralEvent: false,
              canAssignResponsible: false,
            }
          )
        }
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
  }, [
    eventId,
  ])


  // =====================================================
  // GASTOS DO EVENTO ATUAL
  // =====================================================

  const eventExpenses =
    useMemo(
      () =>
        expenses.filter(
          (expense) =>
            Number(
              expense.event_id
            ) ===
            Number(eventId)
        ),
      [
        expenses,
        eventId,
      ]
    )


  const visibleReports =
    teamReportRows.length > 0
      ? teamReportRows
      : reports

  const isGeneralPostEvent =
    reportAccess.isGeneralEvent === true ||
    postEventData?.project_id === null


  function expensesForTeam(
    teamId
  ) {
    return eventExpenses.filter(
      (expense) =>
        Number(
          expense.team_id
        ) ===
        Number(teamId)
    )
  }


  function activeExpensesForTeam(
    teamId
  ) {
    return expensesForTeam(
      teamId
    ).filter(
      (expense) =>
        Number(
          expense.active
        ) === 1
    )
  }


  // =====================================================
  // ABRIR COMPROVANTE
  // =====================================================

  async function openReceipt(
    expense
  ) {
    setMessage('')

    const receiptWindow =
      window.open(
        'about:blank',
        '_blank'
      )

    if (!receiptWindow) {
      setMessage(
        'Permita pop-ups para abrir o comprovante.'
      )

      return
    }

    try {
      receiptWindow
        .document
        .body
        .innerHTML =
        '<p style="font-family:sans-serif;padding:24px">Abrindo comprovante...</p>'

      const response =
        await fetch(
          '/api/admin?action=expenses',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                operation:
                  'receipt-url',

                expenseId:
                  expense.id,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível abrir o comprovante.'
        )
      }

      receiptWindow.location.href =
        result.url
    } catch (error) {
      try {
        receiptWindow.close()
      } catch {
        // Nada a fazer.
      }

      setMessage(
        error.message
      )
    }
  }


  // =====================================================
  // POST EVENT ACTION
  // =====================================================

  async function request(
    operation,
    payload = {}
  ) {
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


  // =====================================================
  // EVENTO GERAL — DEFINIR RESPONSÁVEL
  // =====================================================

  async function assignResponsible(
    report,
    responsibleUserId
  ) {
    const numericResponsibleUserId =
      Number(
        responsibleUserId
      )

    if (
      !Number.isInteger(
        numericResponsibleUserId
      )
    ) {
      return
    }

    setAssigningTeamId(
      Number(
        report.team_id
      )
    )

    setMessage('')

    try {
      const result =
        await request(
          'assign-team-responsible',
          {
            teamId:
              Number(
                report.team_id
              ),

            responsibleUserId:
              numericResponsibleUserId,
          }
        )

      setMessage(
        result.message ||
        'Responsável definido. ✅'
      )

      await loadTeamReports()

      if (onChanged) {
        await onChanged()
      }
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setAssigningTeamId(null)
    }
  }


  // =====================================================
  // APROVAR
  // =====================================================

  async function approve(
    report
  ) {
    const reportId =
      report.report_id ||
      report.id

    if (!reportId) {
      setMessage(
        'Prestação financeira inválida.'
      )

      return
    }

    const confirmed =
      window.confirm(
        `Aprovar os gastos de ${report.team_name}?`
      )

    if (!confirmed) {
      return
    }

    setActionReportId(
      reportId
    )

    setMessage('')

    try {
      await request(
        'approve-team-report',
        {
          reportId:
            reportId,
        }
      )

      setMessage(
        'Prestação de contas aprovada. ✅'
      )

      await loadTeamReports()

      if (onChanged) {
        await onChanged()
      }
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setActionReportId(null)
    }
  }


  // =====================================================
  // DEVOLVER
  // =====================================================

  async function returnForChanges(
    report
  ) {
    const reportId =
      report.report_id ||
      report.id

    if (!reportId) {
      setMessage(
        'Prestação financeira inválida.'
      )

      return
    }

    const cleanReason =
      returnReason.trim()

    if (!cleanReason) {
      setMessage(
        'Informe o que precisa ser corrigido.'
      )

      return
    }

    setActionReportId(
      reportId
    )

    setMessage('')

    try {
      await request(
        'return-team-report',
        {
          reportId:
            reportId,

          reason:
            cleanReason,
        }
      )

      setMessage(
        'Prestação devolvida para ajustes. ↩️'
      )

      setReturnReportId(null)
      setReturnReason('')

      await loadTeamReports()

      if (onChanged) {
        await onChanged()
      }
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setActionReportId(null)
    }
  }


  if (!eventId) {
    return null
  }


  return (
    <section className="post-event-financial-review">

      <header className="financial-review-heading">
        <div>
          <small>
            PRESTAÇÃO DE CONTAS
          </small>

          <h3>
            Gastos das Equipes
          </h3>

          <p>
            Confira somente as equipes
            que tiveram gastos.
            Sem gastos e doações são
            concluídos automaticamente,
            mas podem ser corrigidos antes
            do fechamento financeiro.
          </p>
        </div>
      </header>


      {loading ? (
        <div className="financial-review-empty">
          Carregando prestações...
        </div>
      ) : (
        <div className="financial-review-list">

          {visibleReports.length === 0 && (
            <div className="financial-review-empty">
              Nenhuma equipe ativa foi encontrada.
            </div>
          )}

          {visibleReports.map(
            (report) => {
              const teamId =
                Number(
                  report.team_id
                )

              const financialStatus =
                report.financial_status ||
                'pending'

              const teamExpenses =
                activeExpensesForTeam(
                  teamId
                )

              const total =
                teamExpenses.reduce(
                  (
                    sum,
                    expense
                  ) =>
                    sum +
                    Number(
                      expense.amount ||
                      0
                    ),
                  0
                )

              const isExpenses =
                financialStatus ===
                'expenses'

              const isSubmitted =
                report.status ===
                'submitted'

              const isApproved =
                report.status ===
                'approved'

              const isOpen =
                openedTeamId ===
                teamId

              return (
                <article
                  key={
                    report.team_id
                  }
                  className={
                    `financial-review-team-card ${
                      isApproved
                        ? 'is-approved'
                        : ''
                    }`
                  }
                >
                  <div className="financial-review-team-main">
                    <div className="financial-review-team-title">
                      <strong>
                        {report.team_name}
                      </strong>

                      {report
                        .responsible_user_name && (
                        <span>
                          Responsável:
                          {' '}
                          {
                            report
                              .responsible_user_name
                          }
                        </span>
                      )}
                    </div>


                    {isGeneralPostEvent && (
                      <div className="financial-review-responsible">
                        <small>
                          RESPONSÁVEL PELO PÓS-EVENTO
                        </small>

                        {reportAccess.canAssignResponsible &&
                        !reportAccess.expensesClosed &&
                        report.status !== 'approved' ? (
                          <select
                            value={
                              report.responsible_user_id
                                ? String(
                                    report.responsible_user_id
                                  )
                                : ''
                            }
                            disabled={
                              assigningTeamId ===
                              Number(
                                report.team_id
                              )
                            }
                            onChange={(
                              event
                            ) =>
                              assignResponsible(
                                report,
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Selecionar Admin da equipe
                            </option>

                            {(report.eligible_admins || [])
                              .map(
                                (
                                  person
                                ) => (
                                  <option
                                    key={
                                      person.id
                                    }
                                    value={
                                      person.id
                                    }
                                  >
                                    {
                                      person.name
                                    }
                                  </option>
                                )
                              )}
                          </select>
                        ) : (
                          <strong>
                            {
                              report.responsible_user_name ||
                              'Não definido'
                            }
                          </strong>
                        )}

                        {assigningTeamId ===
                          Number(
                            report.team_id
                          ) && (
                          <span>
                            Salvando...
                          </span>
                        )}

                        {reportAccess.canAssignResponsible &&
                        (report.eligible_admins || [])
                          .length === 0 && (
                          <span className="financial-review-responsible-empty">
                            Nenhum Admin ativo pertence a esta equipe.
                          </span>
                        )}
                      </div>
                    )}


                    <div className="financial-review-team-status">
                      <small>
                        SITUAÇÃO
                      </small>

                      <strong>
                        {
                          FINANCIAL_LABELS[
                            financialStatus
                          ] ||
                          'Pendente'
                        }
                      </strong>
                    </div>


                    {isExpenses && (
                      <div className="financial-review-team-value">
                        <small>
                          TOTAL
                        </small>

                        <strong>
                          {formatCurrency(
                            total
                          )}
                        </strong>

                        <span>
                          {teamExpenses.length}
                          {' '}
                          {teamExpenses.length ===
                          1
                            ? 'lançamento'
                            : 'lançamentos'}
                        </span>
                      </div>
                    )}


                    <div className="financial-review-team-result">
                      {isApproved ? (
                        <span className="financial-review-approved">
                          ✓ Concluído
                        </span>
                      ) : isSubmitted ? (
                        <span className="financial-review-waiting">
                          Aguardando revisão
                        </span>
                      ) : (
                        <span>
                          Em preenchimento
                        </span>
                      )}
                    </div>
                  </div>


                  {report.return_reason && (
                    <div className="financial-review-return-notice">
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


                  {isExpenses && (
                    <button
                      type="button"
                      className="financial-review-open"
                      onClick={() =>
                        setOpenedTeamId(
                          isOpen
                            ? null
                            : teamId
                        )
                      }
                    >
                      {isOpen
                        ? 'Fechar prestação'
                        : 'Revisar gastos e comprovantes'}
                    </button>
                  )}


                  {isExpenses &&
                    isOpen && (
                    <div className="financial-review-detail">

                      {teamExpenses.length ===
                      0 ? (
                        <div className="financial-review-empty">
                          Nenhum gasto ativo encontrado.
                        </div>
                      ) : (
                        <div className="financial-review-expenses">
                          {teamExpenses.map(
                            (
                              expense,
                              index
                            ) => (
                              <article
                                key={
                                  expense.id
                                }
                                className="financial-review-expense"
                              >
                                <div className="financial-review-expense-number">
                                  {index + 1}
                                </div>

                                <div className="financial-review-expense-content">
                                  <div className="financial-review-expense-head">
                                    <div>
                                      <strong>
                                        {
                                          expense.description
                                        }
                                      </strong>

                                      <span>
                                        Lançado por
                                        {' '}
                                        {
                                          expense
                                            .created_by_name
                                        }
                                      </span>
                                    </div>

                                    <strong className="financial-review-expense-value">
                                      {formatCurrency(
                                        expense.amount
                                      )}
                                    </strong>
                                  </div>


                                  <div className="financial-review-expense-actions">
                                    {expense.receipt_path ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openReceipt(
                                            expense
                                          )
                                        }
                                      >
                                        📎 Abrir comprovante
                                      </button>
                                    ) : (
                                      <span className="financial-review-no-receipt">
                                        Sem comprovante
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </article>
                            )
                          )}
                        </div>
                      )}


                      {isSubmitted && (
                        <div className="financial-review-actions">

                          <div className="financial-review-return">
                            {returnReportId ===
                            report.report_id ? (
                              <>
                                <label>
                                  <span>
                                    O que precisa ser corrigido?
                                  </span>

                                  <textarea
                                    rows="4"
                                    maxLength="1000"
                                    value={
                                      returnReason
                                    }
                                    placeholder="Ex.: O comprovante do segundo gasto não corresponde ao valor lançado."
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
                                </label>

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
                            ✓ Aprovar prestação
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            }
          )}
        </div>
      )}


      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}
    </section>
  )
}


export default PostEventFinancialReview
