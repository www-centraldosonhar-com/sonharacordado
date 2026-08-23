import { useEffect, useState } from 'react'
import {
  formatDateBr,
  formatTimeBr,
} from '../utils/formatters'
import AdminManageActions from '../components/AdminManageActions'
import AdminImageUpload from '../components/AdminImageUpload'
import AdminChecklistPanel from '../components/AdminChecklistPanel'
import AdminRegistrationsPanel from '../components/AdminRegistrationsPanel'
import AdminVolunteerOverview from '../components/AdminVolunteerOverview'
import AdminActivitiesOverview from '../components/AdminActivitiesOverview'
import AdminExpensesPanel from '../components/AdminExpensesPanel'
import AdminPostEventPanel from '../components/AdminPostEventPanel'
import AdminPostEventTeamReports from '../components/AdminPostEventTeamReports'
import '../styles/admin.css'
import '../styles/admin-premium.css'
import AdminFinanceRequestsPanel from '../components/AdminFinanceRequestsPanel'
import AdminPeopleImport from '../components/AdminPeopleImport.jsx'

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

  const canEditMonthlyCommunity =
    isGlobalAdmin || isMediaAdmin

  const isManagementAdmin =
    isGlobalAdmin ||
    isProjectAdmin

  const canSeeUsers =
    isManagementAdmin ||
    isVolunteerAdmin

  const canSeeEvents =
    isManagementAdmin

  const canSeeActivities =
    isManagementAdmin ||
    isMediaAdmin ||
    isVolunteerAdmin

  const canSeeAnnouncements =
    isManagementAdmin ||
    isTeamAdmin

  const canSeeExpenses =
    isGlobalAdmin ||
    isProjectAdmin ||
    isTeamAdmin

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
        {canSeeUsers && (
          <a href="#usuarios">
            👥 Voluntários
          </a>
        )}

        {canSeeEvents && (
          <a href="#eventos">
            📅 Eventos
          </a>
        )}

        {data.adminAccess
          ?.canManageRegistrations && (
          <a href="#inscricoes">
            🎟️ Inscrições
          </a>
        )}

        {data.adminAccess
          ?.canViewActivitiesOverview && (
          <a href="#controle-atividades">
            🎨 Atividades
          </a>
        )}

        {canSeeActivities && (
          <a href="#atividades">
            🙋 Vagas
          </a>
        )}

        {isManagementAdmin && (
          <a href="#pos-evento">
            🌙 Pós-Evento
          </a>
        )}

        {(isManagementAdmin ||
          isTeamAdmin) && (
          <a href="#relatorios-equipes">
            🤝 Relatórios
          </a>
        )}

        {canSeeExpenses && (
          <a href="#gastos">
            🧾 Gastos
          </a>
        )}

        

                

{canSeeAnnouncements && (
          <a href="#comunicados">
            📢 Comunicados
          </a>
        )}
      </nav>

      <main className="admin-shell">

        <section
          className="admin-operational-overview"
          aria-label="Resumo da Central"
        >
          <div className="admin-operational-overview-heading">
            <div>
              <small>
                VISÃO GERAL
              </small>

              <strong>
                Central em números
              </strong>
            </div>

            <span>
              Atualizado agora
            </span>
          </div>

          <div className="admin-operational-overview-grid">
            <article className="is-primary">
              <span>
                Voluntários
              </span>

              <strong>
                {(data.users || []).filter(
                  (person) =>
                    person.user_type === 'volunteer' &&
                    Number(person.active) !== 0
                ).length}
              </strong>

              <small>
                ativos na Central
              </small>
            </article>

            <article>
              <span>
                Admins
              </span>

              <strong>
                {(data.users || []).filter(
                  (person) =>
                    person.permissions?.includes(
                      'admin'
                    ) &&
                    Number(person.active) !== 0
                ).length}
              </strong>

              <small>
                com acesso administrativo
              </small>
            </article>

            <article>
              <span>
                Eventos
              </span>

              <strong>
                {(data.events || []).length}
              </strong>

              <small>
                cadastrados
              </small>
            </article>

            <article>
              <span>
                Atividades
              </span>

              <strong>
                {(data.eventRoles || []).length}
              </strong>

              <small>
                configuradas
              </small>
            </article>

            <article className="is-attention">
              <span>
                Primeiro acesso
              </span>

              <strong>
                {(data.users || []).filter(
                  (person) =>
                    person.user_type === 'volunteer' &&
                    !person.has_pin &&
                    Number(person.active) !== 0
                ).length}
              </strong>

              <small>
                ainda sem PIN
              </small>
            </article>

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
                            word:
                              form.get('word'),
                            message:
                              form.get('message'),
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
                  onUpdated={reloadAdmin}
                />
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

        {(isManagementAdmin ||
          isTeamAdmin) && (
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
                      LEITURA OPERACIONAL
                    </small>

                    <strong>
                      Relatórios de equipe
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

        {data.adminAccess
          ?.canViewActivitiesOverview && (
          <section
            id="visao-atividades"
            className="admin-section admin-section-collapsible"
          >
            <details className="admin-collapsible">
              <summary className="admin-collapsible-summary">
                <div className="admin-collapsible-title">
                  <span className="admin-collapsible-icon">
                    📈
                  </span>

                  <div>
                    <small>
                      INDICADORES DE OPERAÇÃO
                    </small>

                    <strong>
                      Visão de atividades
                    </strong>
                  </div>
                </div>

                <span className="admin-collapsible-count">
                  {(data.activitiesEventStats || []).length}
                </span>
              </summary>

              <div className="admin-collapsible-body">
                <AdminActivitiesOverview
                  events={
                    data.activitiesEventStats || []
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

              return (
                <article
                  className="admin-card"
                  key={activity.id}
                >
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

                  <p>
                    {activity.active
                      ? '🟢 Aberta'
                      : '⚪ Fechada'}
                  </p>

                  <AdminManageActions
                    type="activity"
                    item={activity}
                    teams={data.teams || []}
                    onUpdated={reloadAdmin}
                  />

                  {Number(
                    activity.allows_checklist
                  ) === 1 && (
                    <AdminChecklistPanel
                      activity={activity}
                      participants={
                        data.activityParticipants ||
                        []
                      }
                    />
                  )}

                  {data.activityParticipants
                    ?.filter(
                      (participant) =>
                        Number(participant.event_role_id) ===
                        Number(activity.id)
                    )
                    .length > 0 && (
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
                                participant.photo_submitted_at ? (
                                  <span className="admin-participant-status admin-participant-ready">
                                    🔎 Entrega realizada — aguardando validação
                                  </span>
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
                  )}
                </article>
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
                  (announcement) => (
                    <article
                      className={`admin-announcement-card is-${
                        announcement.priority ||
                        'normal'
                      }`}
                    >
                      <h3>
                        {announcement.title}
                      </h3>

                      <p>
                        {announcement.message}
                      </p>

                      <p>
                        Prioridade:
                        {' '}
                        {announcement.priority}
                      </p>

                      <p>
                        Por:
                        {' '}
                        {announcement.created_by_name}
                      </p>

                      <p>
                        {announcement.active
                          ? '🟢 Ativo'
                          : '⚪ Arquivado'}
                      </p>

                      <AdminManageActions
                        type="announcement"
                        item={announcement}
                        onUpdated={reloadAdmin}
                      />
                    </article>
                  )
                )}
              </div>
            </div>
          </details>
        </section>
        )}
      </main>

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
