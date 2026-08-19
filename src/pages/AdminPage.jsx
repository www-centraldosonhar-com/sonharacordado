import { useEffect, useState } from 'react'
import {
  formatDateBr,
  formatDateTimeBr,
  formatTimeBr,
} from '../utils/formatters'
import AdminCreatePanel from '../components/AdminCreatePanel'
import AdminManageActions from '../components/AdminManageActions'
import AdminImageUpload from '../components/AdminImageUpload'
import AdminParticipantAction from '../components/AdminParticipantAction'
import AdminChecklistPanel from '../components/AdminChecklistPanel'
import AdminRegistrationsPanel from '../components/AdminRegistrationsPanel'
import '../styles/admin.css'

function AdminPage({
  user,
  onBack,
  onLogout,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

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
              Oi, {user.name}! 👋
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
        <a href="#usuarios">
          👥 Voluntários
        </a>

        <a href="#eventos">
          📅 Eventos
        </a>

        {data.adminAccess
          ?.canManageRegistrations && (
          <a href="#inscricoes">
            🎟️ Inscrições
          </a>
        )}

        <a href="#atividades">
          🙋 Atividades
        </a>

        <a href="#missoes">
          🚀 Missões
        </a>

        <a href="#comunicados">
          📢 Comunicados
        </a>

        <a href="#confirmados">
          🫶 Confirmados
        </a>
      </nav>

      <main className="admin-shell">
        <AdminCreatePanel
          projects={data.projects}
          events={data.events}
          roles={data.roles}
          teams={data.teams || []}
          onCreated={reloadAdmin}
        />
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

          <article>
            <strong>
              {data.tasks.length}
            </strong>

            <span>
              missões
            </span>
          </article>
        </section>

        <section
          id="usuarios"
          className="admin-section"
        >
          <p className="admin-eyebrow">
            QUEM FAZ ACONTECER
          </p>

          <h2>
            👥 Voluntários e usuários
          </h2>

          <div className="admin-grid">
            {data.users.map((person) => (
              <article
                className="admin-card"
                key={person.id}
              >
                <div className="admin-user-top">
                  {person.avatar_path ? (
                    <img
                      src={person.avatar_path}
                      alt={`Avatar de ${person.name}`}
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
                      {person.name}
                    </h3>

                    <span className="admin-tag">
                      {person.project}
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
                      : '❤️ Sócio Sonhador'}
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
        </section>

        <section
          id="eventos"
          className="admin-section"
        >
          <p className="admin-eyebrow admin-orange">
            PRÓXIMOS ENCONTROS
          </p>

          <h2>
            📅 Eventos
          </h2>

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
        </section>

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

        <section
          id="atividades"
          className="admin-section"
        >
          <p className="admin-eyebrow">
            VAGAS E FUNÇÕES
          </p>

          <h2>
            🙋 Atividades
          </h2>

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

                            <AdminParticipantAction
                              type="activity"
                              participant={participant}
                              onUpdated={reloadAdmin}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section
          id="missoes"
          className="admin-section"
        >
          <p className="admin-eyebrow">
            TIRANDO DO PAPEL
          </p>

          <h2>
            🚀 Missões
          </h2>

          <div className="admin-grid">
            {data.tasks.map((task) => (
              <article
                className="admin-card"
                key={task.id}
              >
                <h3>
                  {task.title}
                </h3>

                {task.description && (
                  <p>
                    {task.description}
                  </p>
                )}

                <p>
                  ⏰ {formatDateTimeBr(
                    task.deadline
                  )}
                </p>

                <p>
                  Prioridade:
                  {' '}
                  {task.priority}
                </p>

                <p>
                  👥 {task.volunteer_count}
                  {' de '}
                  {task.volunteer_limit}
                </p>

                <p>
                  Status: {task.status}
                </p>

                <AdminManageActions
                  type="task"
                  item={task}
                  events={data.events}
                  onUpdated={reloadAdmin}
                />

                {data.taskParticipants
                  ?.filter(
                    (participant) =>
                      Number(participant.task_id) ===
                      Number(task.id)
                  )
                  .length > 0 && (
                  <div className="admin-participants">
                    <h4>
                      👥 Participantes
                    </h4>

                    {data.taskParticipants
                      .filter(
                        (participant) =>
                          Number(participant.task_id) ===
                          Number(task.id)
                      )
                      .map((participant) => (
                        <div
                          className="admin-participant"
                          key={
                            participant.participation_id
                          }
                        >
                          <div>
                            <strong>
                              {participant.user_name}
                            </strong>

                            <span>
                              {participant.project_name}
                            </span>

                            {participant.delivery_link && (
                              <a
                                href={
                                  participant.delivery_link
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                🔗 Ver entrega
                              </a>
                            )}
                          </div>

                          <AdminParticipantAction
                            type="task"
                            participant={participant}
                            onUpdated={reloadAdmin}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section
          id="comunicados"
          className="admin-section"
        >
          <p className="admin-eyebrow admin-orange">
            MURAL DO SONHAR
          </p>

          <h2>
            📢 Comunicados
          </h2>

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
        </section>

        <section
          id="confirmados"
          className="admin-section"
        >
          <p className="admin-eyebrow">
            QUEM DISSE EU VOU
          </p>

          <h2>
            🫶 Confirmados
          </h2>

          <div className="admin-confirmations">
            {data.confirmations.map(
              (confirmation) => (
                <article
                  className="admin-confirmation"
                  key={confirmation.id}
                >
                  <strong>
                    {confirmation.name}
                  </strong>

                  <span>
                    {confirmation.project}
                  </span>

                  <span>
                    {confirmation.role}
                  </span>

                  <small>
                    {confirmation.event_name}
                  </small>
                </article>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default AdminPage
