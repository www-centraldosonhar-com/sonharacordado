import {
  useMemo,
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


function FinanceBalancePanel({
  events = [],
}) {
  const [
    projectFilter,
    setProjectFilter,
  ] = useState('all')

  const [
    startDate,
    setStartDate,
  ] = useState('')

  const [
    endDate,
    setEndDate,
  ] = useState('')

  const [
    selectedEventIds,
    setSelectedEventIds,
  ] = useState([])

  const [
    balance,
    setBalance,
  ] = useState(null)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)


  const projectNames =
    useMemo(
      () =>
        [
          ...new Set(
            events
              .map(
                (event) =>
                  event.project_name
              )
              .filter(Boolean)
          ),
        ],
      [events]
    )


  const filteredEvents =
    useMemo(
      () =>
        events.filter(
          (event) => {
            if (
              projectFilter !==
                'all' &&
              event.project_name !==
                projectFilter
            ) {
              return false
            }

            if (
              startDate &&
              event.event_date <
                startDate
            ) {
              return false
            }

            if (
              endDate &&
              event.event_date >
                endDate
            ) {
              return false
            }

            return true
          }
        ),
      [
        events,
        projectFilter,
        startDate,
        endDate,
      ]
    )


  function toggleEvent(
    eventId
  ) {
    const numericId =
      Number(eventId)

    setSelectedEventIds(
      (current) =>
        current.includes(
          numericId
        )
          ? current.filter(
              (id) =>
                id !==
                numericId
            )
          : [
              ...current,
              numericId,
            ]
    )

    setBalance(null)
  }


  function selectAllFiltered() {
    setSelectedEventIds(
      filteredEvents.map(
        (event) =>
          Number(event.id)
      )
    )

    setBalance(null)
  }


  function clearSelection() {
    setSelectedEventIds([])
    setBalance(null)
  }


  async function calculateBalance() {
    if (
      selectedEventIds.length === 0
    ) {
      setMessage(
        'Selecione pelo menos um evento.'
      )

      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const params =
        new URLSearchParams({
          operation:
            'balance',

          eventIds:
            selectedEventIds.join(
              ','
            ),
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
          'Não foi possível calcular o balanço.'
        )
      }

      setBalance(result)
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <section className="admin-section finance-balance-panel">
      <p className="admin-eyebrow">
        VISÃO CONSOLIDADA
      </p>

      <h2>
        📊 Balanço Consolidado
      </h2>

      <p className="finance-balance-intro">
        Combine eventos e períodos para
        analisar receitas, gastos oficiais
        e saldo da ONG.
      </p>


      <div className="finance-balance-filters">
        <div>
          <label>
            Projeto
          </label>

          <select
            value={
              projectFilter
            }
            onChange={
              (event) => {
                setProjectFilter(
                  event.target.value
                )

                setBalance(null)
              }
            }
          >
            <option value="all">
              Todos os projetos
            </option>

            {projectNames.map(
              (projectName) => (
                <option
                  key={
                    projectName
                  }
                  value={
                    projectName
                  }
                >
                  {projectName}
                </option>
              )
            )}
          </select>
        </div>


        <div>
          <label>
            De
          </label>

          <input
            type="date"
            value={startDate}
            onChange={
              (event) => {
                setStartDate(
                  event.target.value
                )

                setBalance(null)
              }
            }
          />
        </div>


        <div>
          <label>
            Até
          </label>

          <input
            type="date"
            value={endDate}
            onChange={
              (event) => {
                setEndDate(
                  event.target.value
                )

                setBalance(null)
              }
            }
          />
        </div>
      </div>


      <div className="finance-balance-selection-actions">
        <button
          type="button"
          onClick={
            selectAllFiltered
          }
        >
          Selecionar filtrados
        </button>

        <button
          type="button"
          onClick={
            clearSelection
          }
        >
          Limpar seleção
        </button>
      </div>


      <div className="finance-balance-event-list">
        {filteredEvents.map(
          (event) => {
            const checked =
              selectedEventIds.includes(
                Number(
                  event.id
                )
              )

            return (
              <label
                className={
                  checked
                    ? 'finance-balance-event is-selected'
                    : 'finance-balance-event'
                }
                key={
                  event.id
                }
              >
                <input
                  type="checkbox"
                  checked={
                    checked
                  }
                  onChange={() =>
                    toggleEvent(
                      event.id
                    )
                  }
                />

                <span>
                  <strong>
                    {event.name}
                  </strong>

                  <small>
                    {
                      event.project_name ||
                      'Evento geral'
                    }
                    {' · '}
                    {
                      event.event_date
                    }
                  </small>
                </span>
              </label>
            )
          }
        )}
      </div>


      {filteredEvents.length ===
        0 && (
        <p className="finance-balance-empty">
          Nenhum evento encontrado
          para os filtros escolhidos.
        </p>
      )}


      <button
        type="button"
        className="finance-balance-calculate"
        disabled={
          isLoading ||
          selectedEventIds.length ===
            0
        }
        onClick={
          calculateBalance
        }
      >
        {isLoading
          ? 'Calculando...'
          : `📊 Calcular balanço (${selectedEventIds.length})`}
      </button>


      {message && (
        <p className="post-event-message">
          {message}
        </p>
      )}


      {balance && (
        <div className="finance-balance-result">
          <div className="finance-balance-result-heading">
            <div>
              <small>
                RESULTADO
              </small>

              <strong>
                {
                  balance.eventCount
                }{' '}
                evento
                {
                  balance.eventCount !==
                  1
                    ? 's'
                    : ''
                }
              </strong>
            </div>
          </div>


          <div className="finance-balance-metrics">
            <article>
              <span>
                💚 Receitas
              </span>

              <strong>
                {formatMoney(
                  balance
                    .collectedAmount
                )}
              </strong>
            </article>

            <article>
              <span>
                🧾 Gastos oficiais
              </span>

              <strong>
                {formatMoney(
                  balance
                    .expensesAmount
                )}
              </strong>
            </article>

            <article className="finance-balance-highlight">
              <span>
                💰 Saldo
              </span>

              <strong>
                {formatMoney(
                  balance
                    .balanceAmount
                )}
              </strong>
            </article>
          </div>


          <div className="finance-balance-registration-metrics">
            <span>
              👥{' '}
              {
                balance
                  .registrations
                  ?.confirmed || 0
              } confirmados
            </span>

            <span>
              💳{' '}
              {
                balance
                  .registrations
                  ?.paid || 0
              } pagantes
            </span>

            <span>
              🎟️{' '}
              {
                balance
                  .registrations
                  ?.free || 0
              } gratuidades
            </span>
          </div>


          <div className="finance-balance-event-results">
            {balance.events?.map(
              (event) => (
                <div
                  key={
                    event.id
                  }
                >
                  <span>
                    <strong>
                      {event.name}
                    </strong>

                    <small>
                      {
                        event.projectName ||
                        'Evento geral'
                      }
                    </small>
                  </span>

                  <span>
                    {formatMoney(
                      event.balanceAmount
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </section>
  )
}


export default FinanceBalancePanel
