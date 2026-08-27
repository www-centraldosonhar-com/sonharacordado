import {
  useEffect,
  useMemo,
  useState,
} from 'react'


const CHECK_IN_NAME =
  'Recepção / Check-in de Assistidos'


function getActivityName(
  activity
) {
  return String(
    activity?.activity_name ||
    activity?.role_name ||
    activity?.name ||
    ''
  ).trim()
}


export default function AdminAssistedEventOverview({
  activity,
}) {
  const [
    people,
    setPeople,
  ] =
    useState([])

  const [
    totals,
    setTotals,
  ] =
    useState({
      total: 0,
      checkedIn: 0,
      checkedOut: 0,
      inside: 0,
    })

  const [
    filter,
    setFilter,
  ] =
    useState('all')

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')


  const shouldRender =
    getActivityName(
      activity
    ) === CHECK_IN_NAME


  useEffect(
    () => {
      if (
        !shouldRender ||
        !activity?.id
      ) {
        return
      }

      let cancelled = false


      async function loadOverview(
        silent = false
      ) {
        try {
          if (!silent) {
            setLoading(true)
          }

          const params =
            new URLSearchParams({
              operation:
                'assisted-overview',

              eventRoleId:
                String(
                  activity.id
                ),
            })

          const response =
            await fetch(
              `/api/checklist?${params}`
            )

          const result =
            await response.json()

          if (!response.ok) {
            throw new Error(
              result.error ||
              'Não foi possível carregar o panorama dos Assistidos.'
            )
          }

          if (cancelled) {
            return
          }

          setPeople(
            result.people || []
          )

          setTotals({
            total:
              Number(
                result.totals
                  ?.total || 0
              ),

            checkedIn:
              Number(
                result.totals
                  ?.checkedIn || 0
              ),

            checkedOut:
              Number(
                result.totals
                  ?.checkedOut || 0
              ),

            inside:
              Number(
                result.totals
                  ?.inside || 0
              ),
          })

          setError('')
        } catch (
          loadError
        ) {
          if (!cancelled) {
            setError(
              loadError.message
            )
          }
        } finally {
          if (
            !cancelled &&
            !silent
          ) {
            setLoading(false)
          }
        }
      }


      loadOverview()


      // Atualização quase em tempo real.
      const interval =
        window.setInterval(
          () => {
            loadOverview(true)
          },
          5000
        )


      return () => {
        cancelled = true

        window.clearInterval(
          interval
        )
      }
    },
    [
      shouldRender,
      activity?.id,
    ]
  )


  const normalizedPeople =
    useMemo(
      () =>
        people.map(
          person => {
            const checkedIn =
              Number(
                person.checked_in
              ) === 1

            const checkedOut =
              Number(
                person.checked_out
              ) === 1

            let state =
              'not-arrived'

            if (
              checkedIn &&
              checkedOut
            ) {
              state =
                'left'
            } else if (
              checkedIn
            ) {
              state =
                'inside'
            }

            return {
              ...person,
              checkedIn,
              checkedOut,
              state,
            }
          }
        ),
      [people]
    )


  const visiblePeople =
    useMemo(
      () => {
        if (
          filter === 'all'
        ) {
          return normalizedPeople
        }

        return normalizedPeople.filter(
          person =>
            person.state ===
              filter
        )
      },
      [
        normalizedPeople,
        filter,
      ]
    )


  if (!shouldRender) {
    return null
  }


  if (loading) {
    return (
      <div className="assisted-event-overview assisted-event-loading">
        Carregando panorama dos Assistidos...
      </div>
    )
  }


  if (error) {
    return (
      <div className="assisted-event-overview assisted-event-error">
        {error}
      </div>
    )
  }


  return (
    <section className="assisted-event-overview">
      <div className="assisted-event-overview-head">
        <div>
          <small>
            ACOMPANHAMENTO DO EVENTO
          </small>

          <strong>
            Panorama dos Assistidos
          </strong>
        </div>

        <span>
          Atualização automática
        </span>
      </div>


      <div className="assisted-event-metrics">
        <div>
          <span>
            👥
          </span>

          <strong>
            {totals.total}
          </strong>

          <small>
            Assistidos
          </small>
        </div>


        <div>
          <span>
            ✅
          </span>

          <strong>
            {totals.checkedIn}
          </strong>

          <small>
            Check-in
          </small>
        </div>


        <div>
          <span>
            🧡
          </span>

          <strong>
            {totals.inside}
          </strong>

          <small>
            No evento
          </small>
        </div>


        <div>
          <span>
            🚪
          </span>

          <strong>
            {totals.checkedOut}
          </strong>

          <small>
            Check-out
          </small>
        </div>
      </div>


      <div className="assisted-event-filters">
        {[
          [
            'all',
            'Todos',
          ],

          [
            'not-arrived',
            'Não chegaram',
          ],

          [
            'inside',
            'No evento',
          ],

          [
            'left',
            'Já saíram',
          ],
        ].map(
          (
            [
              value,
              label,
            ]
          ) => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? 'is-active'
                  : ''
              }
              onClick={
                () =>
                  setFilter(
                    value
                  )
              }
            >
              {label}
            </button>
          )
        )}
      </div>


      <div className="assisted-event-people">
        {!visiblePeople.length ? (
          <div className="assisted-event-no-results">
            Nenhum Assistido neste grupo.
          </div>
        ) : (
          visiblePeople.map(
            person => (
              <article
                key={
                  person.assisted_person_id
                }
                className={
                  `assisted-event-person state-${person.state}`
                }
              >
                <div className="assisted-event-person-main">
                  <strong>
                    {person.user_name}
                  </strong>

                  <span>
                    {person.state ===
                      'not-arrived' &&
                      'Ainda não chegou'}

                    {person.state ===
                      'inside' &&
                      'Está no evento'}

                    {person.state ===
                      'left' &&
                      'Já realizou check-out'}
                  </span>
                </div>


                <div className="assisted-event-person-contact">
                  <span>
                    <b>
                      Responsável:
                    </b>{' '}
                    {
                      person.guardian_name ||
                      'Não informado'
                    }
                  </span>

                  <span>
                    {
                      person.guardian_phone ||
                      'Telefone não informado'
                    }
                  </span>
                </div>


                {person.departure_method && (
                  <div className="assisted-event-person-departure">
                    <small>
                      SAÍDA
                    </small>

                    <span>
                      {
                        person.departure_method
                      }
                    </span>
                  </div>
                )}
              </article>
            )
          )
        )}
      </div>
    </section>
  )
}
