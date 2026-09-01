import {
  useEffect,
  useMemo,
  useState,
} from 'react'

const EMPTY_FORM = {
  title: '',
  description: '',
  rulesText: '',
  missionType: 'special',
  maxPoints: '',
  startsAt: '',
  endsAt: '',
  active: true,
}

function dateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  )
  return local.toISOString().slice(0, 16)
}

function formatDateTime(value) {
  if (!value) return 'Sem data definida'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function missionStatus(mission) {
  if (!Number(mission.active)) return 'Rascunho'
  const now = Date.now()
  const starts = mission.starts_at
    ? new Date(mission.starts_at).getTime()
    : null
  const ends = mission.ends_at
    ? new Date(mission.ends_at).getTime()
    : null

  if (starts && starts > now) return 'Agendada'
  if (ends && ends < now) return 'Encerrada'
  return 'Ativa'
}

function DreamerMissionsAdminPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [scoreDrafts, setScoreDrafts] = useState({})

  async function load() {
    setError('')

    try {
      const response = await fetch(
        '/api/dreamer?action=missions&scope=admin'
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível carregar as missões.'
        )
      }

      setData(payload)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=missions&scope=admin')
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

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function editMission(mission) {
    setEditingId(mission.id)
    setForm({
      title: mission.title || '',
      description: mission.description || '',
      rulesText: mission.rules_text || '',
      missionType: mission.mission_type || 'special',
      maxPoints:
        mission.max_points === null ||
        mission.max_points === undefined
          ? ''
          : String(mission.max_points),
      startsAt: dateTimeInputValue(mission.starts_at),
      endsAt: dateTimeInputValue(mission.ends_at),
      active: Boolean(Number(mission.active)),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveMission(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        '/api/dreamer?action=missions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: editingId ? 'update' : 'create',
            missionId: editingId || undefined,
            ...form,
            maxPoints:
              form.maxPoints === ''
                ? null
                : Number(form.maxPoints),
          }),
        }
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error || 'Não foi possível salvar a missão.'
        )
      }

      setMessage(payload.message)
      resetForm()
      await load()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function resultFor(mission, projectId) {
    return mission.results?.find(
      result => Number(result.project_id) === Number(projectId)
    )
  }

  function scoreKey(missionId, projectId) {
    return `${missionId}:${projectId}`
  }

  async function saveScore(mission, team) {
    const key = scoreKey(mission.id, team.project_id)
    const existing = resultFor(mission, team.project_id)
    const draft = scoreDrafts[key] || {}
    const points =
      draft.points !== undefined
        ? draft.points
        : existing?.points || 0
    const sourceReference =
      draft.sourceReference !== undefined
        ? draft.sourceReference
        : existing?.source_reference || ''

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        '/api/dreamer?action=missions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'score',
            missionId: mission.id,
            projectId: team.project_id,
            points: Number(points || 0),
            sourceReference,
          }),
        }
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error || 'Não foi possível salvar a pontuação.'
        )
      }

      setMessage(
        `${team.project}: ${payload.message}`
      )
      await load()
    } catch (scoreError) {
      setError(scoreError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="dreamer-admin-missions-state">
        Carregando missões…
      </div>
    )
  }

  return (
    <div className="dreamer-admin-missions">
      <section className="dreamer-admin-missions__hero">
        <div>
          <span className="dreamer-eyebrow">
            OLIMPÍADA SONHADORA
          </span>
          <h2>Missões especiais</h2>
          <p>
            Crie desafios de engajamento, criatividade, participação coletiva ou jogos e defina a pontuação de cada equipe.
          </p>
        </div>
        <div className="dreamer-admin-missions__metric">
          <small>Missões cadastradas</small>
          <strong>{missions.length}</strong>
        </div>
      </section>

      {error ? (
        <div className="dreamer-admin-missions__alert is-error">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="dreamer-admin-missions__alert is-success">
          {message}
        </div>
      ) : null}

      <form
        className="dreamer-admin-mission-form"
        onSubmit={saveMission}
      >
        <div className="dreamer-admin-mission-form__heading">
          <div>
            <span>{editingId ? 'EDITANDO MISSÃO' : 'NOVA MISSÃO'}</span>
            <h3>
              {editingId
                ? 'Ajuste os critérios da missão'
                : 'Crie um novo desafio'}
            </h3>
          </div>
          {editingId ? (
            <button type="button" onClick={resetForm}>
              Cancelar edição
            </button>
          ) : null}
        </div>

        <div className="dreamer-admin-mission-form__grid">
          <label className="is-wide">
            <span>Nome da missão</span>
            <input
              value={form.title}
              maxLength={160}
              required
              onChange={event =>
                setForm(current => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Ex.: Desafio da criatividade"
            />
          </label>

          <label>
            <span>Pontuação máxima por time</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.maxPoints}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  maxPoints: event.target.value,
                }))
              }
              placeholder="Ex.: 10"
            />
          </label>

          <label>
            <span>Tipo</span>
            <select
              value={form.missionType}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  missionType: event.target.value,
                }))
              }
            >
              <option value="special">Missão especial</option>
              <option value="engagement">Engajamento</option>
              <option value="creative">Criatividade</option>
              <option value="game">Jogo / desafio</option>
              <option value="collective">Participação coletiva</option>
            </select>
          </label>

          <label>
            <span>Início</span>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  startsAt: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Término</span>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  endsAt: event.target.value,
                }))
              }
            />
          </label>

          <label className="is-wide">
            <span>Descrição</span>
            <textarea
              value={form.description}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Explique o objetivo da missão."
              rows={3}
            />
          </label>

          <label className="is-wide">
            <span>Critérios / como pontuar</span>
            <textarea
              value={form.rulesText}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  rulesText: event.target.value,
                }))
              }
              placeholder="Descreva os critérios de avaliação e o que cada equipe precisa fazer."
              rows={4}
            />
          </label>

          <label className="dreamer-admin-mission-form__toggle is-wide">
            <input
              type="checkbox"
              checked={form.active}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  active: event.target.checked,
                }))
              }
            />
            <span>
              <strong>Publicar missão</strong>
              <small>
                Desmarque para salvar como rascunho sem exibir na Olimpíada.
              </small>
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="dreamer-admin-mission-form__submit"
          disabled={saving}
        >
          {saving
            ? 'Salvando…'
            : editingId
              ? 'Salvar alterações'
              : 'Criar missão'}
        </button>
      </form>

      <section className="dreamer-admin-mission-list">
        <div className="dreamer-admin-mission-list__heading">
          <span>MISSÕES DA CAMPANHA</span>
          <h3>Desafios e placar</h3>
        </div>

        {missions.length === 0 ? (
          <div className="dreamer-admin-missions-state">
            Nenhuma missão criada ainda.
          </div>
        ) : (
          missions.map(mission => (
            <article
              key={mission.id}
              className="dreamer-admin-mission-card"
            >
              <div className="dreamer-admin-mission-card__top">
                <div>
                  <span>{missionStatus(mission)}</span>
                  <h4>{mission.title}</h4>
                  <p>{mission.description || 'Sem descrição.'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => editMission(mission)}
                >
                  Editar
                </button>
              </div>

              <div className="dreamer-admin-mission-card__meta">
                <span>
                  <small>Máximo</small>
                  <strong>
                    {mission.max_points === null
                      ? 'Livre'
                      : `${Number(mission.max_points).toFixed(2)} pts`}
                  </strong>
                </span>
                <span>
                  <small>Início</small>
                  <strong>{formatDateTime(mission.starts_at)}</strong>
                </span>
                <span>
                  <small>Término</small>
                  <strong>{formatDateTime(mission.ends_at)}</strong>
                </span>
              </div>

              {mission.rules_text ? (
                <div className="dreamer-admin-mission-card__rules">
                  <strong>Critérios</strong>
                  <p>{mission.rules_text}</p>
                </div>
              ) : null}

              <div className="dreamer-admin-mission-score-grid">
                {(data?.teams || []).map(team => {
                  const existing = resultFor(
                    mission,
                    team.project_id
                  )
                  const key = scoreKey(
                    mission.id,
                    team.project_id
                  )
                  const draft = scoreDrafts[key] || {}

                  return (
                    <div
                      key={team.project_id}
                      className={`dreamer-admin-mission-score is-${String(team.project).toLowerCase()}`}
                    >
                      <div>
                        <span>{team.project}</span>
                        <strong>
                          {Number(
                            draft.points !== undefined
                              ? draft.points
                              : existing?.points || 0
                          ).toFixed(2)} pts
                        </strong>
                      </div>

                      <label>
                        <span>Pontos</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          max={
                            mission.max_points === null
                              ? undefined
                              : mission.max_points
                          }
                          value={
                            draft.points !== undefined
                              ? draft.points
                              : existing?.points || 0
                          }
                          onChange={event =>
                            setScoreDrafts(current => ({
                              ...current,
                              [key]: {
                                ...current[key],
                                points: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>

                      <label>
                        <span>Referência / observação</span>
                        <input
                          value={
                            draft.sourceReference !== undefined
                              ? draft.sourceReference
                              : existing?.source_reference || ''
                          }
                          onChange={event =>
                            setScoreDrafts(current => ({
                              ...current,
                              [key]: {
                                ...current[key],
                                sourceReference: event.target.value,
                              },
                            }))
                          }
                          placeholder="Ex.: avaliação da comissão"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveScore(mission, team)}
                      >
                        Salvar pontos
                      </button>
                    </div>
                  )
                })}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}

export default DreamerMissionsAdminPanel
