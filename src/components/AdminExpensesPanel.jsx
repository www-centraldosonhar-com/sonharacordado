import {
  useEffect,
  useMemo,
  useState,
} from 'react'


// =========================================================
// MONEY FORMAT
// =========================================================

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


// =========================================================
// DATE FORMAT
// =========================================================

function formatDateTime(value) {
  if (!value) {
    return ''
  }

  const date =
    new Date(value)

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    }
  ).format(date)
}


function formatDate(value) {
  if (!value) {
    return ''
  }

  const raw =
    String(value).slice(0, 10)

  const [
    year,
    month,
    day,
  ] = raw.split('-')

  if (
    !year ||
    !month ||
    !day
  ) {
    return raw
  }

  return `${day}/${month}/${year}`
}


function readExpenseDraft(key) {
  if (
    typeof window === 'undefined'
  ) {
    return {}
  }

  try {
    return JSON.parse(
      window.localStorage.getItem(
        key
      ) || '{}'
    )
  } catch {
    return {}
  }
}


// =========================================================
// COMPONENT
// =========================================================

function AdminExpensesPanel({
  events = [],
  teams = [],
  access,
  mode = 'normal',
  fixedEventId = '',
  fixedTeamId = '',
  draftOwnerKey = 'default',
}) {

  const isEmbedded =
    mode === 'embedded'

  const draftKey =
    `central-sonhar:draft:expense:${draftOwnerKey}:${mode}:${fixedEventId || 'event'}:${fixedTeamId || 'team'}`

  const initialDraft =
    readExpenseDraft(draftKey)

  const [
    cancellingExpenseId,
    setCancellingExpenseId,
  ] = useState(null)

  const [
    cancellationReason,
    setCancellationReason,
  ] = useState('')

  const [
    expenses,
    setExpenses,
  ] = useState([])

  const [
    eventId,
    setEventId,
  ] = useState(
    initialDraft.eventId || ''
  )

  const [
    teamId,
    setTeamId,
  ] = useState(
    initialDraft.teamId || ''
  )

  const [
    description,
    setDescription,
  ] = useState(
    initialDraft.description || ''
  )

  const [
    amount,
    setAmount,
  ] = useState(
    initialDraft.amount || ''
  )

  const [
    receipt,
    setReceipt,
  ] = useState(null)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    loadingExpenses,
    setLoadingExpenses,
  ] = useState(true)


  // =====================================================
  // ACCESS
  // =====================================================

  const scope =
    access?.scope || null

  const canCreate =
    scope === 'global' ||
    scope === 'team'

  // =====================================================
  // TEAM OPTIONS
  // =====================================================
  //
  // Global:
  // pode escolher qualquer equipe.
  //
  // Team Admin:
  // só vê suas próprias equipes.
  //
  // Project Admin:
  // não cria gastos nesta versão.
  // =====================================================

  const availableTeams =
    useMemo(() => {
      if (scope === 'global') {
        return teams
      }

      if (scope === 'team') {
        const adminTeams =
          access?.teams || []

        const allowedIds =
          new Set(
            adminTeams.map(
              (team) =>
                Number(team.id)
            )
          )

        return teams.filter(
          (team) =>
            allowedIds.has(
              Number(team.id)
            )
        )
      }

      return []
    }, [
      scope,
      teams,
      access?.teams,
    ])


  // =====================================================
  // EFFECTIVE TEAM
  // =====================================================
  //
  // Quando existe apenas uma equipe disponível,
  // usamos ela como valor padrão sem precisar
  // disparar setState dentro de useEffect.
  // =====================================================

  const effectiveEventId =
    isEmbedded
      ? (
          fixedEventId
            ? String(fixedEventId)
            : ''
        )
      : eventId

  const effectiveTeamId =
    isEmbedded
      ? (
          fixedTeamId
            ? String(fixedTeamId)
            : ''
        )
      : (
          teamId ||
          (
            availableTeams.length === 1
              ? String(
                  availableTeams[0].id
                )
              : ''
          )
        )


  useEffect(() => {
    if (
      typeof window === 'undefined'
    ) {
      return
    }

    const payload = {
      eventId:
        isEmbedded ? '' : eventId,
      teamId:
        isEmbedded ? '' : teamId,
      description,
      amount,
    }

    const hasDraft =
      Object.values(payload).some(
        (value) =>
          String(value || '').trim()
      )

    if (!hasDraft) {
      window.localStorage.removeItem(
        draftKey
      )
      return
    }

    window.localStorage.setItem(
      draftKey,
      JSON.stringify(payload)
    )
  }, [
    amount,
    description,
    draftKey,
    eventId,
    isEmbedded,
    teamId,
  ])


  // =====================================================
          
            async function loadExpenses() {
              setLoadingExpenses(true)
          
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
          
                setExpenses(
                  result.expenses || []
                )
              } catch (error) {
                setMessage(
                  error.message
                )
              } finally {
                setLoadingExpenses(false)
              }
            }
          
          
            useEffect(() => {
              let active = true
          
              fetch(
                '/api/admin?action=expenses&operation=list'
              )
                .then(async (response) => {
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
                })
                .catch((error) => {
                  if (active) {
                    setMessage(
                      error.message
                    )
                  }
                })
                .finally(() => {
                  if (active) {
                    setLoadingExpenses(
                      false
                    )
                  }
                })
          
              return () => {
                active = false
              }
            }, [])
          
          
            // =====================================================
            // GROUP EXPENSES BY EVENT
            // =====================================================

  // =====================================================
  // EXPENSES VISÍVEIS
  // =====================================================
  // No painel normal mostramos todo o escopo permitido.
  // No Pós-Evento mostramos somente os gastos da equipe
  // e do evento atualmente sendo fechados.
  // =====================================================

  const visibleExpenses =
    useMemo(() => {
      if (!isEmbedded) {
        return expenses
      }

      return expenses.filter(
        (expense) =>
          Number(
            expense.event_id
          ) ===
            Number(
              effectiveEventId
            ) &&
          Number(
            expense.team_id
          ) ===
            Number(
              effectiveTeamId
            )
      )
    }, [
      expenses,
      isEmbedded,
      effectiveEventId,
      effectiveTeamId,
    ])


  const expenseGroups =
    useMemo(() => {
      const map =
        new Map()

      for (
        const expense
        of visibleExpenses
      ) {
        const id =
          Number(
            expense.event_id
          )

        if (!map.has(id)) {
          map.set(
            id,
            {
              eventId:
                id,

              eventName:
                expense.event_name,

              eventDate:
                expense.event_date,

              projectName:
                expense.project_name,

              expenses: [],
            }
          )
        }

        map
          .get(id)
          .expenses
          .push(expense)
      }

      return Array.from(
        map.values()
      )
    }, [visibleExpenses])


  // =====================================================
  // GASTOS ATIVOS VISÍVEIS
  // =====================================================
  // Mantemos visibleExpenses para o histórico completo.
  // Este array é usado somente para contador e total
  // financeiro atual.
  // =====================================================

  const activeVisibleExpenses =
    useMemo(
      () =>
        visibleExpenses.filter(
          (expense) =>
            Number(
              expense.active
            ) === 1
        ),
      [
        visibleExpenses,
      ]
    )


  // =====================================================
  // TOTAL
  // =====================================================

  const totalExpenses =
    activeVisibleExpenses.reduce(
      (
        total,
        expense
      ) => {
        if (
          Number(
            expense.active
          ) !== 1
        ) {
          return total
        }

        return (
          total +
          Number(
            expense.amount || 0
          )
        )
      },
      0
    )


  // =====================================================
  // UPLOAD RECEIPT
  // =====================================================

  async function uploadReceipt(
    file
  ) {
    const prepareResponse =
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
                'prepare-receipt',

              eventId:
                Number(effectiveEventId),

              teamId:
                Number(effectiveTeamId),

              contentType:
                file.type,
            }),
        }
      )

    const prepareResult =
      await prepareResponse.json()

    if (!prepareResponse.ok) {
      throw new Error(
        prepareResult.error ||
        'Não foi possível preparar o comprovante.'
      )
    }


    // ===================================================
    // DIRECT UPLOAD TO SUPABASE
    // ===================================================

    const formData =
      new FormData()

    formData.append(
      'file',
      file
    )

    const uploadResponse =
      await fetch(
        prepareResult.signedUrl,
        {
          method: 'PUT',
          body: formData,
        }
      )

    if (!uploadResponse.ok) {
      throw new Error(
        'Não foi possível enviar o comprovante.'
      )
    }

    return (
      prepareResult.storagePath
    )
  }


  // =====================================================
  // CREATE EXPENSE
  // =====================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    setMessage('')

    if (
      !effectiveEventId ||
      !effectiveTeamId ||
      !description.trim() ||
      !amount ||
      !receipt
    ) {
      setMessage(
        'Preencha os dados e anexe o comprovante.'
      )

      return
    }

    const numericAmount =
      Number(
        String(amount)
          .replace(',', '.')
      )

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount < 0
    ) {
      setMessage(
        'Informe um valor válido.'
      )

      return
    }

    setLoading(true)

    try {
      // -----------------------------------------------
      // 1. Envia o arquivo privado
      // -----------------------------------------------

      const storagePath =
        await uploadReceipt(
          receipt
        )


      // -----------------------------------------------
      // 2. Registra o gasto no Neon
      // -----------------------------------------------

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
                  'create',

                eventId:
                  Number(effectiveEventId),

                teamId:
                  Number(effectiveTeamId),

                description:
                  description.trim(),

                amount:
                  numericAmount,

                storagePath,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível registrar o gasto.'
        )
      }

      setDescription('')
      setAmount('')
      setReceipt(null)

      if (
        typeof window !== 'undefined'
      ) {
        window.localStorage.removeItem(
          draftKey
        )
      }

      // Limpa visualmente o input.
      const input =
        document.getElementById(
          'team-expense-receipt'
        )

      if (input) {
        input.value = ''
      }

      setMessage(
        result.message ||
        'Gasto registrado! 🧾✅'
      )

      await loadExpenses()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setLoading(false)
    }
  }


  // =====================================================
  // OPEN RECEIPT
  // =====================================================

  function openCancellation(
    expense
  ) {
    setMessage('')

    setCancellingExpenseId(
      expense.id
    )

    setCancellationReason('')
  }


  function closeCancellation() {
    setCancellingExpenseId(null)
    setCancellationReason('')
  }


  async function cancelExpense(
    expense
  ) {
    setMessage('')

    const reason =
      cancellationReason.trim()

    if (!reason) {
      setMessage(
        'Informe o motivo do cancelamento.'
      )

      return
    }

    setLoading(true)

    try {
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
                  'cancel',

                expenseId:
                  expense.id,

                cancellationReason:
                  reason,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível cancelar o lançamento.'
        )
      }

      setMessage(
        result.message ||
        'Lançamento cancelado. 🧾❌'
      )

      closeCancellation()

      await loadExpenses()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setLoading(false)
    }
  }


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
        '<p style="font-family:sans-serif;padding:20px">Abrindo comprovante...</p>'

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


  return (
    <section
      id={
        isEmbedded
          ? undefined
          : 'gastos'
      }
      className={[
        'admin-section',
        'admin-expenses-section',
        isEmbedded
          ? 'is-embedded'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!isEmbedded && (
        <>
          <p className="admin-eyebrow admin-orange">
            PRESTAÇÃO DE CONTAS
          </p>

          <h2>
            🧾 Gastos do Evento
          </h2>

          <p className="admin-form-help">
            Registre despesas das equipes e mantenha
            os comprovantes organizados por evento.
          </p>
        </>
      )}


      {/* =================================================
          SUMMARY
         ================================================= */}

      <div
        className={[
          'expense-summary',
          isEmbedded
            ? 'is-embedded'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <article>
          <span>🧾</span>

          <div>
            <small>
              Gastos ativos
            </small>

            <strong>
              {activeVisibleExpenses.length}
            </strong>
          </div>
        </article>

        <article>
          <span>💸</span>

          <div>
            <small>
              Total ativo
            </small>

            <strong>
              {formatMoney(
                totalExpenses
              )}
            </strong>
          </div>
        </article>
      </div>


      {/* =================================================
          CREATE
         ================================================= */}

      {canCreate && (
        <form
          className="expense-create-card"
          onSubmit={handleSubmit}
        >
          <div className="expense-create-heading">
            <div>
              <strong>
                ➕ Registrar gasto
              </strong>

              <small>
                Rascunho salvo automaticamente · comprovante precisa ser reanexado após recarregar
              </small>
            </div>
          </div>


          <div className="expense-form-grid">
            {!isEmbedded && (
              <>
            <label>
              <span>
                Evento
              </span>

              <select
                value={eventId}
                onChange={(
                  event
                ) =>
                  setEventId(
                    event.target.value
                  )
                }
                required
              >
                <option value="">
                  Selecione
                </option>

                {events.map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {item.name}
                      {' — '}
                      {formatDate(
                        item.event_date
                      )}
                    </option>
                  )
                )}
              </select>
            </label>


            <label>
              <span>
                Equipe
              </span>

              <select
                value={effectiveTeamId}
                onChange={(
                  event
                ) =>
                  setTeamId(
                    event.target.value
                  )
                }
                required
              >
                <option value="">
                  Selecione
                </option>

                {availableTeams.map(
                  (team) => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                    >
                      {team.name}
                    </option>
                  )
                )}
              </select>
            </label>


              </>
            )}

            <label className="expense-description-field">
              <span>
                O que foi comprado?
              </span>

              <input
                type="text"
                value={
                  description
                }
                maxLength={180}
                placeholder="Ex.: materiais para oficina"
                onChange={(
                  event
                ) =>
                  setDescription(
                    event.target.value
                  )
                }
                required
              />
            </label>


            <label>
              <span>
                Valor
              </span>

              <div className="expense-money-input">
                <strong>
                  R$
                </strong>

                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  placeholder="0,00"
                  onChange={(
                    event
                  ) =>
                    setAmount(
                      event.target.value
                        .replace(
                          /[^0-9,.]/g,
                          ''
                        )
                    )
                  }
                  required
                />
              </div>
            </label>


            <label className="expense-receipt-field">
              <span>
                Comprovante
              </span>

              <input
                id="team-expense-receipt"
                type="file"
                accept="
                  image/jpeg,
                  image/png,
                  image/webp,
                  application/pdf
                "
                onChange={(
                  event
                ) =>
                  setReceipt(
                    event.target
                      .files?.[0] ||
                      null
                  )
                }
                required
              />

              {receipt && (
                <small>
                  📎 {receipt.name}
                </small>
              )}
            </label>
          </div>


          <button
            type="submit"
            className="expense-submit-button"
            disabled={loading}
          >
            {loading
              ? 'Enviando...'
              : '🧾 Registrar gasto'}
          </button>
        </form>
      )}


      {/* =================================================
          PROJECT ADMIN INFO
         ================================================= */}

      {!canCreate &&
        scope === 'project' && (
          <div className="expense-readonly-note">
            👀 Você está visualizando os gastos
            registrados pelas equipes do seu projeto.
          </div>
        )}


      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}


      {/* =================================================
          HISTORY
         ================================================= */}

      <div className="expense-history">
        <div className="expense-history-heading">
          <strong>
            Histórico
          </strong>

          <small>
            {visibleExpenses.length}
            {' '}
            lançamento
            {visibleExpenses.length !== 1
              ? 's'
              : ''}
          </small>
        </div>


        {loadingExpenses ? (
          <div className="empty-state">
            Carregando gastos...
          </div>
        ) : expenseGroups.length === 0 ? (
          <div className="empty-state">
            Nenhum gasto registrado ainda.
          </div>
        ) : (
          expenseGroups.map(
            (group) => {
              const eventTotal =
                group.expenses.reduce(
                  (
                    total,
                    expense
                  ) => {
                    if (
                      Number(
                        expense.active
                      ) !== 1
                    ) {
                      return total
                    }

                    return (
                      total +
                      Number(
                        expense.amount ||
                        0
                      )
                    )
                  },
                  0
                )

              const activeExpenses =
                group.expenses.filter(
                  (expense) =>
                    Number(
                      expense.active
                    ) === 1
                )

              const cancelledExpenses =
                group.expenses.filter(
                  (expense) =>
                    Number(
                      expense.active
                    ) !== 1
                )

              const teamSummary =
                Object.values(
                  activeExpenses.reduce(
                    (
                      teams,
                      expense
                    ) => {
                      const teamName =
                        expense.team_name ||
                        'Sem equipe'

                      if (!teams[teamName]) {
                        teams[teamName] = {
                          name:
                            teamName,
                          total:
                            0,
                          count:
                            0,
                        }
                      }

                      teams[teamName].total +=
                        Number(
                          expense.amount ||
                          0
                        )

                      teams[teamName].count +=
                        1

                      return teams
                    },
                    {}
                  )
                )
                .sort(
                  (a, b) =>
                    b.total -
                    a.total
                )

              return (
                <details
                  key={
                    group.eventId
                  }
                  className="expense-event-card expense-event-collapsible"
                >
                  <summary className="expense-event-header expense-event-summary">
                    <div>
                      <strong>
                        {
                          group.eventName
                        }
                      </strong>

                      <small>
                        📅{' '}
                        {formatDate(
                          group.eventDate
                        )}

                        {group.projectName
                          ? ` · ${group.projectName}`
                          : ''}
                      </small>
                    </div>

                    <span>
                      {formatMoney(
                        eventTotal
                      )}
                    </span>
                  </summary>


                  <div className="expense-event-overview">
                    <div className="expense-event-overview-stats">
                      <div className="is-total">
                        <small>
                          TOTAL ATIVO
                        </small>

                        <strong>
                          {formatMoney(
                            eventTotal
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          LANÇAMENTOS
                        </small>

                        <strong>
                          {
                            activeExpenses.length
                          }
                        </strong>
                      </div>

                      <div>
                        <small>
                          CANCELADOS
                        </small>

                        <strong>
                          {
                            cancelledExpenses.length
                          }
                        </strong>
                      </div>

                      <div>
                        <small>
                          EQUIPES
                        </small>

                        <strong>
                          {
                            teamSummary.length
                          }
                        </strong>
                      </div>
                    </div>

                    {teamSummary.length > 0 && (
                      <div className="expense-team-summary">
                        <div className="expense-team-summary-head">
                          <small>
                            GASTOS POR EQUIPE
                          </small>
                        </div>

                        <div className="expense-team-summary-list">
                          {teamSummary.map(
                            (team) => (
                              <div
                                key={team.name}
                                className="expense-team-summary-row"
                              >
                                <div>
                                  <strong>
                                    {team.name}
                                  </strong>

                                  <small>
                                    {team.count}
                                    {' '}
                                    lançamento
                                    {team.count !== 1
                                      ? 's'
                                      : ''}
                                  </small>
                                </div>

                                <strong>
                                  {formatMoney(
                                    team.total
                                  )}
                                </strong>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>


                  <div className="expense-list">
                    {group.expenses.map(
                      (expense) => (
                        <div
                          key={
                            expense.id
                          }
                          className={
                            `expense-row ${
                              Number(
                                expense.active
                              ) !== 1
                                ? 'expense-row-cancelled'
                                : ''
                            }`
                          }
                        >
                          <div className="expense-row-main">
                            {Number(
                              expense.active
                            ) !== 1 && (
                              <span className="expense-cancelled-badge">
                                ❌ CANCELADO
                              </span>
                            )}

                            <strong className="expense-cancellable-text">
                              {
                                expense.description
                              }
                            </strong>

                            <small>
                              {
                                expense.team_name
                              }
                              {' · '}
                              lançado por{' '}
                              {
                                expense.created_by_name
                              }
                            </small>

                            {Number(
                              expense.active
                            ) !== 1 && (
                              <div className="expense-cancellation-info">
                                <strong>
                                  Motivo:
                                </strong>
                                {' '}
                                {
                                  expense.cancellation_reason ||
                                  'Não informado'
                                }

                                {expense.cancelled_by_name && (
                                  <>
                                    <br />

                                    <span>
                                      Cancelado por{' '}
                                      {
                                        expense.cancelled_by_name
                                      }

                                      {expense.cancelled_at
                                        ? ` · ${formatDateTime(
                                            expense.cancelled_at
                                          )}`
                                        : ''}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <strong
                            className="expense-row-value expense-cancellable-text"
                          >
                            {formatMoney(
                              expense.amount
                            )}
                          </strong>

                          <div className="expense-row-actions">
                            {expense.receipt_path && (
                              <button
                                type="button"
                                className="expense-receipt-button"
                                onClick={() =>
                                  openReceipt(
                                    expense
                                  )
                                }
                              >
                                📎 Ver
                              </button>
                            )}

                            {canCreate &&
                              Number(
                                expense.active
                              ) === 1 && (
                              <button
                                type="button"
                                className="expense-cancel-button"
                                disabled={loading}
                                onClick={() =>
                                  openCancellation(
                                    expense
                                  )
                                }
                              >
                                ❌ Cancelar
                              </button>
                            )}
                          </div>

                          {cancellingExpenseId ===
                            expense.id && (
                            <div className="expense-cancellation-editor">
                              <div className="expense-cancellation-editor-head">
                                <div>
                                  <small>
                                    CANCELAR LANÇAMENTO
                                  </small>

                                  <strong>
                                    Informe o motivo
                                  </strong>
                                </div>

                                <span>
                                  R$ {
                                    Number(
                                      expense.amount ||
                                      0
                                    )
                                      .toFixed(2)
                                      .replace('.', ',')
                                  }
                                </span>
                              </div>

                              <p>
                                O lançamento continuará
                                no histórico, mas deixará
                                de entrar nos totais.
                              </p>

                              <textarea
                                value={cancellationReason}
                                onChange={(event) =>
                                  setCancellationReason(
                                    event.target.value
                                  )
                                }
                                placeholder="Ex.: lançamento duplicado, valor incorreto..."
                                rows={3}
                                autoFocus
                              />

                              <div className="expense-cancellation-editor-actions">
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={
                                    closeCancellation
                                  }
                                >
                                  Voltar
                                </button>

                                <button
                                  type="button"
                                  className="is-danger"
                                  disabled={
                                    loading ||
                                    !cancellationReason.trim()
                                  }
                                  onClick={() =>
                                    cancelExpense(
                                      expense
                                    )
                                  }
                                >
                                  {loading
                                    ? 'Cancelando...'
                                    : 'Confirmar cancelamento'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </details>
              )
            }
          )
        )}
      </div>
    </section>
  )
}

export default AdminExpensesPanel
