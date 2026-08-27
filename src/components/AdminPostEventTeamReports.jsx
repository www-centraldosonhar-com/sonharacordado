import {
  useEffect,
  useState,
} from 'react'
import AdminExpensesPanel from './AdminExpensesPanel'


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
  teams = [],
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
    assigningTeamId,
    setAssigningTeamId,
  ] = useState(null)


  const [
    completingFinancialTeamId,
    setCompletingFinancialTeamId,
  ] = useState(null)


  const [
    expensesFlowTeamId,
    setExpensesFlowTeamId,
  ] = useState(null)

  const [
    editingResponsibleTeamId,
    setEditingResponsibleTeamId,
  ] = useState(null)
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


  async function completeFinancialStatus(
    report,
    financialStatus
  ) {
    setCompletingFinancialTeamId(
      Number(report.team_id)
    )

    setMessage('')

    try {
      const response = await fetch(
        '/api/admin?action=post-event',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            operation:
              'complete-team-financial',

            eventId:
              Number(selectedEventId),

            teamId:
              Number(report.team_id),

            financialStatus,
          }),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível concluir a situação financeira.'
        )
      }

      // Atualização instantânea no card.
      setReports(
        (currentReports) =>
          currentReports.map(
            (currentReport) =>
              Number(
                currentReport.team_id
              ) ===
              Number(report.team_id)
                ? {
                    ...currentReport,

                    status:
                      financialStatus === 'expenses'
                        ? 'submitted'
                        : 'approved',

                    financial_status:
                      financialStatus,

                    financial_completed_at:
                      new Date()
                        .toISOString(),
                  }
                : currentReport
          )
      )

      setMessage(
        result.message ||
        'Situação financeira atualizada.'
      )

      // Sem gastos e Doação encerram a etapa
      // diretamente, então o formulário de
      // lançamentos não deve continuar aberto.
      if (
        financialStatus !==
        'expenses'
      ) {
        setExpensesFlowTeamId(
          null
        )
      }

      // O POST já confirmou o salvamento.
      // Não seguramos o feedback visual
      // durante a sincronização posterior.
      setCompletingFinancialTeamId(
        null
      )

      try {
        await reloadReports()
      } catch (reloadError) {
        console.error(
          'Financial status reload error:',
          reloadError
        )
      }
    } catch (error) {
      setMessage(
        error.message ||
        'Não foi possível concluir a situação financeira.'
      )
    } finally {
      setCompletingFinancialTeamId(
        null
      )
    }
  }


  function openExpensesEditor(
    report
  ) {
    const teamId =
      Number(
        report.team_id
      )

    setExpensesFlowTeamId(
      teamId
    )

    window.setTimeout(
      () => {
        const element =
          document.getElementById(
            `post-event-expenses-${teamId}`
          )

        element?.scrollIntoView({
          behavior:
            'smooth',
          block:
            'start',
        })
      },
      80
    )
  }


  async function resetFinancialStatus(
    report
  ) {
    const confirmed =
      window.confirm(
        'Deseja alterar a decisão financeira desta equipe?'
      )

    if (!confirmed) {
      return
    }

    setCompletingFinancialTeamId(
      Number(
        report.team_id
      )
    )

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
                  'reset-team-financial',

                eventId:
                  Number(
                    selectedEventId
                  ),

                teamId:
                  Number(
                    report.team_id
                  ),
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível reabrir a decisão financeira.'
        )
      }

      setReports(
        currentReports =>
          currentReports.map(
            item =>
              Number(
                item.team_id
              ) ===
              Number(
                report.team_id
              )
                ? {
                    ...item,
                    status:
                      'pending',
                    financial_status:
                      'pending',
                    financial_completed_at:
                      null,
                    financial_completed_by:
                      null,
                  }
                : item
          )
      )

      setExpensesFlowTeamId(
        null
      )

      setMessage(
        result.message ||
        'Decisão financeira reaberta. ✅'
      )

      await reloadReports()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setCompletingFinancialTeamId(
        null
      )
    }
  }


  async function assignResponsible(
    report,
    responsibleUserId
  ) {
    const numericResponsibleUserId =
      Number(responsibleUserId)

    if (
      !Number.isInteger(
        numericResponsibleUserId
      )
    ) {
      return
    }

    setAssigningTeamId(
      Number(report.team_id)
    )

    setMessage('')

    try {
      const response = await fetch(
        '/api/admin?action=post-event',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            operation:
              'assign-team-responsible',

            eventId:
              Number(selectedEventId),

            teamId:
              Number(report.team_id),

            responsibleUserId:
              numericResponsibleUserId,
          }),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível definir o responsável.'
        )
      }

      setMessage(
        result.message ||
        'Responsável atualizado.'
      )

      // Atualiza imediatamente o card no React.
      // Não dependemos de um novo GET para refletir
      // uma operação que o backend já confirmou.
      const selectedResponsible =
        (
          report.eligible_admins ||
          []
        ).find(
          (person) =>
            Number(person.id) ===
            numericResponsibleUserId
        )

      setReports(
        (currentReports) =>
          currentReports.map(
            (currentReport) =>
              Number(
                currentReport.team_id
              ) ===
              Number(report.team_id)
                ? {
                    ...currentReport,

                    responsible_user_id:
                      numericResponsibleUserId,

                    responsible_user_name:
                      selectedResponsible
                        ?.name ||
                      result.responsibleName ||
                      currentReport
                        .responsible_user_name,
                  }
                : currentReport
          )
      )

      // O POST já terminou. Portanto o feedback de
      // salvamento pode desaparecer imediatamente.
      setAssigningTeamId(null)

      setEditingResponsibleTeamId(
        null
      )

      try {
        await reloadReports()
      } catch (reloadError) {
        console.error(
          'Post-event reports reload error:',
          reloadError
        )

        setMessage(
          'Responsável salvo. Atualize a página caso os dados não apareçam imediatamente.'
        )
      }
    } catch (error) {
      setMessage(
        error.message ||
        'Não foi possível definir o responsável.'
      )
    } finally {
      setAssigningTeamId(null)
    }
  }


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




  return (
    <section
      id="relatorios-equipes"
      className="admin-section post-event-team-reports"
    >
      <p className="admin-eyebrow">
        PRESTAÇÃO DE CONTAS
      </p>

      <h2>
        🧾 Gastos das Equipes
      </h2>

      <p className="post-event-team-intro">
        Informe como sua equipe encerrou financeiramente
        a participação neste evento.
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
            const isGeneralEvent =
              Boolean(
                reportAccess?.isGeneralEvent
              )

            const isResponsible =
              Number(
                report.responsible_user_id
              ) ===
              Number(
                reportAccess?.currentAdminId
              )

            const ownsFinancialFlow =
              reportAccess?.canSubmit &&
              !reportAccess?.expensesClosed &&
              (
                !isGeneralEvent ||
                isResponsible
              )

            // =================================================
            // ESTADOS DO FLUXO FINANCEIRO
            // =================================================
            //
            // pending:
            //   equipe pode editar
            //
            // submitted:
            //   enviado à gestão; fica bloqueado, mas pode
            //   ser reaberto pela própria equipe antes da análise
            //
            // approved + expenses:
            //   aprovado pela gestão; trava definitivamente
            //
            // approved + no_expenses/donation:
            //   conclusão automática; ainda pode ser corrigida
            //   antes do fechamento financeiro do evento
            // =================================================

            const canEdit =
              ownsFinancialFlow &&
              report.status === 'pending'

            const canResetDecision =
              ownsFinancialFlow &&
              Boolean(
                report.financial_status &&
                report.financial_status !==
                  'pending'
              ) &&
              (
                report.status === 'submitted' ||
                (
                  report.status === 'approved' &&
                  (
                    report.financial_status ===
                      'no_expenses' ||
                    report.financial_status ===
                      'donation'
                  )
                )
              )

            const awaitingReview =
              report.status === 'submitted' &&
              report.financial_status ===
                'expenses'

            const approvedByManagement =
              report.status === 'approved' &&
              report.financial_status ===
                'expenses'

            const returnedForChanges =
              report.status === 'pending' &&
              Boolean(
                report.return_reason
              )

            const canAssignResponsible =
              isGeneralEvent &&
              Boolean(
                reportAccess
                  ?.canAssignResponsible
              )

            return (
              <article
                className="post-event-report-card"
                key={report.team_id}
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


                {isGeneralEvent &&
                  (
                    canAssignResponsible ||
                    isResponsible
                  ) && (
                  <div
                    className={[
                      'post-event-responsible-card',
                      report.responsible_user_id
                        ? 'is-assigned'
                        : 'is-unassigned',
                    ].join(' ')}
                  >
                    <div className="post-event-responsible-main">
                      <div className="post-event-responsible-icon">
                        {report.responsible_user_id
                          ? '✓'
                          : '!'}
                      </div>

                      <div className="post-event-responsible-copy">
                        <small>
                          RESPONSÁVEL PELO PÓS-EVENTO
                        </small>

                        <strong>
                          {report.responsible_user_name ||
                            'Nenhum responsável definido'}
                        </strong>

                        <span>
                          {canAssignResponsible
                            ? (
                                report.responsible_user_id
                                  ? 'Responsável definido para este evento.'
                                  : 'Escolha um Admin desta equipe para realizar o fechamento.'
                              )
                            : (
                                isResponsible
                                  ? 'Você é o responsável selecionado para este Pós-Evento.'
                                  : ''
                              )}
                        </span>

                        {report.responsible_user_id &&
                          !isResponsible &&
                          reportAccess?.canSubmit && (
                            <span className="post-event-responsible-note">
                              Este Pós-Evento será enviado pelo responsável selecionado.
                            </span>
                          )}
                      </div>
                    </div>

                    {canAssignResponsible && (
                      <div className="post-event-responsible-action">
                        {Number(
                          editingResponsibleTeamId
                        ) !==
                        Number(
                          report.team_id
                        ) ? (
                          <button
                            type="button"
                            className="post-event-responsible-edit-button"
                            onClick={() =>
                              setEditingResponsibleTeamId(
                                Number(
                                  report.team_id
                                )
                              )
                            }
                          >
                            {report.responsible_user_id
                              ? 'Alterar responsável'
                              : '+ Escolher responsável'}
                          </button>
                        ) : (
                          <div className="post-event-responsible-editor">
                            <label>
                              <span>
                                Selecione o Admin responsável
                              </span>

                              <select
                                value={
                                  report.responsible_user_id ||
                                  ''
                                }
                                disabled={
                                  Number(
                                    assigningTeamId
                                  ) ===
                                  Number(
                                    report.team_id
                                  )
                                }
                                onChange={(event) => {
                                  if (
                                    event.target.value
                                  ) {
                                    assignResponsible(
                                      report,
                                      event.target.value
                                    )
                                  }
                                }}
                              >
                                <option value="">
                                  Selecione um Admin
                                </option>

                                {(
                                  report.eligible_admins ||
                                  []
                                ).map(
                                  (person) => (
                                    <option
                                      key={person.id}
                                      value={person.id}
                                    >
                                      {person.name}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            <div className="post-event-responsible-editor-footer">
                              {Number(
                                assigningTeamId
                              ) ===
                              Number(
                                report.team_id
                              ) ? (
                                <small>
                                  Salvando responsável...
                                </small>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingResponsibleTeamId(
                                      null
                                    )
                                  }
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {returnedForChanges && (
                  <div className="post-event-return-notice">
                    <strong>
                      ⚠️ Ajustes solicitados pela gestão
                    </strong>

                    <p>
                      <b>Motivo:</b>{' '}
                      {report.return_reason}
                    </p>

                    <span>
                      Corrija o que for necessário e envie
                      novamente a prestação financeira.
                    </span>

                    {canEdit &&
                      report.financial_status ===
                        'expenses' && (
                      <button
                        type="button"
                        className="post-event-return-action"
                        onClick={() =>
                          openExpensesEditor(
                            report
                          )
                        }
                      >
                        {Number(
                          expensesFlowTeamId
                        ) ===
                        Number(
                          report.team_id
                        )
                          ? 'Editando gastos...'
                          : 'Corrigir gastos'}
                      </button>
                    )}
                  </div>
                )}


                {awaitingReview && (
                  <div className="post-event-submission-notice">
                    <strong>
                      📨 Financeiro enviado para revisão
                    </strong>

                    <span>
                      A gestão já recebeu esta prestação.
                      Enquanto estiver em análise, os dados
                      permanecem bloqueados.
                    </span>
                  </div>
                )}


                {approvedByManagement && (
                  <div className="post-event-approved-notice">
                    <strong>
                      ✅ Prestação aprovada pela gestão
                    </strong>

                    <span>
                      O financeiro desta equipe foi aprovado
                      e não pode mais ser alterado.
                    </span>
                  </div>
                )}

                <div
                  className={[
                    'post-event-financial-step',
                    report.financial_status &&
                    report.financial_status !==
                      'pending'
                      ? 'is-complete'
                      : 'is-pending',
                  ].join(' ')}
                >
                  <div className="post-event-financial-heading">
                    <div>
                      <small>
                        ETAPA 1
                      </small>

                      <strong>
                        Situação financeira
                      </strong>
                    </div>

                    <span>
                      {report.financial_status ===
                      'expenses'
                        ? '✓ Com gastos'
                        : report.financial_status ===
                          'no_expenses'
                          ? '✓ Sem gastos'
                          : report.financial_status ===
                            'donation'
                            ? '✓ Doação'
                            : 'Pendente'}
                    </span>
                  </div>

                  <p>
                    Informe como a equipe encerrou
                    financeiramente sua participação
                    neste evento.
                  </p>

                  <div className="post-event-financial-options">
                    {[
                      {
                        value: 'expenses',
                        label: 'Com gastos',
                        description:
                          'Há despesas registradas',
                      },
                      {
                        value: 'no_expenses',
                        label: 'Sem gastos',
                        description:
                          'Nenhuma despesa da equipe',
                      },
                      {
                        value: 'donation',
                        label: 'Doação',
                        description:
                          'Custos foram doados ou absorvidos',
                      },
                    ].map((option) => {
                      const expensesFlowOpen =
                        Number(
                          expensesFlowTeamId
                        ) ===
                        Number(
                          report.team_id
                        )

                      // A situação salva no banco e o fluxo
                      // atualmente aberto são coisas diferentes.
                      //
                      // Exemplo:
                      // status salvo = Sem gastos
                      // usuário toca em Com gastos
                      // → Com gastos ganha destaque enquanto
                      //   os lançamentos estão sendo preparados.
                      // → o banco só muda para expenses depois
                      //   de "Concluir financeiro".
                      const selected =
                        option.value ===
                        'expenses'
                          ? (
                              expensesFlowOpen ||
                              report.financial_status ===
                                'expenses'
                            )
                          : (
                              !expensesFlowOpen &&
                              report.financial_status ===
                                option.value
                            )

                      const saving =
                        Number(
                          completingFinancialTeamId
                        ) ===
                        Number(
                          report.team_id
                        )

                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={[
                            'post-event-financial-option',
                            selected
                              ? 'is-selected'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          disabled={
                            !canEdit ||
                            saving
                          }
                          onClick={() => {
                        
                            // COM GASTOS
                            // Abre/reabre o painel operacional.
                            // Ainda NÃO conclui a etapa.
                            if (
                              option.value ===
                              'expenses'
                            ) {
                              openExpensesEditor(
                                report
                              )

                              return
                            }

                            // SEM GASTOS / DOAÇÃO
                            // Fecha imediatamente qualquer
                            // painel de lançamentos aberto.
                            setExpensesFlowTeamId(
                              null
                            )

                            const financialConfirmed =
                              window.confirm(
                                option.value ===
                                  'no_expenses'
                                  ? 'Confirmar que esta equipe não teve gastos?'
                                  : 'Confirmar que os gastos desta equipe foram tratados como doação?'
                              )

                            if (!financialConfirmed) {
                              return
                            }


                            completeFinancialStatus(
                              report,
                              option.value
                            )
                          }}
                        >
                          <strong>
                            {selected
                              ? '✓ '
                              : ''}
                            {option.label}
                          </strong>

                          <small>
                            {option.description}
                          </small>
                        </button>
                      )
                    })}
                  </div>

                  {canResetDecision && (
                    <button
                      type="button"
                      className="post-event-financial-reset-button"
                      disabled={
                        Number(
                          completingFinancialTeamId
                        ) ===
                        Number(
                          report.team_id
                        )
                      }
                      onClick={() =>
                        resetFinancialStatus(
                          report
                        )
                      }
                    >
                      Alterar decisão
                    </button>
                  )}

                  {Number(
                    completingFinancialTeamId
                  ) ===
                    Number(report.team_id) && (
                    <small className="post-event-financial-saving">
                      Salvando situação financeira...
                    </small>
                  )}

                  {reportAccess?.expensesClosed && (
                    <small className="post-event-financial-locked">
                      O financeiro deste evento já foi finalizado.
                    </small>
                  )}

                  {!reportAccess?.expensesClosed &&
                    !canEdit &&
                    report.financial_status ===
                      'pending' && (
                    <small className="post-event-financial-locked">
                      Aguardando o responsável
                      desta equipe.
                    </small>
                  )}

                  {canEdit &&
                    Number(
                      expensesFlowTeamId
                    ) ===
                      Number(
                        report.team_id
                      ) && (
                    <div
                      id={
                        `post-event-expenses-${report.team_id}`
                      }
                      className="post-event-expenses-embedded"
                    >
                      <div className="post-event-expenses-embedded-head">
                        <div>
                          <small>
                            LANÇAMENTOS DA EQUIPE
                          </small>

                          <strong>
                            Gastos deste evento
                          </strong>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpensesFlowTeamId(
                              null
                            )
                          }
                        >
                          Fechar
                        </button>
                      </div>

                      <AdminExpensesPanel
                        mode="embedded"
                        fixedEventId={
                          selectedEventId
                        }
                        fixedTeamId={
                          report.team_id
                        }
                        events={events}
                        teams={teams}
                        access={access}
                      />

                      <button
                        type="button"
                        className="post-event-financial-complete-button"
                        disabled={
                          Number(
                            completingFinancialTeamId
                          ) ===
                          Number(
                            report.team_id
                          )
                        }
                        onClick={() =>
                          completeFinancialStatus(
                            report,
                            'expenses'
                          )
                        }
                      >
                        {returnedForChanges
                          ? '↻ Reenviar para revisão'
                          : '✓ Concluir financeiro'}
                      </button>

                      <small className="post-event-financial-complete-help">
                        Conclua somente depois de
                        registrar todos os gastos
                        desta equipe.
                      </small>
                    </div>
                  )}
                </div>



              </article>
            )
          }
        )}
      </div>


      {reports.length === 0 && (
        <p className="post-event-empty">
          Nenhuma prestação de contas
          disponível para este evento.
        </p>
      )}
    </section>
  )
}


export default AdminPostEventTeamReports
