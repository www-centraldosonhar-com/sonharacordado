import {
  useEffect,
  useState,
} from 'react'

import '../styles/admin.css'
import FinanceExpensesPanel from '../components/FinanceExpensesPanel.jsx'
import FinanceBalancePanel from '../components/FinanceBalancePanel.jsx'
import FinanceRequestsPanel from '../components/FinanceRequestsPanel.jsx'


function formatMoney(
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


function FinancePage({
  user,
  onBack,
  onLogout,
}) {
  const [
    events,
    setEvents,
  ] = useState([])

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState('')

  const [
    summary,
    setSummary,
  ] = useState(null)

  const [
    message,
    setMessage,
  ] = useState('')


  // =====================================================
  // LOAD EVENTS
  // =====================================================

  useEffect(() => {
    let active = true

    async function loadEvents() {
      try {
        const response =
          await fetch(
            '/api/finance?operation=events'
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar os eventos.'
          )
        }

        if (!active) {
          return
        }

        const loaded =
          result.events || []

        setEvents(
          loaded
        )

        if (
          loaded.length > 0
        ) {
          setSelectedEventId(
            String(
              loaded[0].id
            )
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

    loadEvents()

    return () => {
      active = false
    }
  }, [])


  // =====================================================
  // LOAD SUMMARY
  // =====================================================

  useEffect(() => {
    if (!selectedEventId) {
      return
    }

    let active = true

    async function loadSummary() {
      try {
        const params =
          new URLSearchParams({
            operation:
              'summary',

            eventId:
              selectedEventId,
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
            'Não foi possível carregar o balanço.'
          )
        }

        if (active) {
          setSummary(
            result
          )

          setMessage('')
        }
      } catch (error) {
        if (active) {
          setMessage(
            error.message
          )
        }
      }
    }

    loadSummary()

    return () => {
      active = false
    }
  }, [
    selectedEventId,
  ])


  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div>
            <div className="admin-hearts">
              <span className="heart-red">
                ♥
              </span>

              <span className="heart-orange">
                ♥
              </span>

              <span className="heart-blue">
                ♥
              </span>
            </div>

            <p className="admin-kicker">
              CENTRAL DO SONHAR
            </p>

            <h1>
              💰 Financeiro
            </h1>

            <p>
              Oi, {String(user.name || '').trim().split(/\s+/)[0]}! 👋
            </p>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              onClick={onBack}
            >
              🏠 Central
            </button>

            <button
              type="button"
              onClick={onLogout}
            >
              🚪 Sair
            </button>
          </div>
        </div>
      </header>


      <main className="admin-shell">
        <section className="admin-section">
          <p className="admin-eyebrow">
            VISÃO FINANCEIRA
          </p>

          <h2>
            Balanço dos Eventos
          </h2>

          <div className="post-event-team-event-select">
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
                    {' — '}
                    {
                      event.project_name ||
                      'Geral'
                    }
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


          {summary && (
            <>
              <div className="post-event-finance-grid">
                <article>
                  <span>
                    👥 Confirmados
                  </span>

                  <strong>
                    {
                      summary
                        .registrations
                        ?.confirmed || 0
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    💳 Pagantes
                  </span>

                  <strong>
                    {
                      summary
                        .registrations
                        ?.paid || 0
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    🎟️ Gratuidade
                  </span>

                  <strong>
                    {
                      summary
                        .registrations
                        ?.free || 0
                    }
                  </strong>
                </article>

                <article>
                  <span>
                    💚 Arrecadado
                  </span>

                  <strong>
                    {formatMoney(
                      summary
                        .collectedAmount
                    )}
                  </strong>
                </article>

                <article>
                  <span>
                    🧾 Gastos
                  </span>

                  <strong>
                    {formatMoney(
                      summary
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
                  {formatMoney(
                    summary
                      .balanceAmount
                  )}
                </strong>
              </div>


              <div className="post-event-team-expenses">
                <h4>
                  Gastos por equipe
                </h4>

                {summary
                  .expensesByTeam
                  ?.length > 0 ? (
                  summary
                    .expensesByTeam
                    .map(
                      (team) => (
                        <div
                          key={
                            team.id
                          }
                        >
                          <span>
                            {
                              team.name
                            }
                          </span>

                          <strong>
                            {formatMoney(
                              team.amount
                            )}
                          </strong>
                        </div>
                      )
                    )
                ) : (
                  <p className="post-event-empty">
                    Nenhum gasto registrado.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        <FinanceBalancePanel
          events={events}
        />

        <FinanceRequestsPanel
          events={events}
        />

        {summary && selectedEventId && (
          <FinanceExpensesPanel
            eventId={
              selectedEventId
            }
            expensesClosed={
              Boolean(
                summary.expensesClosed
              )
            }
            closedAt={
              summary.closure
                ?.expenses_closed_at
            }
          />
        )}
      </main>
    </div>
  )
}


export default FinancePage
