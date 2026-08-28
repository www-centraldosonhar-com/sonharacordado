import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import DreamerFundraisingPanel from '../components/DreamerFundraisingPanel'
import '../styles/dreamer.css'

const PROJECT_META = {
  APS: {
    name: 'Amigos Para Sempre',
    className: 'is-aps',
    icon: '♥',
  },
  PPF: {
    name: 'Preparando Para o Futuro',
    className: 'is-ppf',
    icon: '✦',
  },
  SJ: {
    name: 'Sonhando Juntos',
    className: 'is-sj',
    icon: '●',
  },
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getMeta(project) {
  return (
    PROJECT_META[String(project || '').toUpperCase()] || {
      name: String(project || 'Time Sonhador'),
      className: '',
      icon: '♥',
    }
  )
}

function DreamerOlympiadPage({
  user,
  onBack,
  onLogout,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=home')
      .then(async response => {
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível carregar a Olimpíada.'
          )
        }

        return payload
      })
      .then(payload => {
        if (active) {
          setData(payload)
        }
      })
      .catch(fetchError => {
        if (active) {
          setError(fetchError.message)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const teams = useMemo(
    () => data?.teams || [],
    [data]
  )

  const campaign = data?.campaign
  const totalRaised = Number(data?.totals?.raised || 0)
  const maxPoints = Math.max(
    ...teams.map(team => Number(team.totalPoints || 0)),
    1
  )

  const preferredProject =
    data?.currentUser?.dreamerProfile?.preferred_project ||
    data?.currentUser?.project ||
    user?.project ||
    ''

  const preferredTeam = teams.find(
    team =>
      String(team.project).toUpperCase() ===
      String(preferredProject).toUpperCase()
  )

  const firstName = String(
    data?.currentUser?.name || user?.name || ''
  )
    .trim()
    .split(/\s+/)[0]

  const startsAt = formatDate(campaign?.starts_at)
  const endsAt = formatDate(campaign?.ends_at)

  return (
    <main className="dreamer-page dreamer-olympiad-page">
      <div className="dreamer-page__shell dreamer-olympiad-shell">
        <header className="dreamer-olympiad-nav">
          <button
            type="button"
            className="dreamer-home-brand"
            onClick={onBack}
          >
            <span>♥</span>
            <div>
              <strong>Sócio Sonhador</strong>
              <small>Olimpíada Sonhadora</small>
            </div>
          </button>

          <div className="dreamer-home-nav__actions">
            <button
              type="button"
              className="dreamer-olympiad-back"
              onClick={onBack}
            >
              ← Voltar
            </button>
            <button
              type="button"
              className="dreamer-home-nav__exit"
              onClick={onLogout}
            >
              Sair
            </button>
          </div>
        </header>

        {loading ? (
          <section className="dreamer-home-state">
            <span className="dreamer-home-state__pulse">🏆</span>
            <strong>Montando o placar…</strong>
            <small>Buscando a pontuação oficial da campanha.</small>
          </section>
        ) : error ? (
          <section className="dreamer-home-state dreamer-home-state--error">
            <strong>Não conseguimos abrir a Olimpíada.</strong>
            <small>{error}</small>
          </section>
        ) : (
          <>
            <section className="dreamer-olympiad-hero">
              <div className="dreamer-olympiad-hero__copy">
                <span className="dreamer-eyebrow dreamer-eyebrow--light">
                  🏆 CAMPANHA ENTRE APS · PPF · SJ
                </span>
                <h1>{campaign?.name || 'Olimpíada Sonhadora'}</h1>
                <p>
                  Arrecadação, frequência e missões especiais se encontram em uma disputa saudável para transformar participação em impacto.
                </p>

                <div className="dreamer-olympiad-hero__meta">
                  <span>
                    <small>Status</small>
                    <strong>
                      {campaign?.status === 'active'
                        ? 'Campanha ativa'
                        : 'Preparando a campanha'}
                    </strong>
                  </span>
                  {startsAt || endsAt ? (
                    <span>
                      <small>Período</small>
                      <strong>
                        {startsAt || '—'}
                        {endsAt ? ` → ${endsAt}` : ''}
                      </strong>
                    </span>
                  ) : null}
                  <span>
                    <small>Impacto validado</small>
                    <strong>{formatCurrency(totalRaised)}</strong>
                  </span>
                </div>
              </div>

              <div className="dreamer-olympiad-trophy" aria-hidden="true">
                <span>🏆</span>
                <i>SONHAR</i>
              </div>
            </section>

            {preferredTeam ? (
              <section className={`dreamer-olympiad-your-team ${getMeta(preferredTeam.project).className}`}>
                <div>
                  <span>SEU TIME</span>
                  <strong>{preferredTeam.project}</strong>
                  <small>{getMeta(preferredTeam.project).name}</small>
                </div>
                <p>
                  Oi, {firstName}. Hoje seu time está em <strong>{preferredTeam.position}º lugar</strong> com <strong>{Number(preferredTeam.totalPoints || 0).toFixed(2)} pontos</strong>.
                </p>
              </section>
            ) : null}

            <section className="dreamer-olympiad-ranking-section">
              <div className="dreamer-olympiad-section-heading">
                <div>
                  <span className="dreamer-section-label">PLACAR OFICIAL</span>
                  <h2>Como está a Olimpíada agora</h2>
                </div>
                <p>
                  Somente arrecadações validadas e pontuações oficiais entram neste placar.
                </p>
              </div>

              <div className="dreamer-olympiad-podium">
                {teams.map(team => {
                  const meta = getMeta(team.project)
                  const progress = Math.max(
                    4,
                    Math.min(
                      100,
                      (Number(team.totalPoints || 0) / maxPoints) * 100
                    )
                  )

                  return (
                    <article
                      key={team.projectId}
                      className={`dreamer-olympiad-team ${meta.className} ${preferredTeam?.projectId === team.projectId ? 'is-yours' : ''}`}
                    >
                      <div className="dreamer-olympiad-team__head">
                        <div className="dreamer-olympiad-team__position">
                          {team.position}º
                        </div>
                        <div className="dreamer-olympiad-team__identity">
                          <span>{meta.icon}</span>
                          <div>
                            <strong>{team.project}</strong>
                            <small>{meta.name}</small>
                          </div>
                        </div>
                        {preferredTeam?.projectId === team.projectId ? (
                          <b>Seu time</b>
                        ) : null}
                      </div>

                      <div className="dreamer-olympiad-team__score">
                        <strong>{Number(team.totalPoints || 0).toFixed(2)}</strong>
                        <span>pontos</span>
                      </div>

                      <div className="dreamer-olympiad-team__track">
                        <span style={{ width: `${progress}%` }} />
                      </div>

                      <div className="dreamer-olympiad-breakdown">
                        <span>
                          <small>Arrecadação líquida</small>
                          <strong>{formatCurrency(team.netTotal)}</strong>
                        </span>
                        <span>
                          <small>Pontos por arrecadação</small>
                          <strong>{Number(team.fundraisingPoints || 0).toFixed(2)}</strong>
                        </span>
                        <span>
                          <small>Frequência</small>
                          <strong>{Number(team.frequencyPoints || 0).toFixed(2)} pts</strong>
                        </span>
                        <span>
                          <small>Missões</small>
                          <strong>{Number(team.missionPoints || 0).toFixed(2)} pts</strong>
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="dreamer-olympiad-rules">
              <div className="dreamer-olympiad-rules__intro">
                <span className="dreamer-section-label">COMO O PLACAR É FORMADO</span>
                <h2>Mais do que arrecadar.</h2>
                <p>
                  A Olimpíada valoriza diferentes formas de participação. Cada frente contribui para o resultado oficial da equipe.
                </p>
              </div>

              <div className="dreamer-olympiad-rules__grid">
                <article>
                  <span>01</span>
                  <strong>Arrecadação</strong>
                  <p>
                    O valor líquido validado é dividido pela quantidade oficial de voluntários do projeto.
                  </p>
                </article>
                <article>
                  <span>02</span>
                  <strong>Frequência</strong>
                  <p>
                    Os check-ins dos eventos elegíveis formam a média de frequência de APS, PPF e SJ.
                  </p>
                </article>
                <article>
                  <span>03</span>
                  <strong>Missões</strong>
                  <p>
                    Desafios especiais podem adicionar pontos conforme critérios definidos pela organização.
                  </p>
                </article>
                <article>
                  <span>04</span>
                  <strong>Indicações</strong>
                  <p>
                    Indicações qualificadas poderão gerar pontuação quando a missão automatizada for ativada.
                  </p>
                </article>
              </div>
            </section>

            <section className="dreamer-olympiad-actions">
              <div>
                <span className="dreamer-section-label">PARTICIPE DO SEU JEITO</span>
                <h2>Uma boa ideia também vira ponto.</h2>
                <p>
                  Fez uma venda, rifa, campanha ou recebeu uma doação fora do app? Registre a arrecadação com comprovante para o Admin Sócio validar.
                </p>
              </div>
              <div className="dreamer-olympiad-actions__buttons">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById('dreamer-fundraising')
                      ?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                  }
                >
                  Registrar arrecadação ↘
                </button>
                <button type="button" disabled>Ver missões · em breve</button>
              </div>
            </section>

            <DreamerFundraisingPanel
              preferredProject={preferredProject}
            />
          </>
        )}
      </div>
    </main>
  )
}

export default DreamerOlympiadPage
