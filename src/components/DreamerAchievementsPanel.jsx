import {
  useEffect,
  useMemo,
  useState,
} from 'react'

const REWARD_TYPE_LABELS = {
  badge: 'Badge',
  banner: 'Banner',
  frame: 'Moldura',
  accent: 'Destaque',
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function rewardVisualClass(code) {
  if (!code) return ''
  return `has-${String(code).replace(/_/g, '-')}`
}

const DREAMER_PROFILE_PROJECTS = {
  APS: {
    label: 'Amigos Para Sempre',
    icon: '♥',
  },
  PPF: {
    label: 'Preparando Para o Futuro',
    icon: '✦',
  },
  SJ: {
    label: 'Sonhando Juntos',
    icon: '●',
  },
}

function DreamerAchievementsPanel({
  firstName = 'Sonhador',
  fullName,
  avatarUrl,
  project,
}) {
  const profileProjectCode = project
    ? String(project).toUpperCase()
    : ''

  const profileProject =
    DREAMER_PROFILE_PROJECTS[profileProjectCode] || null

  const profileName = fullName || firstName || 'Sonhador'
  const profileInitial =
    profileName.trim().slice(0, 1).toUpperCase() || 'S'

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=achievements')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível carregar sua jornada.'
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

  const unlockedAchievements = useMemo(
    () => (data?.achievements || []).filter(item => item.unlocked),
    [data]
  )

  const unlockedCosmetics = useMemo(
    () => data?.cosmetics?.unlocked || [],
    [data]
  )

  const equipped = data?.cosmetics?.equipped || {}

  async function equipCosmetic(type, code) {
    if (saving) return

    setSaving(`${type}:${code || 'none'}`)
    setNotice('')

    try {
      const response = await fetch('/api/dreamer?action=achievements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'equip_cosmetic',
          rewardType: type,
          rewardCode: code,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(
          payload?.error || 'Não foi possível aplicar essa recompensa.'
        )
      }

      setData(payload)
      setNotice(payload.message || 'Visual atualizado.')
    } catch (saveError) {
      setNotice(saveError.message)
    } finally {
      setSaving('')
    }
  }

  if (loading) {
    return (
      <section className="dreamer-journey dreamer-journey--state">
        Preparando suas conquistas…
      </section>
    )
  }

  if (error) {
    return (
      <section className="dreamer-journey dreamer-journey--state is-error">
        {error}
      </section>
    )
  }

  const visualClasses = [
    rewardVisualClass(equipped.badge),
    rewardVisualClass(equipped.banner),
    rewardVisualClass(equipped.frame),
    rewardVisualClass(equipped.accent),
  ].filter(Boolean).join(' ')

  return (
    <section className="dreamer-journey" id="dreamer-journey">
      <div className="dreamer-journey__heading">
        <div>
          <span className="dreamer-section-label">SUA JORNADA</span>
          <h2>Pequenos gestos também viram história.</h2>
          <p>
            Conquistas registram formas diferentes de participar do Sonhar. Algumas também liberam detalhes visuais exclusivos para o seu espaço.
          </p>
        </div>
        <div className="dreamer-journey__counter">
          <strong>{data?.summary?.unlocked || 0}</strong>
          <span>de {data?.summary?.total || 0}</span>
          <small>conquistas</small>
        </div>
      </div>

      <div className="dreamer-journey__layout">
        <div className="dreamer-journey__achievements">
          {(data?.achievements || []).map(item => {
            const progress = item.progress?.required
              ? Math.min(100, (Number(item.progress.current || 0) / Number(item.progress.required)) * 100)
              : 0

            return (
              <article
                key={item.code}
                className={`dreamer-achievement-card ${item.unlocked ? 'is-unlocked' : 'is-locked'}`}
              >
                <div className="dreamer-achievement-card__icon">
                  {item.unlocked ? item.icon : '◇'}
                </div>
                <div className="dreamer-achievement-card__body">
                  <div className="dreamer-achievement-card__top">
                    <strong>{item.title}</strong>
                    <span>{item.unlocked ? 'Desbloqueada' : 'Em progresso'}</span>
                  </div>
                  <p>{item.description}</p>
                  <div className="dreamer-achievement-card__progress">
                    <i><span style={{ width: `${progress}%` }} /></i>
                    <small>
                      {item.unlocked
                        ? `Liberou ${item.rewardLabel}`
                        : `${item.progress?.current || 0}/${item.progress?.required || 1}`}
                    </small>
                  </div>
                  {item.unlockedAt ? (
                    <small className="dreamer-achievement-card__date">
                      Conquistada em {formatDate(item.unlockedAt)}
                    </small>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>

        <aside className="dreamer-cosmetics">
          <div className={`dreamer-cosmetics__preview ${visualClasses}`}>
            <span className="dreamer-cosmetics__preview-kicker">SEU ESPAÇO</span>

            <div className="dreamer-cosmetics__avatar">
              {avatarUrl ? (
                <img
                  className="dreamer-profile-avatar-image"
                  src={avatarUrl}
                  alt={`Avatar de ${profileName}`}
                />
              ) : (
                profileInitial
              )}
            </div>

            <strong>{profileName}</strong>
            <small>Sócio Sonhador</small>

            {profileProject ? (
              <span
                className="dreamer-profile-project"
                data-project={profileProjectCode}
              >
                <span aria-hidden="true">{profileProject.icon}</span>
                {profileProject.label}
              </span>
            ) : null}

            {equipped.badge ? <b>Conquista equipada</b> : null}
          </div>

          <div className="dreamer-cosmetics__copy">
            <span className="dreamer-section-label">RECOMPENSAS VISUAIS</span>
            <h3>Deixe sua jornada com a sua cara.</h3>
            <p>
              Nesta primeira versão, as recompensas são cosméticas. Depois podemos evoluir para skins, animações e experiências especiais.
            </p>
          </div>

          <div className="dreamer-cosmetics__list">
            {unlockedCosmetics.length ? unlockedCosmetics.map(item => {
              const isEquipped = equipped[item.type] === item.code
              const actionKey = `${item.type}:${item.code}`

              return (
                <article key={item.code}>
                  <div>
                    <span>{REWARD_TYPE_LABELS[item.type] || 'Recompensa'}</span>
                    <strong>{item.label}</strong>
                    <small>{item.achievementTitle}</small>
                  </div>
                  <button
                    type="button"
                    className={isEquipped ? 'is-equipped' : ''}
                    disabled={Boolean(saving)}
                    onClick={() => equipCosmetic(item.type, isEquipped ? null : item.code)}
                  >
                    {saving === actionKey
                      ? 'Aplicando…'
                      : isEquipped
                        ? 'Equipado ✓'
                        : 'Usar'}
                  </button>
                </article>
              )
            }) : (
              <p className="dreamer-cosmetics__empty">
                Suas recompensas aparecerão aqui conforme a jornada avançar.
              </p>
            )}
          </div>

          {notice ? <div className="dreamer-cosmetics__notice">{notice}</div> : null}
        </aside>
      </div>

      <div className="dreamer-impact-history">
        <div className="dreamer-impact-history__heading">
          <div>
            <span className="dreamer-section-label">HISTÓRICO DE IMPACTO</span>
            <h3>O que já ficou marcado na sua jornada.</h3>
          </div>
          <small>{unlockedAchievements.length} conquistas desbloqueadas</small>
        </div>

        {data?.impact?.length ? (
          <div className="dreamer-impact-history__list">
            {data.impact.slice(0, 8).map(item => (
              <article key={item.id}>
                <span className="dreamer-impact-history__icon">{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>{formatDate(item.happenedAt)}</small>
                </div>
                {item.amount ? <b>{formatCurrency(item.amount)}</b> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="dreamer-impact-history__empty">
            Sua história começa aqui. Cada participação validada passa a aparecer neste espaço.
          </div>
        )}
      </div>
    </section>
  )
}

export default DreamerAchievementsPanel
