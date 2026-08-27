import {
  useEffect,
  useMemo,
  useState,
} from 'react'


const CHECK_IN_NAME =
  'Recepção / Check-in de Assistidos'

const CHECK_OUT_NAME =
  'Despedida / Check-out de Assistidos'


function activityName(
  activity
) {
  return String(
    activity?.activity_name ||
    activity?.role_name ||
    activity?.name ||
    ''
  ).trim()
}


function activityEventId(
  activity
) {
  return Number(
    activity?.event_id ||
    activity?.eventId ||
    0
  )
}


async function loadActivityChecklist(
  activity
) {
  if (!activity?.id) {
    return null
  }

  const listParams =
    new URLSearchParams({
      operation:
        'list-activity',

      eventRoleId:
        String(
          activity.id
        ),
    })

  const listResponse =
    await fetch(
      `/api/checklist?${listParams}`
    )

  const listResult =
    await listResponse.json()

  if (!listResponse.ok) {
    throw new Error(
      listResult.error ||
      'Não foi possível carregar a checklist.'
    )
  }

  const checklist =
    (
      listResult.checklists ||
      []
    )[0]

  if (!checklist?.id) {
    return {
      checklist: null,
      items: [],
    }
  }

  const getParams =
    new URLSearchParams({
      operation:
        'get',

      checklistId:
        String(
          checklist.id
        ),
    })

  const getResponse =
    await fetch(
      `/api/checklist?${getParams}`
    )

  const getResult =
    await getResponse.json()

  if (!getResponse.ok) {
    throw new Error(
      getResult.error ||
      'Não foi possível carregar os Assistidos.'
    )
  }

  return {
    checklist:
      getResult.checklist ||
      checklist,

    items:
      getResult.items || [],
  }
}


export default function AdminAssistedEventOverview({
  activity,
  activities = [],
}) {
  const [
    checkInItems,
    setCheckInItems,
  ] =
    useState([])

  const [
    checkOutItems,
    setCheckOutItems,
  ] =
    useState([])

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


  const currentName =
    activityName(
      activity
    )

  const eventId =
    activityEventId(
      activity
    )


  // Renderizamos o painel uma única vez,
  // abaixo da atividade de Check-in.
  const shouldRender =
    currentName ===
      CHECK_IN_NAME


  // O panorama é renderizado dentro da própria
  // atividade de Check-in, então ela já é nossa
  // fonte principal. Não precisamos encontrá-la
  // novamente na coleção de atividades.
  const checkInActivity =
    shouldRender
      ? activity
      : null


  const checkOutActivity =
    useMemo(
      () =>
        activities.find(
          candidate =>
            activityEventId(
              candidate
            ) === eventId &&
            activityName(
              candidate
            ) === CHECK_OUT_NAME
        ) || null,
      [
        activities,
        eventId,
      ]
    )


  useEffect(
    () => {
      if (
        !shouldRender ||
        !checkInActivity
      ) {
        return
      }

      let cancelled = false

      async function load() {
        try {
          setLoading(true)
          setError('')

          const [
            checkIn,
            checkOut,
          ] =
            await Promise.all([
              loadActivityChecklist(
                checkInActivity
              ),

              checkOutActivity
                ? loadActivityChecklist(
                    checkOutActivity
                  )
                : Promise.resolve(
                    null
                  ),
            ])

          if (cancelled) {
            return
          }

          setCheckInItems(
            checkIn?.items || []
          )

          setCheckOutItems(
            checkOut?.items || []
          )
        } catch (
          loadError
        ) {
          if (!cancelled) {
            setError(
              loadError.message
            )
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

      load()

      return () => {
        cancelled = true
      }
    },
    [
      shouldRender,
      checkInActivity,
      checkOutActivity,
    ]
  )


  const overview =
    useMemo(
      () => {
        const checkOutMap =
          new Map(
            checkOutItems.map(
              item => [
                Number(
                  item.assisted_person_id
                ),
                item,
              ]
            )
          )

        const people =
          checkInItems.map(
            item => {
              const assistedId =
                Number(
                  item.assisted_person_id
                )

              const checkout =
                checkOutMap.get(
                  assistedId
                )

              const checkedIn =
                Number(
                  item.checked
                ) === 1

              const checkedOut =
                Number(
                  checkout?.checked
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
                ...item,
                state,
                checkedIn,
                checkedOut,
              }
            }
          )

        return {
          people,

          total:
            people.length,

          checkedIn:
            people.filter(
              person =>
                person.checkedIn
            ).length,

          checkedOut:
            people.filter(
              person =>
                person.checkedOut
            ).length,

          inside:
            people.filter(
              person =>
                person.state ===
                  'inside'
            ).length,
        }
      },
      [
        checkInItems,
        checkOutItems,
      ]
    )


  const visiblePeople =
    useMemo(
      () => {
        if (
          filter === 'all'
        ) {
          return overview.people
        }

        return overview.people.filter(
          person =>
            person.state ===
              filter
        )
      },
      [
        overview,
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


  if (
    !checkInItems.length
  ) {
    return (
      <div className="assisted-event-overview">
        <div className="assisted-event-empty">
          <strong>
            Panorama de Assistidos
          </strong>

          <span>
            Defina o responsável do
            Check-in para preparar a
            lista operacional.
          </span>
        </div>
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
          Atualizado pela checklist
        </span>
      </div>


      <div className="assisted-event-metrics">
        <div>
          <span>
            👥
          </span>

          <strong>
            {overview.total}
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
            {overview.checkedIn}
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
            {overview.inside}
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
            {overview.checkedOut}
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
        {visiblePeople.length === 0 ? (
          <div className="assisted-event-no-results">
            Nenhum Assistido neste grupo.
          </div>
        ) : (
          visiblePeople.map(
            person => (
              <article
                key={
                  person.assisted_person_id ||
                  person.id
                }
                className={
                  `assisted-event-person state-${person.state}`
                }
              >
                <div className="assisted-event-person-main">
                  <strong>
                    {
                      person.full_name ||
                      person.name ||
                      'Assistido'
                    }
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
