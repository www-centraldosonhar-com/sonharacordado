import { useMemo, useState } from 'react'


function formatProjectName(name) {
  return name || 'Sem projeto'
}


function PersonCheck({ active, label }) {
  return (
    <span
      className={
        active
          ? 'presence-history-check is-ok'
          : 'presence-history-check is-missing'
      }
    >
      {active ? '✓' : '—'} {label}
    </span>
  )
}


export default function EventPresenceHistoryPanel({
  eventId,
}) {
  const [opened, setOpened] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)


  async function loadSummary() {
    if (data || loading) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        operation: 'event-history-summary',
        eventId: String(eventId),
      })

      const response = await fetch(
        `/api/checklist?${params.toString()}`
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error ||
            'Não foi possível carregar o resumo de presença.'
        )
      }

      setData(payload)
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível carregar o resumo de presença.'
      )
    } finally {
      setLoading(false)
    }
  }


  function handleToggle() {
    const nextOpened = !opened
    setOpened(nextOpened)

    if (nextOpened) {
      loadSummary()
    }
  }


  const volunteerGroups = useMemo(() => {
    if (!data) {
      return []
    }

    const groups = new Map()

    for (const person of data.volunteers?.people || []) {
      const projectName =
        formatProjectName(person.projectName)

      if (!groups.has(projectName)) {
        groups.set(projectName, [])
      }

      groups.get(projectName).push(person)
    }

    return [...groups.entries()]
      .map(([projectName, people]) => ({
        projectName,
        people,
      }))
      .sort((a, b) =>
        a.projectName.localeCompare(
          b.projectName,
          'pt-BR'
        )
      )
  }, [data])


  const hostProjectName =
    data?.event?.projectName || null

  const hostGroup =
    hostProjectName
      ? volunteerGroups.find(
          (group) =>
            group.projectName === hostProjectName
        )
      : null

  const visitorGroups =
    hostProjectName
      ? volunteerGroups.filter(
          (group) =>
            group.projectName !== hostProjectName
        )
      : volunteerGroups


  return (
    <section className="presence-history">
      <button
        type="button"
        className="presence-history-trigger"
        onClick={handleToggle}
        aria-expanded={opened}
      >
        <span className="presence-history-trigger-copy">
          <strong>📋 Resumo de presença</strong>
          <small>
            Presença registrada nas checklists
          </small>
        </span>

        <span className="presence-history-trigger-arrow">
          {opened ? '⌃' : '⌄'}
        </span>
      </button>

      {opened && (
        <div className="presence-history-body">
          {loading && (
            <div className="presence-history-state">
              Carregando presença...
            </div>
          )}

          {!loading && error && (
            <div className="presence-history-state presence-history-error">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              <div className="presence-history-totals">
                <div>
                  <strong>
                    🙋 {data.volunteers?.total || 0}
                  </strong>
                  <span>
                    voluntários presentes
                  </span>
                </div>

                <div>
                  <strong>
                    👧 {data.assisted?.checkedIn || 0}
                  </strong>
                  <span>
                    assistidos presentes
                  </span>
                </div>
              </div>


              <div className="presence-history-block">
                <div className="presence-history-title">
                  <div>
                    <strong>🙋 Voluntários</strong>
                    <span>
                      {data.volunteers?.total || 0}{' '}
                      presentes
                    </span>
                  </div>
                </div>

                {(data.volunteers?.total || 0) === 0 ? (
                  <div className="presence-history-empty">
                    Nenhuma presença de voluntário
                    registrada.
                  </div>
                ) : (
                  <>
                    {hostGroup && (
                      <div className="presence-history-project">
                        <div className="presence-history-project-heading">
                          <div>
                            <strong>
                              🏠 {hostGroup.projectName}
                            </strong>
                            <span>
                              Projeto anfitrião
                            </span>
                          </div>

                          <b>
                            {hostGroup.people.length}
                          </b>
                        </div>

                        <div className="presence-history-names">
                          {hostGroup.people.map(
                            (person) => (
                              <div
                                key={`host-${person.userId}`}
                                className="presence-history-name"
                              >
                                <span>✓</span>
                                <strong>
                                  {person.name}
                                </strong>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}


                    {visitorGroups.length > 0 && (
                      <div className="presence-history-visitors">
                        {hostProjectName && (
                          <div className="presence-history-subtitle">
                            👋 Visitantes de outros projetos
                          </div>
                        )}

                        {visitorGroups.map(
                          (group) => (
                            <div
                              key={group.projectName}
                              className="presence-history-project"
                            >
                              <div className="presence-history-project-heading">
                                <strong>
                                  {group.projectName}
                                </strong>

                                <b>
                                  {group.people.length}
                                </b>
                              </div>

                              <div className="presence-history-names">
                                {group.people.map(
                                  (person) => (
                                    <div
                                      key={`${group.projectName}-${person.userId}`}
                                      className="presence-history-name"
                                    >
                                      <span>✓</span>
                                      <strong>
                                        {person.name}
                                      </strong>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>


              {(data.assisted?.checkedIn || 0) > 0 && (
                <div className="presence-history-block">
                  <div className="presence-history-title">
                    <div>
                      <strong>👧 Assistidos</strong>
                      <span>
                        {data.assisted.checkedIn}{' '}
                        presentes
                      </span>
                    </div>
                  </div>

                  <div className="presence-history-assisted-stats">
                    <span>
                      ✓ {data.assisted.checkedIn}{' '}
                      entradas
                    </span>

                    <span>
                      ✓ {data.assisted.checkedOut}{' '}
                      saídas
                    </span>

                    <span
                      className={
                        data.assisted.inside > 0
                          ? 'has-pending'
                          : ''
                      }
                    >
                      {data.assisted.inside > 0
                        ? '⚠️'
                        : '✓'}{' '}
                      {data.assisted.inside} sem saída
                    </span>
                  </div>

                  <div className="presence-history-assisted-list">
                    {data.assisted.people.map(
                      (person) => (
                        <div
                          key={person.id}
                          className="presence-history-assisted-person"
                        >
                          <div className="presence-history-assisted-name">
                            {person.childNumber !== null && (
                              <span>
                                #{String(
                                  person.childNumber
                                ).padStart(2, '0')}
                              </span>
                            )}

                            <strong>
                              {person.name}
                            </strong>
                          </div>

                          <div className="presence-history-assisted-checks">
                            <PersonCheck
                              active={person.checkedIn}
                              label="Entrada"
                            />

                            <PersonCheck
                              active={person.checkedOut}
                              label="Saída"
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
