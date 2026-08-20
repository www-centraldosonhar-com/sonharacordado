import {
  useEffect,
  useState,
} from 'react'


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


function formatDateTime(value) {
  if (!value) {
    return ''
  }

  return new Date(
    value
  ).toLocaleString(
    'pt-BR'
  )
}


function FinanceExpensesPanel({
  eventId,
  expensesClosed,
  closedAt,
}) {
  const [
    expenses,
    setExpenses,
  ] = useState([])

  const [
    loadedEventId,
    setLoadedEventId,
  ] = useState(null)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    openingReceiptId,
    setOpeningReceiptId,
  ] = useState(null)


  // =====================================================
  // LOAD OFFICIAL EXPENSES
  // =====================================================
  //
  // Só carregamos gastos oficialmente fechados.
  // O backend repete essa verificação por segurança.
  // =====================================================

  useEffect(() => {
    if (
      !eventId ||
      !expensesClosed
    ) {
      return
    }

    let active = true

    async function loadExpenses() {
      try {
        const params =
          new URLSearchParams({
            operation:
              'expenses',

            eventId:
              String(eventId),
          })

        const response =
          await fetch(
            `/api/finance?${params}`
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar os gastos.'
          )
        }

        if (!active) {
          return
        }

        setExpenses(
          result.expenses || []
        )

        setLoadedEventId(
          Number(eventId)
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

    loadExpenses()

    return () => {
      active = false
    }
  }, [
    eventId,
    expensesClosed,
  ])


  // =====================================================
  // OPEN RECEIPT
  // =====================================================

  async function openReceipt(
    expenseId
  ) {
    setOpeningReceiptId(
      Number(expenseId)
    )

    setMessage('')

    try {
      const params =
        new URLSearchParams({
          operation:
            'expense-receipt',

          expenseId:
            String(expenseId),
        })

      const response =
        await fetch(
          `/api/finance?${params}`
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível abrir o comprovante.'
        )
      }

      window.open(
        result.url,
        '_blank',
        'noopener,noreferrer'
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setOpeningReceiptId(
        null
      )
    }
  }


  const officialExpenses =
    expensesClosed &&
    Number(loadedEventId) ===
      Number(eventId)
      ? expenses
      : []


  const groupedExpenses =
    officialExpenses.reduce(
      (groups, expense) => {
        const teamId =
          Number(
            expense.team_id
          )

        if (!groups[teamId]) {
          groups[teamId] = {
            teamId,
            teamName:
              expense.team_name,
            expenses: [],
            total: 0,
          }
        }

        groups[
          teamId
        ].expenses.push(
          expense
        )

        groups[
          teamId
        ].total +=
          Number(
            expense.amount || 0
          )

        return groups
      },
      {}
    )


  const teams =
    Object.values(
      groupedExpenses
    )


  const total =
    officialExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense.amount || 0
        ),
      0
    )


  return (
    <section className="finance-expenses-section">
      <div className="finance-expenses-heading">
        <div>
          <p className="admin-eyebrow">
            DOCUMENTAÇÃO FINANCEIRA
          </p>

          <h2>
            📎 Gastos Recebidos
          </h2>
        </div>

        {expensesClosed && (
          <span className="finance-expenses-status">
            🔒 Fechado
          </span>
        )}
      </div>


      {!expensesClosed ? (
        <div className="finance-expenses-waiting">
          <strong>
            ⏳ Aguardando fechamento
          </strong>

          <p>
            Os gastos deste evento
            ainda estão sendo
            conferidos pelo Admin de
            Projeto.
          </p>

          <p>
            Assim que o fechamento for
            finalizado, os lançamentos
            e comprovantes aparecerão
            aqui automaticamente.
          </p>
        </div>
      ) : (
        <>
          <div className="finance-expenses-summary">
            <div>
              <span>
                Lançamentos
              </span>

              <strong>
                {
                  officialExpenses.length
                }
              </strong>
            </div>

            <div>
              <span>
                Total recebido
              </span>

              <strong>
                {formatMoney(
                  total
                )}
              </strong>
            </div>
          </div>


          {closedAt && (
            <p className="finance-expenses-closed-at">
              Fechamento recebido em{' '}
              {formatDateTime(
                closedAt
              )}
            </p>
          )}


          {teams.map(
            (team) => (
              <article
                className="finance-team-expenses-card"
                key={
                  team.teamId
                }
              >
                <header>
                  <div>
                    <small>
                      EQUIPE
                    </small>

                    <strong>
                      {
                        team.teamName
                      }
                    </strong>
                  </div>

                  <strong className="finance-team-expenses-total">
                    {formatMoney(
                      team.total
                    )}
                  </strong>
                </header>


                <div className="finance-expense-list">
                  {team.expenses.map(
                    (expense) => (
                      <div
                        className="finance-expense-item"
                        key={
                          expense.id
                        }
                      >
                        <div className="finance-expense-main">
                          <strong>
                            {
                              expense.description
                            }
                          </strong>

                          <span>
                            Lançado por{' '}
                            {
                              expense.created_by_name
                            }
                          </span>

                          <small>
                            {formatDateTime(
                              expense.created_at
                            )}
                          </small>
                        </div>


                        <div className="finance-expense-actions">
                          <strong>
                            {formatMoney(
                              expense.amount
                            )}
                          </strong>

                          <button
                            type="button"
                            disabled={
                              Number(
                                openingReceiptId
                              ) ===
                              Number(
                                expense.id
                              )
                            }
                            onClick={() =>
                              openReceipt(
                                expense.id
                              )
                            }
                          >
                            {Number(
                              openingReceiptId
                            ) ===
                            Number(
                              expense.id
                            )
                              ? 'Abrindo...'
                              : '📎 Ver comprovante'}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </article>
            )
          )}


          {officialExpenses.length ===
            0 && (
            <div className="finance-expenses-empty">
              Nenhum gasto ativo foi
              incluído neste fechamento.
            </div>
          )}
        </>
      )}


      {message && (
        <p className="post-event-message">
          {message}
        </p>
      )}

    </section>
  )
}


export default FinanceExpensesPanel
