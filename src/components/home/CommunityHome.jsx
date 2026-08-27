import EventRegistrationPanel from '../EventRegistrationPanel'
import UserAvatar from '../UserAvatar'
import { useState } from 'react'

function CommunityHome({
  currentMonthLabel,
  upcomingEvents,
  getLocalDate,
  universalMediaActivities,
  myConfirmations = [],
  approvedPhotoMemories = [],
  monthlyBirthdays,
  monthlyCommunity,
  isBirthdayToday,
  currentUser,
  loadHome,
}) {
  const [selectedEvent, setSelectedEvent] = useState(null)


  const approvedMemoryGroups =
    Array.from(
      (
        Array.isArray(
          approvedPhotoMemories
        )
          ? approvedPhotoMemories
          : []
      ).reduce(
        (groups, memory) => {
          const eventId =
            Number(
              memory?.event_id ||
              0
            )

          if (!eventId) {
            return groups
          }

          if (!groups.has(eventId)) {
            groups.set(
              eventId,
              {
                eventId,
                eventName:
                  memory?.event_name ||
                  'Evento',
                project:
                  memory?.project ||
                  'Sonhar Acordado',
                eventDate:
                  memory?.event_date ||
                  null,
                driveLink:
                  memory?.drive_link ||
                  '',
                photographers: [],
              }
            )
          }

          const group =
            groups.get(eventId)

          const photographerId =
            Number(
              memory?.photographer_id ||
              0
            )

          const alreadyAdded =
            group.photographers.some(
              (photographer) =>
                Number(
                  photographer.id
                ) === photographerId
            )

          if (!alreadyAdded) {
            group.photographers.push({
              id:
                photographerId ||
                memory?.photographer_username ||
                memory?.photographer_name,

              name:
                memory?.photographer_name ||
                '',

              username:
                memory?.photographer_username ||
                '',
            })
          }

          return groups
        },
        new Map()
      ).values()
    )

  const safeMediaActivities =
    Array.isArray(
      universalMediaActivities
    )
      ? universalMediaActivities
      : []

  const mediaActivityGroups =
    Array.from(
      safeMediaActivities.reduce(
        (groups, activity) => {
          const eventId =
            Number(
              activity.event_id ||
              activity.eventId ||
              0
            )

          if (!groups.has(eventId)) {
            groups.set(eventId, {
              eventId,
              eventName:
                activity.event_name ||
                'Evento',
              eventDate:
                activity.event_date ||
                null,
              activities: [],
            })
          }

          groups
            .get(eventId)
            .activities
            .push(activity)

          return groups
        },
        new Map()
      ).values()
    )



  const getMediaConfirmation = (activityId) =>
    myConfirmations.find(
      (item) =>
        Number(
          item.event_role_id ||
          item.eventRoleId ||
          item.activity_id ||
          0
        ) === Number(activityId) &&
        item.status === 'confirmed'
    ) || null

  async function handleJoinMediaActivity(activity) {
    try {
      const response = await fetch(
        '/api/volunteer?action=confirm-activity',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            eventRoleId: activity.id,
            source: 'community',
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível participar da atividade.'
        )
      }

      await loadHome()
    } catch (error) {
      window.alert(
        error?.message ||
        'Não foi possível participar da atividade.'
      )
    }
  }

  async function handleLeaveMediaActivity(activity) {
    const confirmation =
      getMediaConfirmation(activity.id)

    const confirmationId =
      confirmation?.id ||
      confirmation?.confirmation_id ||
      activity.user_confirmation_id ||
      activity.userConfirmationId

    if (!confirmationId) {
      return
    }

    const reason = window.prompt(
      'Conte rapidamente por que você está saindo da atividade:'
    )

    if (reason === null) {
      return
    }

    try {
      const response = await fetch(
        '/api/volunteer?action=cancel-confirmation',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            confirmationId:
              confirmationId,

            reason:
              String(reason || '').trim(),
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível sair da atividade.'
        )
      }

      await loadHome()
    } catch (error) {
      window.alert(
        error?.message ||
        'Não foi possível sair da atividade.'
      )
    }
  }

  return (
    <div className="community-home">
      <section className="universal-community">
        <header className="universal-community-hero">
          <div className="universal-community-copy">
            <div className="universal-community-kicker">
              <span />
              Comunidade Sonhar Acordado
            </div>

            <h2>
              <span className="community-title-line">
                Central do
              </span>

              <em className="community-title-highlight">
                Voluntário Sonhador.
              </em>
            </h2>

            <p>
              Uma comunidade feita por todos os projetos.
              APS, PPF e SJ se encontram por aqui.
            </p>

            <nav
              className="universal-community-nav"
              aria-label="Áreas da comunidade"
            >
              <a href="#community-events">
                Eventos
              </a>

              <a href="#community-photos">
                Fotos
              </a>

              <a href="#community-birthdays">
                Aniversariantes
              </a>
            </nav>
          </div>

          <div
            className="universal-community-art"
            aria-hidden="true"
          >
            <span className="community-heart community-heart-red">
              ♥
            </span>

            <span className="community-heart community-heart-orange">
              ♥
            </span>

            <span className="community-heart community-heart-blue">
              ♥
            </span>

            <div className="community-orbit community-orbit-a" />
            <div className="community-orbit community-orbit-b" />

            <div className="community-core">
                  <span className="community-core-heart">
                    ♥
                  </span>
                </div>
          </div>
        </header>

        <div className="community-bento">
          <article
            id="community-events"
            className="community-panel community-calendar"
          >
            <div className="community-panel-head">
              <div>
                <span className="community-eyebrow">
                  Cronograma
                </span>

                <h3>{currentMonthLabel}</h3>
              </div>

              <span className="community-count">
                {upcomingEvents.length}
                {' '}
                {upcomingEvents.length === 1
                  ? 'evento'
                  : 'eventos'}
              </span>
            </div>

            <div className="community-timeline">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event, index) => {
                  const date =
                    getLocalDate(
                      event?.date ||
                      event?.event_date ||
                      event?.starts_at
                    )

                  return (
                    <button
                      type="button"
                      className="community-event-row"
                      data-project={
                        String(
                          event?.project ||
                          event?.project_code ||
                          ''
                        )
                          .trim()
                          .toUpperCase()
                      }
                      onClick={() =>
                        setSelectedEvent(event)
                      }
                      key={
                        event?.id ||
                        `${event?.name}-${index}`
                      }
                    >


                      <div className="community-event-date">
                        <strong>
                          {date
                            ? String(
                                date.getDate()
                              ).padStart(2, '0')
                            : '--'}
                        </strong>

                        <span>
                          {date
                            ? date
                                .toLocaleDateString(
                                  'pt-BR',
                                  { weekday: 'short' }
                                )
                                .replace('.', '')
                            : ''}
                        </span>
                      </div>

                      <div className="community-event-info">
                        <span className="community-event-project">
                          {event?.project ||
                            event?.project_code ||
                            'Sonhar'}
                        </span>

                        <strong>
                          {event?.name ||
                            event?.title ||
                            'Evento Sonhar'}
                        </strong>

                        <span>
                          {event?.project ||
                            event?.location ||
                            'Todos os projetos'}
                        </span>
                      </div>

                    </button>
                  )
                })
              ) : (
                <div className="community-empty">
                  Nenhum evento cadastrado neste mês ainda.
                </div>
              )}
            </div>
          </article>

          <article className="community-panel community-word">
            <span className="community-eyebrow">
              Palavra do mês
            </span>

            <div className="community-word-art">
              <span>
                {monthlyCommunity?.word ||
                  'Bondade'}
              </span>
            </div>

            <p>
              {monthlyCommunity?.message ||
                'Pequenos gestos também transformam grandes histórias.'}
            </p>

            <div className="community-word-signature">
              {currentMonthLabel}
              {' · '}
              Sonhar Acordado
            </div>
          </article>

          <article className="community-panel community-media">
            <div className="community-panel-head">
              <div>
                <span className="community-eyebrow">
                  Equipe de Mídias
                </span>

                <h3>
                  Ajude de qualquer projeto.
                </h3>
              </div>

              <span className="community-open-badge">
                Aberto
              </span>
            </div>

            <p className="community-media-intro">
              Atividades abertas para todos os projetos.
              Para ajudar, basta estar inscrito no evento.
            </p>

            <div className="community-media-list">
              {mediaActivityGroups.length > 0 ? (
                <div className="community-media-events">
                  {mediaActivityGroups.map(
                    (group) => (
                      <details
                        key={group.eventId}
                        className="community-media-event"
                      >
                        <summary className="community-media-event-summary">
                          <div className="community-media-event-title">
                            <span>
                              EVENTO
                            </span>

                            <strong>
                              {group.eventName}
                            </strong>

                            {group.eventDate && (
                              <small>
                                {getLocalDate(
                                  group.eventDate
                                ).toLocaleDateString(
                                  'pt-BR',
                                  {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  }
                                )}
                              </small>
                            )}
                          </div>

                          <div className="community-media-event-count">
                            <strong>
                              {group.activities.length}
                            </strong>

                            <span>
                              {group.activities.length === 1
                                ? 'atividade'
                                : 'atividades'}
                            </span>
                          </div>

                          <span className="community-media-chevron">
                            ⌄
                          </span>
                        </summary>

                        <div className="community-media-event-body">
                          {group.activities.map(
                            (activity) => {
                              const confirmation =
                                getMediaConfirmation(
                                  activity.id
                                )

                              const joined =
                                Boolean(
                                  confirmation ||
                                  activity.user_joined ||
                                  activity.userJoined
                                )

                              const deliveryApproved =
                                Boolean(
                                  confirmation?.completed_at ||
                                  confirmation?.completedAt ||
                                  activity.delivery_review_status ===
                                    'approved' ||
                                  activity.deliveryReviewStatus ===
                                    'approved'
                                )

                              const roleName =
                                activity.role_name ||
                                activity.title ||
                                activity.name ||
                                activity.role ||
                                'Atividade de Mídias'

                              const isFilmmaker =
                                String(roleName)
                                  .toLowerCase()
                                  .includes('film')

                              const vacancyLimit =
                                Number(
                                  activity.vacancy_limit ||
                                  0
                                )

                              const confirmedCount =
                                Number(
                                  activity.real_confirmed_count ??
                                  activity.confirmed_count ??
                                  0
                                )

                              const isFull =
                                vacancyLimit > 0 &&
                                confirmedCount >=
                                  vacancyLimit

                              return (
                                <article
                                  key={activity.id}
                                  className={`community-media-task ${
                                    joined
                                      ? 'is-participating'
                                      : ''
                                  }`}
                                >
                                  <div className="community-media-task-main">
                                    <div className="community-media-task-icon">
                                      {isFilmmaker
                                        ? '🎥'
                                        : '📸'}
                                    </div>

                                    <div>
                                      <strong>
                                        {roleName}
                                      </strong>

                                      <span>
                                        Equipe de Mídias
                                      </span>
                                    </div>
                                  </div>

                                  <div className="community-media-task-meta">
                                    {vacancyLimit > 0 && (
                                      <span>
                                        {confirmedCount}
                                        /
                                        {vacancyLimit}
                                        {' '}
                                        participantes
                                      </span>
                                    )}

                                    {(
                                      activity.requires_delivery ===
                                        true ||
                                      Number(
                                        activity.requires_delivery
                                      ) === 1
                                    ) && (
                                      <span className="is-delivery">
                                        Entrega
                                      </span>
                                    )}
                                  </div>

                                  <div className="community-media-task-action">
                                    {joined ? (
                                      <>
                                        <div className="community-media-joined">
                                          <span>
                                            ✓
                                          </span>

                                          {deliveryApproved
                                            ? 'Entrega aprovada!'
                                            : 'Já estou participando!'}
                                        </div>

                                        {!deliveryApproved && (
                                          <button
                                            type="button"
                                            className="community-media-leave"
                                            onClick={() =>
                                              handleLeaveMediaActivity(
                                                activity
                                              )
                                            }
                                          >
                                            Sair da atividade
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="community-media-join"
                                        disabled={isFull}
                                        onClick={() =>
                                          handleJoinMediaActivity(
                                            activity
                                          )
                                        }
                                      >
                                        {isFull
                                          ? 'Vagas preenchidas'
                                          : 'Participar'}
                                      </button>
                                    )}
                                  </div>
                                </article>
                              )
                            }
                          )}
                        </div>
                      </details>
                    )
                  )}
                </div>
              ) : (
                <div className="community-empty">
                  Novas atividades abertas
                  de Mídias aparecerão aqui.
                </div>
              )}
            </div>
          </article>

          <article
            id="community-photos"
            className="community-panel community-photos"
          >
            <div className="community-panel-head">
              <div>
                <span className="community-eyebrow">
                  Memórias
                </span>

                <h3>
                  Fotos que contam o Sonhar.
                </h3>
              </div>

              <span className="community-month-mini">
                {approvedMemoryGroups.length}
              </span>
            </div>

            <p>
              Registros dos encontros de todos
              os projetos reunidos em um só lugar.
            </p>

            {approvedMemoryGroups.length > 0 ? (
              <div className="community-memory-list">
                {approvedMemoryGroups.map((event) => (
                  <article
                    key={event.eventId}
                    className="community-memory-card"
                  >
                    <div className="community-memory-main">
                      <div className="community-memory-icon">
                        📸
                      </div>

                      <div>
                        <small>
                          {event.project}
                        </small>

                        <strong>
                          {event.eventName}
                        </strong>

                        {event.eventDate && (
                          <span>
                            {getLocalDate(
                              event.eventDate
                            ).toLocaleDateString(
                              'pt-BR',
                              {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }
                            )}
                          </span>
                        )}


                        <div className="community-memory-photographers">
                          {event.photographers.map(
                            (photographer) => (
                              <span
                                key={photographer.id}
                              >
                                📷
                                {' '}
                                @
                                {photographer.username ||
                                  photographer.name ||
                                  'fotografo'}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <a
                      className="community-memory-link"
                      href={event.driveLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir fotos
                      <span>↗</span>
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="community-empty">
                As memórias aparecerão aqui
                quando um evento passado tiver
                uma pasta do Google Drive vinculada.
              </div>
            )}
          </article>

          <article
            id="community-birthdays"
            className="community-panel community-birthdays"
          >
            <div className="community-panel-head">
              <div>
                <span className="community-eyebrow">
                  Aniversariantes
                </span>

                <h3>
                  Quem faz o Sonhar acontecer.
                </h3>
              </div>

              <span className="community-month-mini">
                {currentMonthLabel.split(' ')[0]}
              </span>
            </div>

            <div className="community-birthday-grid">
              {monthlyBirthdays.length > 0 ? (
                monthlyBirthdays.map((person, index) => {
                  const today =
                    isBirthdayToday(person)

                  return (
                    <div
                      className={
                        today
                          ? 'community-birthday-person is-today'
                          : 'community-birthday-person'
                      }
                      key={
                        person?.id ||
                        `${person?.name}-${index}`
                      }
                    >
                      <UserAvatar
                        user={person}
                        name={
                          person?.name ||
                          person?.full_name ||
                          person?.fullName
                        }
                        className="community-birthday-avatar"
                      />

                      <div>
                        <strong>
                          {person?.name ||
                            'Voluntário Sonhador'}
                        </strong>

                        <span>
                          {today
                            ? '🎂 É hoje!'
                            : person?.project ||
                              'Sonhar Acordado'}
                        </span>
                      </div>

                      {today && (
                        <div className="birthday-celebration">
                          ✦
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="community-empty">
                  Os aniversariantes do mês
                  aparecerão aqui.
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
      {selectedEvent && (
        <div
          className="community-event-modal"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="community-event-modal-backdrop"
            onClick={() => setSelectedEvent(null)}
            aria-label="Fechar"
          />

          <div className="community-event-modal-card">
            <button
              type="button"
              className="community-event-modal-close"
              onClick={() => setSelectedEvent(null)}
            >
              ×
            </button>

            <EventRegistrationPanel
              event={selectedEvent}
              currentUser={currentUser}
              onUpdated={loadHome}
            />
          </div>
        </div>
      )}

    </div>
  )
}

export default CommunityHome
