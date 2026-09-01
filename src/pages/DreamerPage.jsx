import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import DreamerContributionsPanel from '../components/DreamerContributionsPanel'
import DreamerAchievementsPanel from '../components/DreamerAchievementsPanel'
import '../styles/dreamer.css'

import '../styles/dreamer-impact-transparency-v2.css'
const PARTNER_META = {
  sponsor: {
    label: 'Patrocinador',
    icon: '★',
    className: 'is-sponsor',
  },
  partner: {
    label: 'Parceiro',
    icon: '♥',
    className: 'is-partner',
  },
  supporter: {
    label: 'Apoiador',
    icon: '✦',
    className: 'is-supporter',
  },
}

const PROJECT_META = {
  APS: {
    label: 'Amigos Para Sempre',
    className: 'is-aps',
    icon: '♥',
  },
  PPF: {
    label: 'Preparando Para o Futuro',
    className: 'is-ppf',
    icon: '✦',
  },
  SJ: {
    label: 'Sonhando Juntos',
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

function getProjectMeta(project) {
  return (
    PROJECT_META[String(project || '').toUpperCase()] || {
      label: String(project || 'Time Sonhador'),
      className: '',
      icon: '♥',
    }
  )
}

function getPartnerMeta(type) {
  return (
    PARTNER_META[String(type || '').toLowerCase()] ||
    PARTNER_META.partner
  )
}

// Datas públicas ainda não foram oficialmente fechadas no sistema.
// Quando definidas, podem ser configuradas no ambiente do frontend sem alterar o layout.
const PUBLIC_EVENT = {
  name: 'Festa de Natal',
  monthLabel: 'Dezembro',
  dateLabel: import.meta.env.VITE_DREAMER_PUBLIC_EVENT_DATE_LABEL || 'Dezembro de 2026',
  locationLabel: import.meta.env.VITE_DREAMER_PUBLIC_EVENT_LOCATION || 'São Paulo · local em breve',
  registrationUrl: import.meta.env.VITE_DREAMER_PUBLIC_EVENT_URL || '',
}

const VOLUNTEER_REGISTRATION_OPENS_AT =
  import.meta.env.VITE_DREAMER_VOLUNTEER_REGISTRATION_OPENS_AT || ''

function getCountdown(targetDate) {
  if (!targetDate) return null

  const target = new Date(targetDate).getTime()
  if (!Number.isFinite(target)) return null

  const remaining = Math.max(0, target - Date.now())
  const totalSeconds = Math.floor(remaining / 1000)

  return {
    finished: remaining <= 0,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function DreamerPage({
  user,
  onBack,
  onLogout,
  onOpenAdmin,
  onOpenOlympiad,
}) {
  const [homeData, setHomeData] =
    useState(null)
  const [loading, setLoading] =
    useState(true)
  const [error, setError] =
    useState('')
  const [countdown, setCountdown] =
    useState(() => getCountdown(VOLUNTEER_REGISTRATION_OPENS_AT))
  const [teamSaving, setTeamSaving] = useState('')
  const [teamMessage, setTeamMessage] = useState('')
  const [communityData, setCommunityData] = useState({
    actions: [],
    partners: [],
  })

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=home')
      .then(async response => {
        const payload =
          await response.json()

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível abrir o Sócio Sonhador.'
          )
        }

        return payload
      })
      .then(payload => {
        if (active) {
          setHomeData(payload)
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

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=community&scope=public')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error || 'Não foi possível carregar ações e parceiros.')
        }
        return payload
      })
      .then(payload => {
        if (active) {
          setCommunityData({
            actions: payload?.actions || [],
            partners: payload?.partners || [],
          })
        }
      })
      .catch(fetchError => {
        console.warn('Dreamer community:', fetchError.message)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!VOLUNTEER_REGISTRATION_OPENS_AT) return undefined

    const update = () => {
      setCountdown(getCountdown(VOLUNTEER_REGISTRATION_OPENS_AT))
    }

    update()
    const intervalId = window.setInterval(update, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  const firstName = String(
    homeData?.currentUser?.name ||
      user.name ||
      ''
  )
    .trim()
    .split(/\s+/)[0]

  const isDreamerAdmin = Boolean(
    homeData?.currentUser
      ?.isDreamerAdmin
  )

  const teams = useMemo(
    () => homeData?.teams || [],
    [homeData]
  )

  const canChooseDreamerTeam = Boolean(
    homeData?.currentUser?.canChooseDreamerTeam
  )

  const preferredProject =
    homeData?.currentUser?.dreamerProfile
      ?.preferred_project ||
    (!canChooseDreamerTeam
      ? homeData?.currentUser?.project ||
        user?.project ||
        ''
      : '')

  const preferredTeam =
    teams.find(
      team =>
        String(team.project).toUpperCase() ===
        String(preferredProject).toUpperCase()
    ) || null

  const campaign = homeData?.campaign
  const totalRaised =
    Number(homeData?.totals?.raised || 0)

  const supportActions = communityData.actions || []
  const partners = communityData.partners || []

  const publishedSupportActions = supportActions.filter(
    action => action.status === 'published'
  ).length
  const activePartners = partners.filter(partner => partner.active).length
  const attendanceEvents = Number(homeData?.frequency?.events?.length || 0)
  const featuredPartner =
    partners.find(partner => partner.featured) || null

  const partnerCounts = partners.reduce(
    (accumulator, partner) => {
      const type = String(
        partner.partner_type || 'partner'
      ).toLowerCase()

      if (type === 'sponsor') {
        accumulator.sponsors += 1
      } else if (type === 'supporter') {
        accumulator.supporters += 1
      } else {
        accumulator.partners += 1
      }

      return accumulator
    },
    {
      sponsors: 0,
      partners: 0,
      supporters: 0,
    }
  )

  const maxPoints = Math.max(
    ...teams.map(team => Number(team.totalPoints || 0)),
    1
  )

  async function chooseDreamerTeam(project) {
    if (teamSaving) return

    setTeamSaving(project)
    setTeamMessage('')

    try {
      const response = await fetch('/api/dreamer?action=team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível salvar seu time.'
        )
      }

      setHomeData(current => ({
        ...current,
        currentUser: {
          ...current.currentUser,
          dreamerProfile: payload.dreamerProfile,
        },
      }))

      setTeamMessage(payload.message || 'Time escolhido!')
    } catch (chooseError) {
      setTeamMessage(chooseError.message)
    } finally {
      setTeamSaving('')
    }
  }

  function renderContent() {
    if (loading) {
      return (
        <section className="dreamer-home-state">
          <span className="dreamer-home-state__pulse">♥</span>
          <strong>Abrindo seu espaço sonhador…</strong>
          <small>Preparando campanhas, times e impacto.</small>
        </section>
      )
    }

    if (error) {
      return (
        <section className="dreamer-home-state dreamer-home-state--error">
          <strong>Não conseguimos abrir o Sócio agora.</strong>
          <small>{error}</small>
        </section>
      )
    }

    return (
      <>
        <section className="dreamer-home-hero">
          <div className="dreamer-home-hero__copy">
            <span className="dreamer-eyebrow dreamer-eyebrow--light">
              SEU LUGAR NO SONHAR
            </span>
            <h1>
              Oi, {firstName}.<br />
              <span>Que bom ter você aqui.</span>
            </h1>
            <p>
              Acompanhe campanhas, torça pelo seu time e participe do Sonhar do seu jeito — sem obrigação, no seu tempo.
            </p>

            <div className="dreamer-home-hero__actions">
              <button
                type="button"
                className="dreamer-home-hero__primary"
                onClick={onOpenOlympiad}
              >
                Ver Olimpíada
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={onBack}
              >
                Voltar à Central
              </button>
            </div>
          </div>

          <div className="dreamer-heart-orbit" aria-hidden="true">
            <span className="dreamer-heart-orbit__ring dreamer-heart-orbit__ring--one" />
            <span className="dreamer-heart-orbit__ring dreamer-heart-orbit__ring--two" />
            <span className="dreamer-heart-orbit__core">♥</span>
            <span className="dreamer-heart-orbit__dot dreamer-heart-orbit__dot--aps" />
            <span className="dreamer-heart-orbit__dot dreamer-heart-orbit__dot--ppf" />
            <span className="dreamer-heart-orbit__dot dreamer-heart-orbit__dot--sj" />
          </div>
        </section>

        <section className="dreamer-home-quickbar" aria-label="Resumo do Sócio Sonhador">
          <article>
            <span>Próximo grande encontro</span>
            <strong>{PUBLIC_EVENT.name}</strong>
          </article>
          <article>
            <span>Campanha em destaque</span>
            <strong>{campaign?.name || 'Olimpíada Sonhadora'}</strong>
          </article>
          <article>
            <span>Impacto registrado</span>
            <strong>{formatCurrency(totalRaised)}</strong>
          </article>
        </section>

        <section className="dreamer-about">
          <div className="dreamer-about__copy">
            <span className="dreamer-section-label">POR QUE EXISTIMOS</span>
            <h2>Sonhar junto também transforma quem ajuda.</h2>
            <p>
              O Sonhar Acordado conecta jovens voluntários a crianças e adolescentes em situação de vulnerabilidade por meio da amizade, da vivência de valores e de experiências que geram desenvolvimento, alegria e esperança.
            </p>
            <p>
              Em São Paulo, essa rede ganha vida em projetos contínuos, grandes festas e ações especiais. O Sócio Sonhador aproxima ainda mais pessoas desse movimento — como voluntário, apoiador, doador, parceiro ou alguém que simplesmente quer fazer uma boa ideia acontecer.
            </p>
          </div>

          <div className="dreamer-about__projects">
            {Object.entries(PROJECT_META).map(([project, meta]) => (
              <article className={meta.className} key={project}>
                <span>{meta.icon}</span>
                <div>
                  <strong>{project}</strong>
                  <small>{meta.label}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="dreamer-public-event">
          <div className="dreamer-public-event__visual" aria-hidden="true">
            <span className="dreamer-public-event__month">{PUBLIC_EVENT.monthLabel}</span>
            <strong>🎄</strong>
            <i>Grande Festa</i>
          </div>

          <div className="dreamer-public-event__content">
            <span className="dreamer-section-label">PRÓXIMO EVENTO ABERTO AO PÚBLICO</span>
            <h2>Festa de Natal</h2>
            <p>
              Um dos grandes encontros do Sonhar Acordado: um dia de celebração, oficinas, brincadeiras, carinho e memórias especiais para as crianças e jovens atendidos pelos projetos.
            </p>
            <div className="dreamer-public-event__meta">
              <span>📅 {PUBLIC_EVENT.dateLabel}</span>
              <span>📍 {PUBLIC_EVENT.locationLabel}</span>
            </div>
            {PUBLIC_EVENT.registrationUrl ? (
              <a href={PUBLIC_EVENT.registrationUrl} target="_blank" rel="noreferrer">
                Ver inscrições
                <span>→</span>
              </a>
            ) : (
              <button type="button" disabled>Inscrições serão anunciadas em breve</button>
            )}
          </div>
        </section>

        <section className="dreamer-volunteer-countdown">
          <div>
            <span className="dreamer-section-label">PRÓXIMO SEMESTRE</span>
            <h2>Quando as inscrições abrirem, começa um novo sonho.</h2>
            <p>
              Voluntários contínuos acompanham os projetos durante o semestre, criam vínculos e vivem de perto a transformação proposta pelo Sonhar Acordado.
            </p>
          </div>

          <div className="dreamer-volunteer-countdown__timer">
            {countdown ? (
              countdown.finished ? (
                <div className="dreamer-volunteer-countdown__open">
                  <span>♥</span>
                  <strong>Inscrições abertas</strong>
                  <small>Chegou a hora de sonhar junto.</small>
                </div>
              ) : (
                <>
                  {[
                    ['dias', countdown.days],
                    ['horas', countdown.hours],
                    ['min', countdown.minutes],
                    ['seg', countdown.seconds],
                  ].map(([label, value]) => (
                    <span key={label}>
                      <strong>{String(value).padStart(2, '0')}</strong>
                      <small>{label}</small>
                    </span>
                  ))}
                </>
              )
            ) : (
              <div className="dreamer-volunteer-countdown__pending">
                <span>⏳</span>
                <strong>Contagem regressiva em breve</strong>
                <small>Assim que a abertura oficial for definida, o relógio começa automaticamente.</small>
              </div>
            )}
          </div>
        </section>

        <section id="olimpiada" className="dreamer-campaign-teaser">
          <div className="dreamer-campaign-teaser__copy">
            <span className="dreamer-campaign-kicker">🏆 CAMPANHA EM DESTAQUE</span>
            <h2>{campaign?.name || 'Olimpíada Sonhadora'}</h2>
            <p>
              APS, PPF e SJ transformam arrecadação, frequência, missões e engajamento em uma disputa do bem. Aqui você vê só o resumo — o placar completo fica dentro da Olimpíada.
            </p>
            <button type="button" onClick={onOpenOlympiad}>
              Entrar na Olimpíada
              <span>→</span>
            </button>
          </div>

          <div className="dreamer-campaign-teaser__ranking">
            {teams.slice(0, 3).map(team => {
              const meta = getProjectMeta(team.project)
              const progress = Math.max(6, Math.min(100, (Number(team.totalPoints || 0) / maxPoints) * 100))

              return (
                <article className={meta.className} key={team.projectId}>
                  <div>
                    <span>{team.position}º</span>
                    <strong>{team.project}</strong>
                    <small>{meta.label}</small>
                  </div>
                  <b>{Number(team.totalPoints || 0).toFixed(2)} pts</b>
                  <i><span style={{ width: `${progress}%` }} /></i>
                </article>
              )
            })}
          </div>
        </section>

        <section className="dreamer-help">
          <div className="dreamer-help__heading">
            <span className="dreamer-section-label">COMO VOCÊ PODE SOMAR</span>
            <h2>Escolha a forma que combina com você.</h2>
            <p>Participar do Sócio Sonhador não exige doação. Existem muitas maneiras de colocar um sonho em movimento.</p>
          </div>

          <div className="dreamer-help__grid">
            <article>
              <span>♥</span>
              <strong>Doação livre</strong>
              <p>Contribua com qualquer valor quando o coração pedir e acompanhe o impacto das campanhas.</p>
              <button type="button" onClick={() => document.getElementById('dreamer-direct-support')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Preparar apoio →</button>
            </article>
            <article>
              <span>✦</span>
              <strong>Apoie uma ação</strong>
              <p>Ajude necessidades específicas como alimentação, transporte, materiais, presentes ou estrutura de eventos.</p>
              <b>{supportActions.length ? `${supportActions.length} ${supportActions.length === 1 ? 'ação aberta' : 'ações abertas'}` : 'Em breve'}</b>
            </article>
            <article>
              <span>↗</span>
              <strong>Doe produtos ou serviços</strong>
              <p>Empresas e pessoas podem transformar estoque, conhecimento, espaço ou trabalho em impacto real.</p>
              <b>Em breve</b>
            </article>
            <article>
              <span>◎</span>
              <strong>Convide e compartilhe</strong>
              <p>Indique amigos, divulgue campanhas e conecte novas pessoas ao universo do Sonhar.</p>
              <b>Em breve</b>
            </article>
          </div>
        </section>

        <DreamerContributionsPanel mode="general" />

        <DreamerAchievementsPanel
          firstName={firstName}
          fullName={homeData?.currentUser?.name || firstName}
          avatarUrl={homeData?.currentUser?.avatar_path || null}
          project={
            homeData?.currentUser?.dreamerProfile?.preferred_project ||
            homeData?.currentUser?.project ||
            null
          }
        />

        {supportActions.length ? (
          <section className="dreamer-open-actions">
            <div className="dreamer-open-actions__heading">
              <div>
                <span className="dreamer-section-label">AÇÕES QUE PRECISAM DE APOIO</span>
                <h2>Tem uma forma concreta de ajudar hoje.</h2>
              </div>
              <small>{supportActions.length} {supportActions.length === 1 ? 'ação publicada' : 'ações publicadas'}</small>
            </div>

            <div className="dreamer-open-actions__grid">
              {supportActions.slice(0, 6).map(action => {
                const meta = action.project ? getProjectMeta(action.project) : null
                const supportLabel = {
                  money: 'Apoio financeiro',
                  product: 'Produtos',
                  service: 'Serviços',
                  mixed: 'Várias formas',
                }[action.support_kind] || 'Apoio'

                return (
                  <article className={`${meta?.className || ''} ${action.featured ? 'is-featured' : ''}`} key={action.id}>
                    <div className="dreamer-open-actions__top">
                      <span>{action.project || 'SONHAR SP'}</span>
                      {action.featured ? <b>★ Destaque</b> : null}
                    </div>
                    <h3>{action.title}</h3>
                    <p>{action.summary || action.description || 'Uma necessidade real da nossa comunidade.'}</p>
                    <div className="dreamer-open-actions__meta">
                      <span>{supportLabel}</span>
                      {action.need_label ? <strong>{action.need_label}</strong> : null}
                    </div>
                    {action.contact_url ? (
                      <a href={action.contact_url} target="_blank" rel="noreferrer">Quero ajudar <span>→</span></a>
                    ) : (
                      <button type="button" disabled>Contato em breve</button>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="dreamer-partners">
          <div className="dreamer-partners__copy">
            <span className="dreamer-section-label">PARCEIROS E PATROCINADORES</span>
            <h2>Quem sonha com a gente</h2>
            <p>
              Empresas, marcas e profissionais podem apoiar festas e projetos com recursos financeiros, produtos, alimentação, transporte, espaços, serviços e conhecimento.
            </p>

            {partners.length ? (
              <div className="dreamer-partners__counts" aria-label="Rede de parceiros">
                <span><strong>{partnerCounts.sponsors}</strong> patrocinadores</span>
                <span><strong>{partnerCounts.partners}</strong> parceiros</span>
                <span><strong>{partnerCounts.supporters}</strong> apoiadores</span>
              </div>
            ) : null}

            <button type="button" disabled>Quero apoiar o Sonhar · em breve</button>
          </div>

          <div className="dreamer-partners__showcase">
            {partners.length ? (
              <>
                <span>Quem sonha junto</span>
                <strong>Uma rede que transforma apoio em experiências reais.</strong>

                {featuredPartner ? (() => {
                  const meta = getPartnerMeta(featuredPartner.partner_type)

                  return (
                    <article className={`dreamer-partners__featured ${meta.className}`}>
                      <div className="dreamer-partners__featured-logo">
                        {featuredPartner.logo_url ? (
                          <img src={featuredPartner.logo_url} alt={featuredPartner.name} />
                        ) : (
                          <span>{featuredPartner.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="dreamer-partners__featured-copy">
                        <small>{meta.icon} {meta.label} em destaque</small>
                        <h3>{featuredPartner.name}</h3>
                        <p>
                          {featuredPartner.support_summary ||
                            featuredPartner.description ||
                            'Apoio que ajuda o Sonhar Acordado a transformar boas ideias em experiências reais.'}
                        </p>

                        {featuredPartner.website_url ? (
                          <a href={featuredPartner.website_url} target="_blank" rel="noreferrer">
                            Conhecer parceiro <span>↗</span>
                          </a>
                        ) : null}
                      </div>
                    </article>
                  )
                })() : null}

                <div className="dreamer-partners__logos">
                  {partners.slice(0, 12).map(partner => {
                    const meta = getPartnerMeta(partner.partner_type)

                    const content = (
                      <>
                        <div className="dreamer-partners__logo-mark">
                          {partner.logo_url ? (
                            <img src={partner.logo_url} alt={partner.name} />
                          ) : (
                            <span>{partner.name.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <small>{partner.name}</small>
                        <b className={meta.className}>{meta.icon} {meta.label}</b>
                        {partner.support_summary ? <p>{partner.support_summary}</p> : null}
                      </>
                    )

                    return partner.website_url ? (
                      <a href={partner.website_url} target="_blank" rel="noreferrer" key={partner.id} title={partner.name}>
                        {content}
                      </a>
                    ) : (
                      <div key={partner.id} title={partner.name}>
                        {content}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <span>Seu apoio pode aparecer aqui</span>
                <strong>Parceiros que fazem o sonho acontecer.</strong>
                <div className="dreamer-partners__empty">
                  <i>★ PATROCINADOR</i>
                  <i>♥ PARCEIRO</i>
                  <i>✦ APOIADOR</i>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="dreamer-home-columns dreamer-home-columns--impact">
          <article className="dreamer-my-team">
            <span className="dreamer-section-label">SEU LUGAR NESSA HISTÓRIA</span>
            {preferredTeam ? (
              <>
                <div className={`dreamer-my-team__badge ${getProjectMeta(preferredTeam.project).className}`}>
                  <span>{getProjectMeta(preferredTeam.project).icon}</span>
                  <div>
                    <strong>{preferredTeam.project}</strong>
                    <small>{getProjectMeta(preferredTeam.project).label}</small>
                  </div>
                </div>
                <h3>Você já faz parte de um time que transforma.</h3>
                <p>Seu vínculo com a Central também ganha espaço aqui. Com o tempo, missões, conquistas e ações apoiadas vão formar sua história dentro do Sócio.</p>
              </>
            ) : canChooseDreamerTeam ? (
              <>
                <div className="dreamer-my-team__empty-mark">♡</div>
                <h3>Qual time faz seu coração torcer?</h3>
                <p>Escolha APS, PPF ou SJ para representar sua jornada no Sócio Sonhador. Essa escolha não altera nenhum acesso da Central.</p>
                <div className="dreamer-team-picker">
                  {Object.entries(PROJECT_META).map(([project, meta]) => (
                    <button
                      type="button"
                      className={meta.className}
                      key={project}
                      disabled={Boolean(teamSaving)}
                      onClick={() => chooseDreamerTeam(project)}
                    >
                      <span>{meta.icon}</span>
                      <strong>{project}</strong>
                      <small>{meta.label}</small>
                      <b>{teamSaving === project ? 'Salvando…' : 'Escolher time'}</b>
                    </button>
                  ))}
                </div>
                {teamMessage ? (
                  <small className="dreamer-team-picker__message">{teamMessage}</small>
                ) : null}
              </>
            ) : (
              <>
                <div className="dreamer-my-team__empty-mark">♡</div>
                <h3>Seu vínculo com a Central aparece aqui.</h3>
                <p>Assim que seu projeto estiver disponível, ele será refletido automaticamente no Sócio Sonhador.</p>
              </>
            )}
          </article>

          <article className="dreamer-next-mission dreamer-impact-transparency-v2">
            <div className="dreamer-next-mission__top">
              <span className="dreamer-section-label">IMPACTO & TRANSPARÊNCIA</span>
              <span className="dreamer-next-mission__icon">✦</span>
            </div>
            <h3>O que estamos tornando possível juntos.</h3>
            <p>
              Um retrato simples do que a Central já consegue acompanhar — sem contar valores pendentes como resultado.
            </p>

            <div className="dreamer-impact-transparency-v2__grid">
              <div className="is-money">
                <small>Apoio confirmado</small>
                <strong>{formatCurrency(totalRaised)}</strong>
                <span>Somente valores já validados.</span>
              </div>
              <div>
                <small>Rede de apoio</small>
                <strong>{activePartners}</strong>
                <span>{activePartners === 1 ? 'parceiro publicado' : 'parceiros publicados'}</span>
              </div>
              <div>
                <small>Ações abertas</small>
                <strong>{publishedSupportActions}</strong>
                <span>{publishedSupportActions === 1 ? 'forma de ajudar disponível' : 'formas de ajudar disponíveis'}</span>
              </div>
              <div>
                <small>Eventos acompanhados</small>
                <strong>{attendanceEvents}</strong>
                <span>Eventos considerados na frequência.</span>
              </div>
            </div>

            <div className="dreamer-impact-transparency-v2__note">
              <span>♡</span>
              <p>Transparência é mostrar apenas aquilo que o sistema realmente conhece e consegue comprovar.</p>
            </div>
          </article>
        </section>

        <footer className="dreamer-home-footer">
          <div>
            <span>♥</span>
            <strong>Sócio Sonhador</strong>
          </div>
          <p>Entrar por identificação. Ficar pelo pertencimento. Ajudar quando o coração pedir.</p>
        </footer>
      </>
    )
  }

  return (
    <main className="dreamer-page dreamer-home">
      <div className="dreamer-page__shell dreamer-home__shell">
        <header className="dreamer-home-nav">
          <button
            type="button"
            className="dreamer-home-brand"
            onClick={onBack}
          >
            <span>♥</span>
            <div>
              <strong>Sócio Sonhador</strong>
              <small>Central do Sonhar</small>
            </div>
          </button>

          <div className="dreamer-home-nav__actions">
            {isDreamerAdmin ? (
              <button
                type="button"
                className="dreamer-admin-entry"
                onClick={onOpenAdmin}
              >
                ⚙ Admin Sócio
              </button>
            ) : null}

            <button
              type="button"
              className="dreamer-home-nav__exit"
              onClick={onLogout}
            >
              Sair
            </button>
          </div>
        </header>

        {renderContent()}
      </div>
    </main>
  )
}

export default DreamerPage
