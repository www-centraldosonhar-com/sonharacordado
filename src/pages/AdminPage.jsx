import { useEffect, useState } from 'react'
import {
  formatDateBr,
  formatTimeBr,
} from '../utils/formatters'
import AdminManageActions from '../components/AdminManageActions'
import AdminImageUpload from '../components/AdminImageUpload'
import AdminChecklistPanel from '../components/AdminChecklistPanel'
import AdminAssistedEventOverview from '../components/AdminAssistedEventOverview'
import AdminRegistrationsPanel from '../components/AdminRegistrationsPanel'
import AdminAssistedPanel from '../components/AdminAssistedPanel'
import AdminFoodRestrictionsPanel from '../components/AdminFoodRestrictionsPanel'
import AdminVolunteerOverview from '../components/AdminVolunteerOverview'
import AdminExpensesPanel from '../components/AdminExpensesPanel'
import AdminPostEventPanel from '../components/AdminPostEventPanel'
import AdminPostEventTeamReports from '../components/AdminPostEventTeamReports'
import '../styles/admin.css'
import '../styles/admin-premium.css'
import AdminFinanceRequestsPanel from '../components/AdminFinanceRequestsPanel'
import AdminPeopleImport from '../components/AdminPeopleImport.jsx'
import AdminEventComposer from '../components/AdminEventComposer.jsx'

