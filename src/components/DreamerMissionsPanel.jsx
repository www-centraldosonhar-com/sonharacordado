import {
  useEffect,
  useMemo,
  useState,
} from 'react'

const PROJECT_ORDER = ['APS', 'PPF', 'SJ']

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function missionState(mission) {
  const now = Date.now()
  const starts = mission.starts_at
    ? new Date(mission.starts_at).getTime()
    : null
  const ends = mission.ends_at
    ? new Date(mission.ends_at).getTime()
    : null

  if (starts && starts > now) return 'Em breve'
  if (ends && ends < now) return 'Encerrada'
  return 'Valendo'
}

function DreamerMissionsPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=missions')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível carregar as missões.'
          )
        }
        return payload
      })
      .then(payload => {
        if (active) setData(payload)
      })
      .catch(fetchError => {
        if (active) setError(fetchError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const missions = useMemo(
    () => data?.missions || [],
    [data]
  )

  if (loading) {
    return (
      <section className="dreamer-missions-public dreamer-missions-public--state">
        Carregando missões especiais…
      </section>
    )
  }

  if (error) {
    return (
      <section className="dreamer-missions-public dreamer-missions-public--state is-error">
        {error}
      </section>
    )
  }

  if (!missions.length) return null

  return (
    <section
      className="dreamer-missions-public"
      id="dreamer-missions"
    >
      <div className="dreamer-olympiad-section-heading">
        <div>
          <span className="dreamer-section-label">
            MISSÕES ESPECIAIS
          </span>
          <h2>Desafios que também movimentam o placar.</h2>
        </div>
        <p>
          Criatividade, participação e engajamento também podem virar pontos para APS, PPF e SJ.
        </p>
      </div>

      <div className="dreamer-missions-public__grid">
        {missions.map(mission => {
          const results = new Map(
            (mission.results || []).map(result => [
              String(result.project || '').toUpperCase(),
              Number(result.points || 0),
            ])
          )
          const starts = formatDate(mission.starts_at)
          const ends = formatDate(mission.ends_at)

          return (
            <article
              className="dreamer-mission-public-card"
              key={mission.id}
            >
              <div className="dreamer-mission-public-card__top">
                <span>{missionState(mission)}</span>
                <strong>
                  {mission.max_points === null
                    ? 'Pontuação definida pela comissão'
                    : `Até ${Number(mission.max_points).toFixed(2)} pts`}
                </strong>
              </div>

              <h3>{mission.title}</h3>
              <p>{mission.description || 'Missão especial da Olimpíada Sonhadora.'}</p>

              {mission.rules_text ? (
                <div className="dreamer-mission-public-card__rules">
                  <small>COMO FUNCIONA</small>
                  <p>{mission.rules_text}</p>
                </div>
              ) : null}

              {starts || ends ? (
                <div className="dreamer-mission-public-card__period">
                  <span>Período</span>
                  <strong>
                    {starts || '—'}{ends ? ` → ${ends}` : ''}
                  </strong>
                </div>
              ) : null}

              <div className="dreamer-mission-public-card__scores">
                {PROJECT_ORDER.map(project => (
                  <span
                    key={project}
                    className={`is-${project.toLowerCase()}`}
                  >
                    <small>{project}</small>
                    <strong>
                      {(results.get(project) || 0).toFixed(2)} pts
                    </strong>
                  </span>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default DreamerMissionsPanel
