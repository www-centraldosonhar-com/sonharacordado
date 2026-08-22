import { useEffect, useState } from 'react'
import {
  formatDateBr,
  formatTimeBr,
} from '../utils/formatters'
import AdminCreatePanel from '../components/AdminCreatePanel'
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

        {canEditMonthlyCommunity && (
          <section className="admin-section admin-monthly-section">
            <details
              className="admin-collapsible"
              open
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

        {(isManagementAdmin ||
          isVolunteerAdmin ||
          isMediaAdmin) && (
          <AdminCreatePanel
            projects={data.projects}
            events={data.events}
            roles={data.roles}
            teams={data.teams || []}
            access={data.adminAccess}
            onCreated={reloadAdmin}
          />
        )}
        {isManagementAdmin && (
        <section
          id="resumo"
          className="admin-dashboard"
        >
          <article>
            <strong>
              {data.users.length}
            </strong>

            <span>
              usuários
            </span>
          </article>

          <article>
            <strong>
              {data.events.length}
            </strong>

            <span>
              eventos
            </span>
          </article>

          <article>
            <strong>
              {data.eventRoles.length}
            </strong>

            <span>
              atividades
            </span>
          </article>

        </section>
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
          <AdminPostEventPanel
            events={
              data.events || []
            }
            onUpdated={
              reloadAdmin
            }
          />
        )}

        {(isManagementAdmin ||
          isTeamAdmin) && (
          <AdminPostEventTeamReports
            events={
              data.events || []
            }
            access={
              data.adminAccess
            }
          />
        )}

        {data.adminAccess
          ?.canManageRegistrations && (
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
        )}

        {data.adminAccess
          ?.canManageRegistrations && (
          <AdminVolunteerOverview
            events={
              data.volunteerEventStats || []
            }
          />
        )}

        {data.adminAccess
          ?.canViewActivitiesOverview && (
          <AdminActivitiesOverview
            events={
              data.activitiesEventStats || []
            }
          />
        )}

        {canSeeExpenses && (
          <div id="gastos">
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
            {data.eventRoles.map((activity) => {
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
              <div className="admin-grid">
                {data.announcements.map(
                  (announcement) => (
                    <article
                      className="admin-card"
                      key={announcement.id}
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