function AdminPage({
  user,
  onBack,
  onLogout,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [userProject, setUserProject] = useState('all')
  const [userTeam, setUserTeam] = useState('all')
  const [userStatus, setUserStatus] = useState('all')
  const [userPinStatus, setUserPinStatus] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState(null)
  const [userProfileTab, setUserProfileTab] = useState('overview')
  const [announcementComposerOpen, setAnnouncementComposerOpen] = useState(false)
  const [userParticipation, setUserParticipation] = useState([])
  const [userParticipationLoading, setUserParticipationLoading] = useState(false)
  const [userParticipationError, setUserParticipationError] = useState('')

  async function reloadAdmin() {
    const response = await fetch('/api/admin?action=data')
    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível carregar o painel.'
      )
    }

    setData(result)
  }

  useEffect(() => {
    let active = true

    fetch('/api/admin?action=data')
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar o painel.'
          )
        }

        if (active) {
          setData(result)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message)
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  if (isLoading) {
    return (
      <main className="admin-center">
        <p>
          Abrindo painel administrativo... ⚙️
        </p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="admin-center">
        <div className="admin-error">
          <h1>Painel Administrativo</h1>

          <p>{error}</p>

          <button
            type="button"
            onClick={onBack}
          >
            Voltar
          </button>
        </div>
      </main>
    )
  }

  // =====================================================
  // CONTEXTUAL ADMIN UI
  // =====================================================
  // Segurança continua sendo validada no backend.
  // Estas flags servem apenas para deixar a interface
  // limpa e adequada à função de cada Admin.
  // =====================================================

  const normalizedUserSearch =
    userSearch
      .trim()
      .toLowerCase()

  const availableUserTeams =
    Array.from(
      new Set(
        (data?.users || [])
          .filter((person) =>
            userProject === 'all'
              ? true
              : person.project === userProject
          )
          .flatMap((person) =>
            Array.isArray(person.team_names)
              ? person.team_names
              : person.team_names
                ? [person.team_names]
                : []
          )
          .filter(Boolean)
      )
    )
      .sort((a, b) =>
        String(a).localeCompare(
          String(b),
          'pt-BR'
        )
      )

  const filteredUsers =
    (data?.users || []).filter((person) => {
      const searchableText = [
        person.full_name,
        person.name,
        person.username,
        person.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !normalizedUserSearch ||
        searchableText.includes(
          normalizedUserSearch.replace(/^@/, '')
        ) ||
        searchableText.includes(
          normalizedUserSearch
        )

      const matchesProject =
        userProject === 'all' ||
        person.project === userProject

      const personTeams =
        Array.isArray(person.team_names)
          ? person.team_names
          : person.team_names
            ? [person.team_names]
            : []

      const matchesTeam =
        userTeam === 'all' ||
        personTeams.includes(userTeam)

      const matchesStatus =
        userStatus === 'all' ||
        (
          userStatus === 'active'
            ? Boolean(person.active)
            : !person.active
        )

      const hasPin =
        Boolean(
          person.has_pin
        )

      const matchesPin =
        userPinStatus === 'all' ||
        (
          userPinStatus === 'configured'
            ? hasPin
            : !hasPin
        )

      return (
        matchesSearch &&
        matchesProject &&
        matchesTeam &&
        matchesStatus &&
        matchesPin
      )
    })

  const hasUserFilters =
    Boolean(
      userSearch.trim() ||
      userProject !== 'all' ||
      userTeam !== 'all' ||
      userStatus !== 'all' ||
      userPinStatus !== 'all'
    )

  async function loadUserParticipation(userId) {
    if (!userId) {
      return
    }

    setUserParticipationLoading(true)
    setUserParticipationError('')

    try {
      const response = await fetch(
        `/api/admin?action=user-participation&userId=${encodeURIComponent(
          userId
        )}`
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível carregar as participações.'
        )
      }

      setUserParticipation(
        result.participations || []
      )
    } catch (error) {
      setUserParticipation([])
      setUserParticipationError(
        error?.message ||
        'Não foi possível carregar as participações.'
      )
    } finally {
      setUserParticipationLoading(false)
    }
  }


  async function handleCreateAnnouncement(event) {
    event.preventDefault()

    const form =
      new FormData(event.currentTarget)

    const payload = {
      action:
        'announcement',

      title:
        String(
          form.get('title') || ''
        ).trim(),

      message:
        String(
          form.get('message') || ''
        ).trim(),

      priority:
        String(
          form.get('priority') ||
          'normal'
        ),

      projectId:
        form.get('projectId')
          ? Number(
              form.get('projectId')
            )
          : null,

      teamId:
        form.get('teamId')
          ? Number(
              form.get('teamId')
            )
          : null,
    }

    if (
      !payload.title ||
      !payload.message
    ) {
      window.alert(
        'Informe título e mensagem.'
      )

      return
    }

    try {
      const response = await fetch(
        '/api/admin?action=create',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(payload),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível publicar o comunicado.'
        )
      }

      event.currentTarget.reset()

      await reloadAdmin()

      setAnnouncementComposerOpen(false)

      window.alert(
        result.message ||
        'Comunicado publicado! 📢'
      )
    } catch (error) {
      window.alert(
        error?.message ||
        'Não foi possível publicar o comunicado.'
      )
    }
  }


  const adminScope =
    data.adminAccess?.scope || null

  const adminTeamCodes =
    (data.adminAccess?.teams || [])
      .map(
        (team) =>
          team.code
      )

  const isGlobalAdmin =
    adminScope === 'global'

  const isProjectAdmin =
    adminScope === 'project'

  const isTeamAdmin =
    adminScope === 'team'

  const isVolunteerAdmin =
    isTeamAdmin &&
    adminTeamCodes.includes(
      'volunteers'
    )

  const isMediaAdmin =
    isTeamAdmin &&
    adminTeamCodes.includes(
      'media'
    )

  const isManagementAdmin =
    isGlobalAdmin ||
    isProjectAdmin

  const capabilities =
    data.adminAccess?.capabilities || {}

  // Fallbacks preservam compatibilidade com respostas
  // antigas da API durante deploys e desenvolvimento local.
  const canEditMonthlyCommunity =
    capabilities.canEditMonthlyCommunity ??
    (isGlobalAdmin || isMediaAdmin)

  const canSeeUsers =
    capabilities.canViewPeople ??
    (isManagementAdmin || isVolunteerAdmin)

  const canSeeEvents =
    capabilities.canViewEvents ??
    isManagementAdmin

  const canManageEvents =
    capabilities.canManageEvents ??
    isManagementAdmin


  const canSeeActivities =
    capabilities.canViewActivities ??
    (
      isManagementAdmin ||
      isMediaAdmin ||
      isVolunteerAdmin
    )

  const canSeeAnnouncements =
    capabilities.canViewAnnouncements ??
    (isManagementAdmin || isTeamAdmin)

  const canSeeExpenses =
    capabilities.canViewExpenses ??
    (
      isGlobalAdmin ||
      isProjectAdmin ||
      isTeamAdmin
    )

  const activeAdminPeople =
    (data.users || []).filter(
      (person) => Number(person.active) !== 0
    )

  const activeVolunteers =
    activeAdminPeople.filter(
      (person) => person.user_type === 'volunteer'
    )

  const projectVolunteerCount =
    activeVolunteers.length

  const volunteerTeamCount =
    activeVolunteers.filter(
      (person) =>
        (person.team_codes || []).includes('volunteers')
    ).length

  const mediaMemberCount =
    activeAdminPeople.filter(
      (person) =>
        (person.team_codes || []).includes('media')
    ).length

  const representedProjectCount =
    new Set(
      activeAdminPeople
        .map((person) => person.project_id)
        .filter(Boolean)
    ).size

  const adminPeopleCount =
    activeAdminPeople.filter(
      (person) =>
        person.permissions?.includes('admin')
    ).length

  const volunteerTeamAdminCount =
    activeAdminPeople.filter(
      (person) =>
        person.permissions?.includes('admin') &&
        (person.team_codes || []).includes('volunteers')
    ).length

  const pendingFirstAccessCount =
    activeVolunteers.filter(
      (person) => !person.has_pin
    ).length

  const eventCount =
    (data.events || []).length

  const activityCount =
    (data.eventRoles || []).length

  let contextualOverviewTitle =
    'Sua equipe em números'

  let contextualOverviewMetrics = [
    {
      label: 'Voluntários da equipe',
      value: projectVolunteerCount,
      description: 'ativos na sua equipe',
      className: 'is-primary',
    },
    {
      label: 'Eventos do projeto',
      value: eventCount,
      description: 'no seu contexto',
    },
    {
      label: 'Atividades',
      value: activityCount,
      description: 'da sua equipe',
    },
    {
      label: 'Primeiro acesso',
      value: pendingFirstAccessCount,
      description: 'ainda sem PIN',
      className: 'is-attention',
    },
  ]

  if (isGlobalAdmin) {
    contextualOverviewTitle =
      'Central em números'

    contextualOverviewMetrics = [
      {
        label: 'Voluntários',
        value: projectVolunteerCount,
        description: 'ativos na Central',
        className: 'is-primary',
      },
      {
        label: 'Admins',
        value: adminPeopleCount,
        description: 'com acesso administrativo',
      },
      {
        label: 'Eventos',
        value: eventCount,
        description: 'cadastrados',
      },
      {
        label: 'Atividades',
        value: activityCount,
        description: 'configuradas',
      },
      {
        label: 'Primeiro acesso',
        value: pendingFirstAccessCount,
        description: 'ainda sem PIN',
        className: 'is-attention',
      },
    ]
  } else if (isProjectAdmin) {
    contextualOverviewTitle =
      'Seu projeto em números'

    contextualOverviewMetrics = [
      {
        label: 'Voluntários',
        value: projectVolunteerCount,
        description: 'ativos no projeto',
        className: 'is-primary',
      },
      {
        label: 'Admins',
        value: adminPeopleCount,
        description: 'no projeto',
      },
      {
        label: 'Eventos',
        value: eventCount,
        description: 'do projeto',
      },
      {
        label: 'Atividades',
        value: activityCount,
        description: 'configuradas',
      },
      {
        label: 'Primeiro acesso',
        value: pendingFirstAccessCount,
        description: 'ainda sem PIN',
        className: 'is-attention',
      },
    ]
  } else if (isVolunteerAdmin) {
    contextualOverviewTitle =
      'Voluntários do projeto'

    contextualOverviewMetrics = [
      {
        label: 'Voluntários do projeto',
        value: projectVolunteerCount,
        description:
          `${volunteerTeamCount} ${
            volunteerTeamCount === 1
              ? 'é da equipe Voluntários'
              : 'são da equipe Voluntários'
          }`,
        className: 'is-primary',
      },
      {
        label: 'Admins',
        value: adminPeopleCount,
        description:
          `${volunteerTeamAdminCount} ${
            volunteerTeamAdminCount === 1
              ? 'faz parte da equipe Voluntários'
              : 'fazem parte da equipe Voluntários'
          }`,
      },
      {
        label: 'Eventos',
        value: eventCount,
        description: 'do projeto',
      },
      {
        label: 'Atividades',
        value: activityCount,
        description: 'da equipe Voluntários',
      },
      {
        label: 'Primeiro acesso',
        value: pendingFirstAccessCount,
        description: 'do projeto sem PIN',
        className: 'is-attention',
      },
    ]
  } else if (isMediaAdmin) {
    contextualOverviewTitle =
      'Mídias em números'

    contextualOverviewMetrics = [
      {
        label: 'Membros de Mídias',
        value: mediaMemberCount,
        description: 'ativos na equipe',
        className: 'is-primary',
      },
      {
        label: 'Projetos representados',
        value: representedProjectCount,
        description: 'dentro de Mídias',
      },
      {
        label: 'Eventos',
        value: eventCount,
        description: 'disponíveis para Mídias',
      },
      {
        label: 'Atividades',
        value: activityCount,
        description: 'da equipe Mídias',
      },
      {
        label: 'Primeiro acesso',
        value: pendingFirstAccessCount,
        description: 'em Mídias sem PIN',
        className: 'is-attention',
      },
    ]
  }


  // =======================================================
  // CENTRAL 3.0 — MÉTRICAS EXPLORÁVEIS
  // =======================================================
  // Usa exclusivamente dados que já vieram no admin-data.
  // Nenhuma chamada adicional ao backend é feita ao abrir
  // um card da Visão Geral.
  // =======================================================

  function getMetricDetail(metric) {
    const label =
      metric?.label || ''

    if (
      label === 'Voluntários' ||
      label === 'Voluntários do projeto' ||
      label === 'Voluntários da equipe' ||
      label === 'Equipe Voluntários'
    ) {
      return {
        type: 'people',
        title: label,
        items:
          label === 'Equipe Voluntários'
            ? activeVolunteers.filter(
                (person) =>
                  (person.team_codes || [])
                    .includes('volunteers')
              )
            : activeVolunteers,
      }
    }

    if (label === 'Admins') {
      return {
        type: 'people',
        title: 'Admins',
        items:
          activeAdminPeople.filter(
            (person) =>
              person.permissions?.includes(
                'admin'
              )
          ),
      }
    }

    if (label === 'Membros de Mídias') {
      return {
        type: 'people',
        title: 'Equipe Mídias',
        items:
          activeAdminPeople.filter(
            (person) =>
              (person.team_codes || [])
                .includes('media')
          ),
      }
    }

    if (label === 'Primeiro acesso') {
      return {
        type: 'people',
        title: 'Primeiro acesso pendente',
        items:
          activeVolunteers.filter(
            (person) =>
              !person.has_pin
          ),
      }
    }

    if (label === 'Eventos') {
      return {
        type: 'events',
        title: 'Eventos',
        items: data.events || [],
      }
    }

    if (label === 'Atividades') {
      return {
        type: 'activities',
        title: 'Atividades',
        items: data.eventRoles || [],
      }
    }

    return null
  }


  function getMetricItemTitle(
    item,
    type
  ) {
    if (type === 'people') {
      return (
        item.full_name ||
        item.name ||
        item.username ||
        'Pessoa sem nome'
      )
    }

    if (type === 'events') {
      return (
        item.name ||
        item.title ||
        item.event_name ||
        'Evento'
      )
    }

    return (
      item.role_name ||
      item.activity_name ||
      item.name ||
      item.title ||
      'Atividade'
    )
  }


  function getMetricItemDescription(
    item,
    type
  ) {
    if (type === 'people') {
      const parts = []

      if (item.username) {
        parts.push(
          `@${item.username}`
        )
      }

      if (
        Array.isArray(item.team_names) &&
        item.team_names.length
      ) {
        parts.push(
          item.team_names.join(' · ')
        )
      }

      if (
        item.project_code ||
        item.project_name
      ) {
        parts.push(
          item.project_code ||
          item.project_name
        )
      }

      return parts.join(' • ')
    }

    if (type === 'events') {
      return (
        item.project_code ||
        item.project_name ||
        item.location ||
        ''
      )
    }

    const parts = []

    if (
      item.event_name ||
      item.event_title
    ) {
      parts.push(
        item.event_name ||
        item.event_title
      )
    }

    if (
      item.team_name ||
      item.team_code
    ) {
      parts.push(
        item.team_name ||
        item.team_code
      )
    }

    return parts.join(' • ')
  }


  function openMetricDetails(metric) {
    const detail =
      getMetricDetail(metric)

    if (!detail) {
      return
    }

    setSelectedMetric(detail)
  }

  // =======================================================
  // CENTRAL 3.0 — NAVEGAÇÃO ADMINISTRATIVA CONTEXTUAL
  // =======================================================
  // A navegação nasce das mesmas capabilities utilizadas
  // pelo restante do painel.
  //
  // O objetivo é evitar menus fixos e regras de visibilidade
  // espalhadas pelo JSX.
  // =======================================================

  const canManageRegistrations =
    capabilities.canManageRegistrations ??
    data.adminAccess?.canManageRegistrations ??
    false


  // -------------------------------------------------------
  // Nome contextual da área de pessoas
  // -------------------------------------------------------

  let peopleNavigationLabel =
    'Equipe'

  if (
    isGlobalAdmin ||
    isProjectAdmin ||
    isVolunteerAdmin
  ) {
    peopleNavigationLabel =
      'Pessoas'
  }


  const adminNavigation = [
    {
      id: 'usuarios',
      label: peopleNavigationLabel,
      icon: '👥',
      visible: canSeeUsers,
    },

    {
      id: 'eventos',
      label: 'Eventos',
      icon: '📅',
      visible: canSeeEvents,
    },

    {
      id: 'relatorios-equipe',
      label: 'Fechamento da Equipe',
      icon: '📋',
      visible:
        isTeamAdmin &&
        !isManagementAdmin,
    },

    {
      id: 'inscricoes',
      label: 'Inscrições',
      icon: '📝',
      visible: canManageRegistrations,
    },

    {
      id: 'gastos',
      label: 'Gastos',
      icon: '💳',
      visible: canSeeExpenses,
    },

    {
      id: 'atividades',
      label: 'Atividades',
      icon: '🙋',
      visible: canSeeActivities,
    },

    {
      id: 'comunicados',
      label: 'Comunicados',
      icon: '📢',
      visible: canSeeAnnouncements,
    },
  ].filter(
    (item) =>
      item.visible
  )

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div>
            <div className="admin-hearts">
              <span className="heart-red">♥</span>
              <span className="heart-orange">♥</span>
              <span className="heart-blue">♥</span>
            </div>

            <p className="admin-kicker">
              CENTRAL DO SONHAR
            </p>

            <h1>
              Painel Administrativo
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

      <nav className="admin-nav">
          {adminNavigation.map(
            (item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="admin-quick-nav-link"
              >
                <span
                  className="admin-quick-nav-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </a>
            )
          )}
        </nav>

      <main className="admin-shell">

        <section
          className="admin-operational-overview"
          aria-label="Resumo administrativo"
        >
          <div className="admin-operational-overview-heading">
            <div>
              <small>VISÃO GERAL</small>
              <strong>{contextualOverviewTitle}</strong>
            </div>

            <span>Atualizado agora</span>
          </div>

          <div className="admin-operational-overview-grid">
            {contextualOverviewMetrics.map((metric) => {
              const detail =
                getMetricDetail(metric)

              return (
                <article
                  key={metric.label}
                  className={[
                    metric.className || '',
                    detail
                      ? 'is-explorable'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role={
                    detail
                      ? 'button'
                      : undefined
                  }
                  tabIndex={
                    detail
                      ? 0
                      : undefined
                  }
                  onClick={() => {
                    if (detail) {
                      openMetricDetails(
                        metric
                      )
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      detail &&
                      (
                        event.key ===
                          'Enter' ||
                        event.key ===
                          ' '
                      )
                    ) {
                      event.preventDefault()

                      openMetricDetails(
                        metric
                      )
                    }
                  }}
                >
                  <span>
                    {metric.label}
                  </span>

                  <strong>
                    {metric.value}
                  </strong>

                  <small>
                    {metric.description}
                  </small>

                  {detail && (
                    <span className="admin-metric-detail-hint">
                      Ver detalhes
                      <span
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </span>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        {canEditMonthlyCommunity && (
          <section
            className="admin-section admin-monthly-section"
          >
            <details
              className="admin-collapsible"
            >
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <div className="admin-collapsible-icon">
                    ✨
                  </div>

                  <div>
                    <h2>
                      Identidade do mês
                    </h2>

                    <small>
                      Palavra e mensagem da Comunidade
                    </small>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  mês atual
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <form
                  className="admin-monthly-form"
                  onSubmit={async (event) => {
                    event.preventDefault()

                    const form =
                      new FormData(
                        event.currentTarget
                      )

                    const response =
                      await fetch(
                        '/api/admin?action=update',
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type':
                              'application/json',
                          },
                          body: JSON.stringify({
                            action:
                              'update-monthly-community',

                            data: {
                              word:
                                form.get('word'),

                              message:
                                form.get('message'),
                            },
                          }),
                        }
                      )

                    const result =
                      await response.json()

                    if (!response.ok) {
                      window.alert(
                        result.error ||
                        'Não foi possível atualizar.'
                      )
                      return
                    }

                    window.alert(
                      result.message ||
                      'Identidade atualizada! ✨'
                    )

                    window.location.reload()
                  }}
                >
                  <div className="admin-monthly-grid">
                    <label>
                      <span>
                        Palavra do mês
                      </span>

                      <input
                        name="word"
                        type="text"
                        maxLength="120"
                        defaultValue={
                          data
                            ?.monthlyCommunity
                            ?.word ||
                          'Bondade'
                        }
                        required
                      />
                    </label>

                    <label>
                      <span>
                        Mensagem
                      </span>

                      <textarea
                        name="message"
                        rows="4"
                        defaultValue={
                          data
                            ?.monthlyCommunity
                            ?.message ||
                          'Pequenos gestos também transformam grandes histórias.'
                        }
                      />
                    </label>
                  </div>

                  <div className="admin-monthly-actions">
                    <button
                      type="submit"
                      className="primary-button"
                    >
                      Salvar identidade
                    </button>
                  </div>
                </form>
              </div>
            </details>
          </section>
        )}

        {isProjectAdmin && (
          <AdminFinanceRequestsPanel />
        )}


        {canSeeUsers && (
        <section
          id="usuarios"
          className="admin-section admin-section-collapsible"
        >

          {(
            isGlobalAdmin ||
            isProjectAdmin ||
            isVolunteerAdmin
          ) && (
            <AdminPeopleImport />
          )}

          <details className="admin-collapsible">
            <summary className="admin-collapsible-summary">
              <div className="admin-collapsible-title">
                <span className="admin-collapsible-icon">
                  👥
                </span>

                <div>
                  <small>
                    QUEM FAZ ACONTECER
                  </small>

                  <strong>
                    Voluntários e usuários
                  </strong>
                </div>
              </div>

              <span className="admin-collapsible-count">
                {hasUserFilters
                  ? `${filteredUsers.length}/${data.users.length}`
                  : data.users.length}
              </span>
            </summary>

            <div className="admin-collapsible-body">
              <div className="admin-user-filters">
                <div className="admin-user-search-wrap">
                  <span aria-hidden="true">
                    ⌕
                  </span>

                  <input
                    type="search"
                    value={userSearch}
                    onChange={(event) =>
                      setUserSearch(
                        event.target.value
                      )
                    }
                    placeholder="Buscar por nome ou @usuário"
                  />
                </div>

                <div className="admin-user-project-tabs">
                  {['all', 'APS', 'PPF', 'SJ'].map(
                    (project) => (
                      <button
                        key={project}
                        type="button"
                        className={
                          userProject === project
                            ? 'is-active'
                            : ''
                        }
                        onClick={() => {
                          setUserProject(project)
                          setUserTeam('all')
                        }}
                      >
                        {project === 'all'
                          ? 'Todos'
                          : project}
                      </button>
                    )
                  )}
                </div>

                <div className="admin-user-filter-selects">
                  <label>
                    <span>
                      Equipe
                    </span>

                    <select
                      value={userTeam}
                      onChange={(event) =>
                        setUserTeam(
                          event.target.value
                        )
                      }
                    >
                      <option value="all">
                        Todas as equipes
                      </option>

                      {availableUserTeams.map(
                        (team) => (
                          <option
                            key={team}
                            value={team}
                          >
                            {team}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Status
                    </span>

                    <select
                      value={userStatus}
                      onChange={(event) =>
                        setUserStatus(
                          event.target.value
                        )
                      }
                    >
                      <option value="all">
                        Todos
                      </option>

                      <option value="active">
                        Ativos
                      </option>

                      <option value="inactive">
                        Inativos
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>
                      Acesso
                    </span>

                    <select
                      value={userPinStatus}
                      onChange={(event) =>
                        setUserPinStatus(
                          event.target.value
                        )
                      }
                    >
                      <option value="all">
                        Todos
                      </option>

                      <option value="configured">
                        PIN configurado
                      </option>

                      <option value="pending">
                        Primeiro acesso pendente
                      </option>
                    </select>
                  </label>

                </div>

                <div className="admin-user-filter-footer">
                  <span>
                    {filteredUsers.length}
                    {' '}
                    de
                    {' '}
                    {data.users.length}
                    {' '}
                    usuários
                  </span>

                  {hasUserFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearch('')
                        setUserProject('all')
                        setUserTeam('all')
                        setUserStatus('all')
                        setUserPinStatus('all')
                      }}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-grid">
            {filteredUsers.map((person) => (
              <article
                className="admin-card"
                key={person.id}
              
                onClick={(event) => {
                  if (
                    event.target.closest(
                      'button, a, input, select, textarea, label, form'
                    )
                  ) {
                    return
                  }

                  setSelectedUser(person)
                  setUserProfileTab('overview')
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' ||
                    event.key === ' '
                  ) {
                    setSelectedUser(person)
                    setUserProfileTab('overview')
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="admin-user-top">
                  {person.avatar_path ? (
                    <img
                      src={person.avatar_path}
                      alt={`Avatar de ${person.username
  ? `@${person.username}`
  : person.name}`}
                      className="admin-avatar"
                    />
                  ) : (
                    <div className="admin-avatar admin-avatar-fallback">
                      {person.name
                        ?.charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h3>
                      {person.full_name || person.name}
                    </h3>

                    <span className="admin-user-identity">
                      {person.username
                        ? `@${person.username}`
                        : 'Sem usuário'}
                      {' · '}
                      {person.project || 'Sem projeto'}
                    </span>
                  </div>
                </div>

                <p>
                  Acesso:{' '}
                  {person.permissions?.includes(
                    'admin'
                  )
                    ? person.admin_scope ===
                      'global'
                      ? '🛡️ Admin Geral'
                      : person.admin_scope ===
                        'project'
                        ? '🏠 Admin de Projeto'
                        : '⚙️ Admin de equipe'
                    : person.permissions?.includes(
                        'volunteer'
                      )
                      ? '🫶 Voluntário'
                      : person.permissions?.includes(
                          'dreamer'
                        )
                        ? '❤️ Sócio Sonhador'
                        : '— Sem acesso definido'}
                </p>

                {person.team_names?.length > 0 && (
                  <p>
                    👥{' '}
                    {person.team_names.join(
                      ', '
                    )}
                  </p>
                )}

                {person.email && (
                  <p>
                    {person.email}
                  </p>
                )}

                <p>
                  {person.active
                    ? '🟢 Ativo'
                    : '⚪ Inativo'}
                </p>

                <AdminImageUpload
                  target="avatar"
                  id={person.id}
                  label={
                    person.avatar_path
                      ? '📸 Trocar avatar'
                      : '📸 Adicionar avatar'
                  }
                  onUpdated={reloadAdmin}
                />

                <AdminManageActions
                  type="user"
                  item={person}
                  projects={data.projects}
                  teams={data.teams || []}
                  onUpdated={reloadAdmin}
                />
              </article>
            ))}
              </div>
            </div>
          </details>
        </section>
        )}
        {canSeeEvents && (
        <section
          id="eventos"
          className="admin-section admin-section-collapsible"
        >
          <details className="admin-collapsible">
            <summary className="admin-collapsible-summary">
              <div className="admin-collapsible-title">
                <span className="admin-collapsible-icon">
                  📅
                </span>

                <div>
                  <small className="admin-orange">
                    PRÓXIMOS ENCONTROS
                  </small>

                  <strong>
                    Eventos
                  </strong>
                </div>
              </div>

              <span className="admin-collapsible-count">
                {data.events.length}
              </span>
            </summary>

            <div className="admin-collapsible-body">
              {canManageEvents && (
                <AdminEventComposer
                  projects={data.projects || []}
                  events={data.events || []}
                  onCreated={reloadAdmin}
                  draftOwnerKey={
                    user?.id || 'admin'
                  }
                />
              )}

              <div className="admin-grid">
            {data.events.map((event) => (
              <article
                className="admin-card"
                key={event.id}
              >
                <h3>
                  {event.name}
                </h3>

                <p>
                  📅 {formatDateBr(
                    event.event_date
                  )}
                </p>

                <p>
                  🕐 {String(
                    formatTimeBr(
                      event.event_time
                    )
                  ).slice(0, 5)}
                </p>

                <p>
                  📍 {event.location}
                </p>

                {event.paired_registration_event_name && (
                  <p>
                    ✨ Inscrição dupla com {event.paired_registration_event_name}
                  </p>
                )}

                {event.location && (
                  <div className="admin-event-map-actions">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        event.location
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-event-map-link"
                    >
                      🗺️ Google Maps
                    </a>

                    <a
                      href={`https://www.waze.com/ul?q=${encodeURIComponent(
                        event.location
                      )}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-event-map-link"
                    >
                      🚙 Waze
                    </a>
                  </div>
                )}

                <p>
                  {event.project ||
                    'Evento geral da ONG'}
                </p>

                <p>
                  {event.active
                    ? '🟢 Ativo'
                    : '⚪ Inativo'}
                </p>

                {event.event_image_path && (
                  <img
                    className="admin-event-image"
                    src={event.event_image_path}
                    alt={`Capa de ${event.name}`}
                  />
                )}

                {canManageEvents && (
                  <>
                    <AdminImageUpload
                      target="event"
                      id={event.id}
                      label={
                        event.event_image_path
                          ? '🎨 Trocar capa'
                          : '🎨 Adicionar capa'
                      }
                      onUpdated={reloadAdmin}
                    />

                    <AdminManageActions
                      type="event"
                      item={event}
                      projects={data.projects}
                      events={data.events || []}
                      onUpdated={reloadAdmin}
                    />
                  </>
                )}
              </article>
            ))}
              </div>
            </div>
          </details>
        </section>
        )}

        {isManagementAdmin && (
          <section
            id="pos-evento"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    🌙
                  </span>

                  <div>
                    <small>
                      DEPOIS DO EVENTO
                    </small>

                    <strong>
                      Pós-Evento
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  {(data.events || []).length}
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminPostEventPanel
                  events={
                    data.events || []
                  }
                  onUpdated={
                    reloadAdmin
                  }
                />
              </div>
            </details>
          </section>
        )}

        {(
          isTeamAdmin &&
          !isManagementAdmin
        ) && (
          <section
            id="relatorios-equipe"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    📊
                  </span>

                  <div>
                    <small>
                      DEPOIS DO EVENTO
                    </small>

                    <strong>
                      Fechamento da Equipe
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  {(data.events || []).length}
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminPostEventTeamReports
                  events={
                    data.events || []
                  }
                  teams={
                    data.teams || []
                  }
                  access={
                    data.adminAccess
                  }
                />
              </div>
            </details>
          </section>
        )}

        {data.adminAccess
          ?.canManageRegistrations && (
          <section
            id="inscricoes"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    📝
                  </span>

                  <div>
                    <small>
                      INSCRIÇÕES E PRESENÇAS
                    </small>

                    <strong>
                      Inscrições
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  {(data.registrations || []).length}
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminRegistrationsPanel
                  registrations={
                    data.registrations || []
                  }
                  coupons={
                    data.registrationCoupons || []
                  }
                  canManageCoupons={
                    data.adminAccess
                      ?.canManageCoupons ||
                    false
                  }
                  onUpdated={reloadAdmin}
                />
              </div>
            </details>
          </section>
        )}

        {data.adminAccess
          ?.canManageAssisted && (
          <section
            id="assistidos"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    🧡
                  </span>

                  <div>
                    <small>
                      PESSOAS E ACOLHIMENTO
                    </small>

                    <strong>
                      Assistidos
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  Cadastro
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminAssistedPanel
                  onUpdated={reloadAdmin}
                  projects={data.projects || []}
                  access={data.adminAccess}
                />
              </div>
            </details>
          </section>
        )}

        {data.adminAccess
          ?.canViewFoodRestrictions && (
          <section
            id="alimentacao"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    🍎
                  </span>

                  <div>
                    <small>
                      CUIDADO NO EVENTO
                    </small>

                    <strong>
                      Alimentação
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  Alergias
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminFoodRestrictionsPanel />
              </div>
            </details>
          </section>
        )}

        {data.adminAccess
          ?.canManageRegistrations && (
          <section
            id="visao-voluntarios"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    👥
                  </span>

                  <div>
                    <small>
                      INDICADORES DE PESSOAS
                    </small>

                    <strong>
                      Visão de voluntários
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  {(data.volunteerEventStats || []).length}
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminVolunteerOverview
                  events={
                    data.volunteerEventStats || []
                  }
                />
              </div>
            </details>
          </section>
        )}

        {canSeeExpenses && (
          <section
            id="gastos"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    💳
                  </span>

                  <div>
                    <small>
                      CONTROLE FINANCEIRO
                    </small>

                    <strong>
                      Gastos
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  {(data.events || []).length}
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminExpensesPanel
                  events={
                    data.events || []
                  }
                  teams={
                    data.teams || []
                  }
                  access={
                    data.adminAccess
                  }
                  draftOwnerKey={
                    user?.id || 'admin'
                  }
                />
              </div>
            </details>
          </section>
        )}
        {canSeeActivities && (
        <section
          id="atividades"
          className="admin-section admin-section-collapsible"
        >
          <details className="admin-collapsible">
            <summary className="admin-collapsible-summary">
              <div className="admin-collapsible-title">
                <span className="admin-collapsible-icon">
                  🙋
                </span>

                <div>
                  <small>
                    VAGAS E FUNÇÕES
                  </small>

                  <strong>
                    Atividades
                  </strong>
                </div>
              </div>

              <span className="admin-collapsible-count">
                {data.eventRoles.length}
              </span>
            </summary>

            <div className="admin-collapsible-body">
              <div className="admin-grid">
            {Array.from(
              (data.eventRoles || [])
                .reduce(
                  (groups, activity) => {
                    const eventId =
                      Number(
                        activity.event_id
                      )

                    if (
                      !groups.has(eventId)
                    ) {
                      groups.set(
                        eventId,
                        {
                          eventId,
                          eventName:
                            activity.event_name ||
                            'Evento',
                          eventDate:
                            activity.event_date,
                          activities: [],
                        }
                      )
                    }

                    groups
                      .get(eventId)
                      .activities
                      .push(activity)

                    return groups
                  },
                  new Map()
                )
                .values()
            ).map((group) => {
              const totalConfirmed =
                group.activities.reduce(
                  (total, activity) =>
                    total +
                    Number(
                      activity.confirmed_count ||
                      0
                    ),
                  0
                )

              return (
                <details
                  key={group.eventId}
                  className="admin-activity-event-group"
                >
                  <summary className="admin-activity-event-summary">
                    <div>
                      <small>
                        EVENTO
                      </small>

                      <strong>
                        {group.eventName}
                      </strong>

                      {group.eventDate && (
                        <span>
                          {(() => {
                            const raw =
                              String(
                                group.eventDate
                              )

                            const dateOnly =
                              raw.match(
                                /^\\d{4}-\\d{2}-\\d{2}/
                              )?.[0]

                            const parsed =
                              dateOnly
                                ? new Date(
                                    `${dateOnly}T12:00:00`
                                  )
                                : new Date(raw)

                            return Number.isNaN(
                              parsed.getTime()
                            )
                              ? ''
                              : parsed.toLocaleDateString(
                                  'pt-BR'
                                )
                          })()}
                        </span>
                      )}
                    </div>

                    <div className="admin-activity-event-summary-meta">
                      <span>
                        {group.activities.length}
                        {' '}
                        {group.activities.length === 1
                          ? 'atividade'
                          : 'atividades'}
                      </span>

                      <span>
                        {totalConfirmed}
                        {' '}
                        {totalConfirmed === 1
                          ? 'confirmação'
                          : 'confirmações'}
                      </span>

                      <i aria-hidden="true">
                        ⌄
                      </i>
                    </div>
                  </summary>

                  <div className="admin-activity-event-content">
                    {group.activities.map((activity) => {
              const remaining =
                Number(activity.vacancy_limit) -
                Number(activity.confirmed_count)

              const acceptUntilDate =
                activity.accept_until
                  ? new Date(
                      activity.accept_until
                    )
                  : null

              const activityDeadlinePassed =
                Boolean(
                  acceptUntilDate &&
                  !Number.isNaN(
                    acceptUntilDate.getTime()
                  ) &&
                  acceptUntilDate < new Date()
                )

              const activityIsFull =
                remaining <= 0

              const activityStatus =
                !activity.active
                  ? {
                      key: 'disabled',
                      label: '⚪ Desativada',
                    }
                  : activityDeadlinePassed
                    ? {
                        key: 'expired',
                        label: '🔒 Prazo encerrado',
                      }
                    : activityIsFull
                      ? {
                          key: 'full',
                          label: '🔵 Vagas preenchidas',
                        }
                      : {
                          key: 'open',
                          label: '🟢 Aceitando voluntários',
                        }

              const activityParticipants =
                activity.participants || []

              const pendingDeliveries =
                activityParticipants.filter(
                  (participant) =>
                    participant.photo_submitted_at &&
                    !participant.completed_at &&
                    participant.delivery_review_status !==
                      'approved' &&
                    participant.delivery_review_status !==
                      'changes_requested'
                ).length

              const requestedChanges =
                activityParticipants.filter(
                  (participant) =>
                    participant.delivery_review_status ===
                    'changes_requested'
                ).length

              return (
                <details
                  className="admin-activity-card"
                  key={activity.id}
                >
                  <summary className="admin-activity-card-summary">
                    <div className="admin-activity-card-summary-main">
                      <small>
                        ATIVIDADE
                      </small>

                      <strong>
                        {activity.role_name}
                      </strong>

                      <span>
                        {activity.confirmed_count || 0}
                        {' / '}
                        {activity.vacancy_limit}
                        {' vagas'}
                      </span>

                      <div className="admin-activity-summary-alerts">
                        <span>
                          👥 {activityParticipants.length}
                          {' '}
                          {activityParticipants.length === 1
                            ? 'participante'
                            : 'participantes'}
                        </span>

                        {pendingDeliveries > 0 && (
                          <span className="is-review">
                            🔎 {pendingDeliveries}
                            {' '}
                            {pendingDeliveries === 1
                              ? 'em análise'
                              : 'em análise'}
                          </span>
                        )}

                        {requestedChanges > 0 && (
                          <span className="is-changes">
                            ↩ {requestedChanges}
                            {' '}
                            {requestedChanges === 1
                              ? 'correção'
                              : 'correções'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="admin-activity-card-summary-side">
                      <span
                        className={`admin-activity-summary-state is-${activityStatus.key}`}
                      >
                        {activityStatus.label}
                      </span>

                      <i aria-hidden="true">
                        ⌄
                      </i>
                    </div>
                  </summary>

                  <div className="admin-activity-card-body">
                  <h3>
                    {activity.role_name}
                  </h3>

                  <p>
                    {activity.event_name}
                  </p>

                  {activity.description && (
                    <p>
                      {activity.description}
                    </p>
                  )}

                  <div className="admin-numbers">
                    <span>
                      ✅ {activity.confirmed_count}
                    </span>

                    <span>
                      🙋 {Math.max(
                        remaining,
                        0
                      )}
                    </span>

                    <span>
                      Total: {activity.vacancy_limit}
                    </span>
                  </div>

                  <div className="admin-activity-section-head">
                    <div>
                      <small>
                        CONFIGURAÇÃO
                      </small>

                      <strong>
                        Gestão da atividade
                      </strong>
                    </div>

                    <span>
                      Vagas, prazo e regras
                    </span>
                  </div>

                  <div className="admin-activity-status-row">
                    <span
                      className={`admin-activity-state is-${activityStatus.key}`}
                    >
                      {activityStatus.label}
                    </span>

                    {activity.accept_until && (
                      <span className="admin-activity-deadline">
                        Aceitar voluntários até
                        {' '}
                        {(() => {
                          const date =
                            new Date(
                              activity.accept_until
                            )

                          return Number.isNaN(
                            date.getTime()
                          )
                            ? ''
                            : date.toLocaleString(
                                'pt-BR',
                                {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )
                        })()}
                      </span>
                    )}
                  </div>

                  <AdminManageActions
                    type="activity"
                    item={activity}
                    teams={data.teams || []}
                    onUpdated={reloadAdmin}
                  />

                  {Number(
                    activity.allows_checklist
                  ) === 1 && (
                    <>
                      <AdminChecklistPanel
                        activity={activity}
                        participants={
                          data.activityParticipants ||
                          []
                        }
                      />

                      <AdminAssistedEventOverview
                        activity={activity}
                      />
                    </>
                  )}

                  {data.activityParticipants
                    ?.filter(
                      (participant) =>
                        Number(participant.event_role_id) ===
                        Number(activity.id)
                    )
                    .length > 0 && (
                    <>
                    <div className="admin-activity-section-head admin-activity-people-head">
                    <div>
                      <small>
                        PARTICIPANTES
                      </small>

                      <strong>
                        Pessoas e entregas
                      </strong>
                    </div>

                    <span>
                      Confirmações e revisão
                    </span>
                  </div>

                  <div className="admin-participants">
                      <h4>
                        👥 Participantes
                      </h4>

                      {data.activityParticipants
                        .filter(
                          (participant) =>
                            Number(participant.event_role_id) ===
                            Number(activity.id)
                        )
                        .map((participant) => (
                          <div
                            className="admin-participant"
                            key={
                              participant.confirmation_id
                            }
                          >
                            <div>
                              <strong>
                                {participant.user_name}
                              </strong>

                              <span>
                                {participant.project_name}
                              </span>

                              {Number(
                                participant.requires_delivery
                              ) === 1 ? (
                                (
                                  participant.delivery_review_status ===
                                    'approved' ||
                                  participant.completed_at
                                ) ? (
                                  <div className="admin-delivery-reviewed">
                                    <span className="admin-participant-status admin-participant-approved">
                                      ✅ Entrega aprovada
                                    </span>

                                    {participant.delivery_link && (
                                      <a
                                        href={
                                          participant.delivery_link
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="admin-delivery-view-button"
                                      >
                                        📁 Ver entrega
                                      </a>
                                    )}
                                  </div>
                                ) : participant.delivery_review_status ===
                                  'changes_requested' ? (
                                  <div className="admin-delivery-review admin-delivery-needs-changes">
                                    <span className="admin-participant-status admin-participant-changes">
                                      ↩ Correção solicitada
                                    </span>

                                    {participant.delivery_review_note && (
                                      <div className="admin-delivery-review-note">
                                        <small>
                                          MOTIVO DA REVISÃO
                                        </small>

                                        <p>
                                          {
                                            participant.delivery_review_note
                                          }
                                        </p>
                                      </div>
                                    )}

                                    {participant.delivery_link && (
                                      <a
                                        href={
                                          participant.delivery_link
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="admin-delivery-view-button"
                                      >
                                        📁 Ver entrega
                                      </a>
                                    )}
                                  </div>
                                ) : participant.photo_submitted_at ? (
                                  <div className="admin-delivery-review">
                                    <span className="admin-participant-status admin-participant-ready">
                                      🔎 Em análise pela equipe de Mídias
                                    </span>

                                    {participant.delivery_link && (
                                      <a
                                        href={
                                          participant.delivery_link
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="admin-delivery-view-button"
                                      >
                                        📁 Ver entrega
                                      </a>
                                    )}

                                    <button
                                      type="button"
                                      className="admin-delivery-approve-button"
                                      onClick={async () => {
                                        try {
                                          const response =
                                            await fetch(
                                              '/api/admin?action=update',
                                              {
                                                method: 'POST',

                                                headers: {
                                                  'Content-Type':
                                                    'application/json',
                                                },

                                                body:
                                                  JSON.stringify({
                                                    action:
                                                      'toggle-activity-participant',

                                                    id:
                                                      participant.confirmation_id,
                                                  }),
                                              }
                                            )

                                          const result =
                                            await response.json()

                                          if (!response.ok) {
                                            throw new Error(
                                              result.error ||
                                              'Não foi possível aprovar a entrega.'
                                            )
                                          }

                                          window.alert(
                                            result.message ||
                                            'Entrega aprovada com sucesso! ✅'
                                          )

                                          await reloadAdmin()
                                        } catch (error) {
                                          window.alert(
                                            error?.message ||
                                            'Não foi possível aprovar a entrega.'
                                          )
                                        }
                                      }}
                                    >
                                      ✓ Aprovar entrega
                                    </button>

                                    <button
                                      type="button"
                                      className="admin-delivery-changes-button"
                                      onClick={async () => {
                                        const reviewNote =
                                          window.prompt(
                                            'O que precisa ser corrigido nesta entrega?'
                                          )

                                        if (reviewNote === null) {
                                          return
                                        }

                                        const normalizedNote =
                                          String(
                                            reviewNote
                                          ).trim()

                                        if (!normalizedNote) {
                                          window.alert(
                                            'Informe o motivo da correção.'
                                          )
                                          return
                                        }

                                        try {
                                          const response =
                                            await fetch(
                                              '/api/admin?action=update',
                                              {
                                                method: 'POST',

                                                headers: {
                                                  'Content-Type':
                                                    'application/json',
                                                },

                                                body:
                                                  JSON.stringify({
                                                    action:
                                                      'request-delivery-changes',

                                                    id:
                                                      participant.confirmation_id,

                                                    data: {
                                                      reviewNote:
                                                        normalizedNote,
                                                    },
                                                  }),
                                              }
                                            )

                                          const result =
                                            await response.json()

                                          if (!response.ok) {
                                            throw new Error(
                                              result.error ||
                                              'Não foi possível solicitar a correção.'
                                            )
                                          }

                                          window.alert(
                                            result.message ||
                                            'Correção solicitada! ↩️'
                                          )

                                          await reloadAdmin()
                                        } catch (error) {
                                          window.alert(
                                            error?.message ||
                                            'Não foi possível solicitar a correção.'
                                          )
                                        }
                                      }}
                                    >
                                      ↩ Solicitar correção
                                    </button>
                                  </div>
                                ) : (
                                  <span className="admin-participant-status admin-participant-pending">
                                    ⏳ Aguardando entrega
                                  </span>
                                )
                              ) : (
                                <span className="admin-participant-status admin-participant-ready">
                                  ✅ Pronto para finalizar
                                </span>
                              )}
                            </div>

                            
                          </div>
                        ))}
                    </div>
                    </>
                  )}
                  </div>
                </details>
              )
            })}
                  </div>
                </details>
              )
            })}
              </div>
            </div>
          </details>
        </section>
        )}
        
        {canSeeAnnouncements && (
        <section
          id="comunicados"
          className="admin-section admin-section-collapsible"
        >
          <details className="admin-collapsible">
            <summary className="admin-collapsible-summary">
              <div className="admin-collapsible-title">
                <span className="admin-collapsible-icon">
                  📢
                </span>

                <div>
                  <small className="admin-orange">
                    MURAL DO SONHAR
                  </small>

                  <strong>
                    Comunicados
                  </strong>
                </div>
              </div>

              <span className="admin-collapsible-count">
                {data.announcements.length}
              </span>
            </summary>

            <div className="admin-collapsible-body">
              <div className="admin-announcement-toolbar">
                <div>
                  <small>
                    MURAL DO SONHAR
                  </small>

                  <strong>
                    Comunicados publicados
                  </strong>
                </div>

                <button
                  type="button"
                  className="admin-announcement-new-button"
                  onClick={() =>
                    setAnnouncementComposerOpen(
                      (current) => !current
                    )
                  }
                  aria-expanded={
                    announcementComposerOpen
                  }
                >
                  <span aria-hidden="true">
                    +
                  </span>

                  Novo comunicado
                </button>
              </div>

              {announcementComposerOpen && (
                <div className="admin-announcement-create">
                  <div className="admin-announcement-create-heading">
                    <div>
                      <small>
                        NOVO COMUNICADO
                      </small>

                      <strong>
                        Compartilhar uma atualização
                      </strong>
                    </div>

                    <span>
                      📢
                    </span>
                  </div>

<form
            className="admin-announcement-form"
            onSubmit={
              handleCreateAnnouncement
            }
          >
            <div className="admin-announcement-form-grid">
              <label className="admin-announcement-field">
                <span>
                  Título
                </span>

                <input
                  name="title"
                  placeholder="Ex.: Reunião geral de sábado"
                  required
                />
              </label>

              <label className="admin-announcement-field">
                <span>
                  Projeto de destino
                </span>

                <select
                  name="projectId"
                  defaultValue=""
                >
                  <option value="">
                    🌎 Toda a ONG / transversal
                  </option>

                  {(data.projects || []).map((project) => (
                    <option
                      key={project.id}
                      value={project.id}
                    >
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-announcement-field is-wide">
                <span>
                  Mensagem
                </span>

                <textarea
                  name="message"
                  rows="5"
                  placeholder="Escreva o comunicado de forma clara e objetiva..."
                  required
                />
              </label>

              <label className="admin-announcement-field">
                <span>
                  Equipe de destino
                </span>

                <select
                  name="teamId"
                  defaultValue=""
                >
                  <option value="">
                    Todas as equipes
                  </option>

                  {(data.teams || []).map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-announcement-field">
                <span>
                  Prioridade
                </span>

                <select
                  name="priority"
                  defaultValue="normal"
                >
                  <option value="normal">
                    Normal
                  </option>

                  <option value="important">
                    Importante
                  </option>

                  <option value="urgent">
                    Urgente
                  </option>
                </select>
              </label>
            </div>

            <div className="admin-announcement-form-footer">
              <small>
                O comunicado será exibido conforme o destino selecionado.
              </small>

              <button
                className="admin-announcement-submit"
                disabled={isLoading}
                type="submit"
              >
                <span>
                  Publicar comunicado
                </span>

                <span aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          </form>
              </div>
              )}

              <div className="admin-announcement-list-heading">
                <span>
                  PUBLICADOS
                </span>

                <small>
                  {data.announcements.length}
                  {' '}
                  comunicados
                </small>
              </div>

              <div className="admin-announcement-feed">
                {data.announcements.map(
                  (announcement) => {
                    const priority =
                      String(
                        announcement.priority ||
                        'normal'
                      ).toLowerCase()

                    const priorityLabel =
                      priority === 'urgent'
                        ? 'URGENTE'
                        : priority === 'important'
                          ? 'IMPORTANTE'
                          : 'NORMAL'

                    const destinationProject =
                      announcement.project_name ||
                      announcement.projectName ||
                      null

                    const destinationTeam =
                      announcement.team_name ||
                      announcement.teamName ||
                      null

                    return (
                      <article
                        key={announcement.id}
                        className={`admin-announcement-card is-${priority}`}
                      >
                        <div className="admin-announcement-card-head">
                          <span
                            className={`admin-announcement-priority is-${priority}`}
                          >
                            {priorityLabel}
                          </span>

                          <span
                            className={`admin-announcement-status ${
                              announcement.active
                                ? 'is-active'
                                : 'is-archived'
                            }`}
                          >
                            {announcement.active
                              ? '🟢 Ativo'
                              : '⚪ Arquivado'}
                          </span>
                        </div>

                        <div className="admin-announcement-card-copy">
                          <h3>
                            {announcement.title}
                          </h3>

                          <p>
                            {announcement.message}
                          </p>
                        </div>

                        <div className="admin-announcement-audience">
                          <span>
                            {destinationProject
                              ? `📍 ${destinationProject}`
                              : '🌎 Toda a ONG'}
                          </span>

                          <span>
                            {destinationTeam
                              ? `👥 ${destinationTeam}`
                              : '👥 Todas as equipes'}
                          </span>
                        </div>

                        <div className="admin-announcement-card-footer">
                          <div className="admin-announcement-author">
                            <small>
                              PUBLICADO POR
                            </small>

                            <strong>
                              {announcement.created_by_name ||
                                'Admin'}
                            </strong>
                          </div>

                          <AdminManageActions
                            type="announcement"
                            item={announcement}
                            onUpdated={reloadAdmin}
                          />
                        </div>
                      </article>
                    )
                  }
                )}
              </div>
            </div>
          </details>
        </section>
        )}
      </main>

      {selectedMetric && (
        <div
          className="admin-user-profile-backdrop"
          role="presentation"
          onClick={() =>
            setSelectedMetric(null)
          }
        >
          <section
            className="admin-user-profile-modal admin-metric-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              selectedMetric.title
            }
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="admin-user-profile-close"
              onClick={() =>
                setSelectedMetric(null)
              }
              aria-label="Fechar detalhes"
            >
              ×
            </button>

            <header className="admin-metric-detail-header">
              <span>
                VISÃO GERAL
              </span>

              <h2>
                {selectedMetric.title}
              </h2>

              <p>
                {selectedMetric.items.length}{' '}
                {selectedMetric.items.length === 1
                  ? 'registro'
                  : 'registros'}
              </p>
            </header>

            <div className="admin-metric-detail-list">
              {selectedMetric.items.length === 0 ? (
                <div className="admin-metric-detail-empty">
                  Nenhum registro encontrado.
                </div>
              ) : (
                selectedMetric.items.map(
                  (item, index) => {
                    const title =
                      getMetricItemTitle(
                        item,
                        selectedMetric.type
                      )

                    const description =
                      getMetricItemDescription(
                        item,
                        selectedMetric.type
                      )

                    if (
                      selectedMetric.type ===
                      'people'
                    ) {
                      return (
                        <button
                          type="button"
                          key={
                            item.id ||
                            `${title}-${index}`
                          }
                          className="admin-metric-detail-item is-person"
                          onClick={() => {
                            setSelectedMetric(
                              null
                            )

                            setSelectedUser(
                              item
                            )

                            setUserProfileTab(
                              'overview'
                            )
                          }}
                        >
                          <span className="admin-metric-person-avatar">
                            {item.avatar_path ? (
                              <img
                                src={
                                  item.avatar_path
                                }
                                alt=""
                              />
                            ) : (
                              String(
                                item.full_name ||
                                item.name ||
                                item.username ||
                                '?'
                              )
                                .trim()
                                .charAt(0)
                                .toUpperCase()
                            )}
                          </span>

                          <span className="admin-metric-detail-copy">
                            <strong>
                              {title}
                            </strong>

                            {description && (
                              <small>
                                {
                                  description
                                }
                              </small>
                            )}
                          </span>

                          <span
                            className="admin-metric-item-arrow"
                            aria-hidden="true"
                          >
                            →
                          </span>
                        </button>
                      )
                    }

                    return (
                      <div
                        key={
                          item.id ||
                          `${title}-${index}`
                        }
                        className="admin-metric-detail-item"
                      >
                        <span className="admin-metric-detail-copy">
                          <strong>
                            {title}
                          </strong>

                          {description && (
                            <small>
                              {description}
                            </small>
                          )}
                        </span>
                      </div>
                    )
                  }
                )
              )}
            </div>
          </section>
        </div>
      )}

      {selectedUser && (
        <div
          className="admin-user-profile-backdrop"
          role="presentation"
          onClick={() =>
            setSelectedUser(null)
          }
        >
          <section
            className="admin-user-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${
              selectedUser.full_name ||
              selectedUser.name ||
              'voluntário'
            }`}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="admin-user-profile-close"
              onClick={() =>
                setSelectedUser(null)
              }
              aria-label="Fechar perfil"
            >
              ×
            </button>

            <header className="admin-user-profile-header">
              <div className="admin-user-profile-avatar">
                {selectedUser.avatar_path ? (
                  <img
                    src={selectedUser.avatar_path}
                    alt=""
                  />
                ) : (
                  <span>
                    {String(
                      selectedUser.full_name ||
                      selectedUser.name ||
                      '?'
                    )
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <span className="admin-user-profile-eyebrow">
                  Perfil do voluntário
                </span>

                <h2>
                  {selectedUser.full_name ||
                    selectedUser.name}
                </h2>

                <p>
                  {selectedUser.username
                    ? `@${selectedUser.username}`
                    : 'Sem usuário'}
                  {' · '}
                  {selectedUser.project ||
                    'Sem projeto'}
                </p>

                <div className="admin-user-profile-badges">
                  <span>
                    {selectedUser.permissions?.includes(
                      'admin'
                    )
                      ? selectedUser.admin_scope === 'global'
                        ? '🛡️ Admin Geral'
                        : selectedUser.admin_scope === 'project'
                          ? '🏠 Admin de Projeto'
                          : '⚙️ Admin de equipe'
                      : selectedUser.permissions?.includes(
                          'volunteer'
                        )
                        ? '🫶 Voluntário'
                        : selectedUser.permissions?.includes(
                            'dreamer'
                          )
                          ? '❤️ Sócio Sonhador'
                          : '— Sem acesso'}
                  </span>

                  <span>
                    {selectedUser.active
                      ? '● Ativo'
                      : '○ Inativo'}
                  </span>

                  <span>
                    {selectedUser.has_pin
                      ? '🔐 PIN configurado'
                      : '⌛ Primeiro acesso pendente'}
                  </span>
                </div>
              </div>
            </header>

            <nav
              className="admin-user-profile-tabs"
              aria-label="Seções do perfil"
            >
              {[
                {
                  key: 'overview',
                  label: 'Visão geral',
                },
                {
                  key: 'participation',
                  label: 'Participações',
                },
                {
                  key: 'access',
                  label: 'Acesso',
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={
                    userProfileTab === tab.key
                      ? 'is-active'
                      : ''
                  }
                  onClick={() => {
                    setUserProfileTab(
                      tab.key
                    )

                    if (
                      tab.key ===
                        'participation' &&
                      selectedUser?.id
                    ) {
                      loadUserParticipation(
                        selectedUser.id
                      )
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {userProfileTab === 'overview' && (
              <div className="admin-user-profile-tab-content">
            <div className="admin-user-profile-grid">
              <div>
                <span>E-mail</span>
                <strong>
                  {selectedUser.email ||
                    'Não informado'}
                </strong>
              </div>

              <div>
                <span>Telefone</span>
                <strong>
                  {selectedUser.phone ||
                    'Não informado'}
                </strong>
              </div>

              <div>
                <span>Nascimento</span>
                <strong>
                  {selectedUser.birth_date ||
                    'Não informado'}
                </strong>
              </div>

              <div>
                <span>Projeto</span>
                <strong>
                  {selectedUser.project ||
                    'Não definido'}
                </strong>
              </div>

              <div className="is-wide">
                <span>Equipes</span>

                <strong>
                  {Array.isArray(
                    selectedUser.team_names
                  ) &&
                  selectedUser.team_names.length
                    ? selectedUser.team_names.join(
                        ' · '
                      )
                    : 'Nenhuma equipe vinculada'}
                </strong>
              </div>

              <div className="is-wide">
                <span>
                  Alergias / restrições
                </span>

                <strong>
                  {selectedUser.allergies ||
                    'Nenhuma informação cadastrada'}
                </strong>
              </div>
            </div>

              </div>
            )}

            {userProfileTab === 'participation' && (
              <div className="admin-user-profile-tab-content">
                {userParticipationLoading ? (
                  <div className="admin-user-participation-state">
                    <span className="admin-user-participation-loader" />

                    <strong>
                      Carregando histórico...
                    </strong>
                  </div>
                ) : userParticipationError ? (
                  <div className="admin-user-participation-state is-error">
                    <strong>
                      Não foi possível carregar
                    </strong>

                    <p>
                      {userParticipationError}
                    </p>
                  </div>
                ) : userParticipation.length ? (
                  <div className="admin-user-participation-list">
                    <div className="admin-user-participation-stats">
                      <div>
                        <strong>
                          {userParticipation.length}
                        </strong>

                        <span>
                          Eventos
                        </span>
                      </div>

                      <div>
                        <strong>
                          {(() => {
                            const latest =
                              userParticipation[0]

                            if (!latest?.event_date) {
                              return '—'
                            }

                            const rawDate =
                              String(
                                latest.event_date
                              )

                            const dateOnly =
                              rawDate.match(
                                /^\d{4}-\d{2}-\d{2}/
                              )?.[0]

                            const parsed =
                              dateOnly
                                ? new Date(
                                    `${dateOnly}T12:00:00`
                                  )
                                : new Date(rawDate)

                            if (
                              Number.isNaN(
                                parsed.getTime()
                              )
                            ) {
                              return '—'
                            }

                            return parsed.toLocaleDateString(
                              'pt-BR',
                              {
                                day: '2-digit',
                                month: 'short',
                              }
                            )
                          })()}
                        </strong>

                        <span>
                          Última participação
                        </span>
                      </div>

                      <div>
                        <strong>
                          {userParticipation[0]?.role_name ||
                            '—'}
                        </strong>

                        <span>
                          Última função
                        </span>
                      </div>
                    </div>

                    <div className="admin-user-participation-summary">
                      <strong>
                        {userParticipation.length}
                      </strong>

                      <span>
                        participações encontradas
                      </span>
                    </div>

                    {userParticipation.map(
                      (participation) => (
                        <article
                          key={participation.id}
                          className="admin-user-participation-card"
                        >
                          <div className="admin-user-participation-date">
                            <strong>
                              {(() => {
                                if (!participation.event_date) {
                                  return '—'
                                }

                                const rawDate =
                                  String(
                                    participation.event_date
                                  )

                                const dateOnly =
                                  rawDate.match(
                                    /^\d{4}-\d{2}-\d{2}/
                                  )?.[0]

                                const parsedDate =
                                  dateOnly
                                    ? new Date(
                                        `${dateOnly}T12:00:00`
                                      )
                                    : new Date(rawDate)

                                if (
                                  Number.isNaN(
                                    parsedDate.getTime()
                                  )
                                ) {
                                  return '—'
                                }

                                return parsedDate
                                  .toLocaleDateString(
                                    'pt-BR',
                                    {
                                      day: '2-digit',
                                      month: 'short',
                                    }
                                  )
                              })()}
                            </strong>
                          </div>

                          <div className="admin-user-participation-main">
                            <span>
                              Evento
                            </span>

                            <h4>
                              {participation.event_name}
                            </h4>

                            <p>
                              {participation.location ||
                                'Local não informado'}
                            </p>
                          </div>

                          <div className="admin-user-participation-meta">
                            <span>
                              {participation.team ||
                                'Sem equipe'}
                            </span>

                            <strong
                              className={`is-${String(
                                participation.status ||
                                'unknown'
                              ).toLowerCase()}`}
                            >
                              {participation.status ===
                              'confirmed'
                                ? 'Confirmado'
                                : participation.status ===
                                    'pending'
                                  ? 'Pendente'
                                  : participation.status ===
                                      'rejected'
                                    ? 'Recusado'
                                    : participation.status ||
                                      'Sem status'}
                            </strong>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                ) : (
                  <div className="admin-user-profile-empty-state">
                    <span aria-hidden="true">
                      ✦
                    </span>

                    <strong>
                      Nenhuma participação ainda
                    </strong>

                    <p>
                      Quando este voluntário se inscrever em eventos,
                      o histórico aparecerá aqui.
                    </p>
                  </div>
                )}
              </div>
            )}

            {userProfileTab === 'access' && (
              <div className="admin-user-profile-tab-content">
                <div className="admin-user-access-grid">
                  <div>
                    <span>
                      Usuário
                    </span>

                    <strong>
                      {selectedUser.username
                        ? `@${selectedUser.username}`
                        : 'Sem usuário'}
                    </strong>
                  </div>

                  <div>
                    <span>
                      PIN
                    </span>

                    <strong>
                      {selectedUser.has_pin
                        ? 'Configurado'
                        : 'Primeiro acesso pendente'}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Status
                    </span>

                    <strong>
                      {selectedUser.active
                        ? 'Ativo'
                        : 'Inativo'}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Permissão
                    </span>

                    <strong>
                      {selectedUser.permissions?.includes(
                        'admin'
                      )
                        ? 'Administrador'
                        : selectedUser.permissions?.includes(
                            'volunteer'
                          )
                          ? 'Voluntário'
                          : selectedUser.permissions?.includes(
                              'dreamer'
                            )
                            ? 'Sócio Sonhador'
                            : 'Sem acesso definido'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <footer className="admin-user-profile-footer">
              <small>
                Em breve: histórico de eventos,
                atividades e participações.
              </small>

              <button
                type="button"
                onClick={() =>
                  setSelectedUser(null)
                }
              >
                Fechar
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}

export default AdminPage
