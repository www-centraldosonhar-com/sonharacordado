import AnnouncementCard from '../AnnouncementCard'
import PhotoDeliveryPanel from '../PhotoDeliveryPanel'
import EventRegistrationPanel from '../EventRegistrationPanel'
import VolunteerChecklistPanel from '../VolunteerChecklistPanel'
import MediaContentStorePanel from '../MediaContentStorePanel'

function MyTeamHome({
  project,
  currentUser,
  projectEvents = [],
  visibleAnnouncements,
  myConfirmations = [],
  photoDeliveries = [],
  loadHome,
}) {
  const getActivityConfirmation = (
    activityId
  ) =>
    myConfirmations.find(
      (confirmation) =>
        Number(
          confirmation.event_role_id
        ) === Number(activityId) &&
        confirmation.status ===
          'confirmed'
    ) || null

  async function handleJoinActivity(
    activity
  ) {
    try {
      const response =
        await fetch(
          '/api/volunteer?action=confirm-activity',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                eventRoleId:
                  activity.id,
                source:
                  'team',
              }),
          }
        )

      const result =
        await response.json()

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


  async function handleLeaveActivity(
    activity
  ) {
    const confirmation =
      getActivityConfirmation(
        activity.id
      )

    if (!confirmation) {
      return
    }

    const reason =
      window.prompt(
        'Conte rapidamente por que você está saindo da atividade:'
      )

    if (reason === null) {
      return
    }

    try {
      const response =
        await fetch(
          '/api/volunteer?action=cancel-confirmation',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                confirmationId:
                  confirmation.id ||
                  confirmation.confirmation_id,

                reason:
                  String(
                    reason || ''
                  ).trim(),
              }),
          }
        )

      const result =
        await response.json()

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


  const projectCode =
    String(project || '').toUpperCase()

const projectWelcome = {
    PPF: {
      title: 'Seja bem-vindo à Central!',
      subtitle: 'Somos Preparando Pro Futuro.',
    },
    APS: {
      title: 'Seja bem-vindo à Central!',
      subtitle: 'Somos Amigos Para Sempre.',
    },
    SJ: {
      title: 'Seja bem-vindo à Central!',
      subtitle: 'Somos Sonhando Juntos.',
    },
  }

  const welcomeMessage =
    projectWelcome[projectCode] || {
      title: 'Seja bem-vindo à Central!',
      subtitle: 'Somos Sonhar Acordado.',
    }


  return (
    <div
      className={`my-team-home project-theme-${projectCode.toLowerCase()}`}
    >
<section className="editorial-hero">
            <div className="editorial-hero-content">
              <div className="editorial-intro">
                <div className="editorial-label">
                  <span className="editorial-label-line" />
                  <span>Central do Sonhar</span>
                </div>

                <h1>
                  {welcomeMessage.title}
                </h1>

                <p className="editorial-manifesto">
                  {welcomeMessage.subtitle}
                </p>
              </div>

              <div
                className="editorial-art"
                aria-hidden="true"
              >
                <div className="editorial-orbit orbit-a" />
                <div className="editorial-orbit orbit-b" />

                <div className="editorial-symbol symbol-red">
                  ♥
                </div>

                <div className="editorial-symbol symbol-orange">
                  ♥
                </div>

                <div className="editorial-symbol symbol-blue">
                  ♥
                </div>

                <div className="editorial-center">
                  <span className="editorial-center-dot" />
                </div>
              </div>

              <div className="editorial-foot">
                <div className="editorial-live">
                  <span />
                  Central ativa
                </div>

                <p>
                  encontros · atividades · memórias
                </p>
              </div>
            </div>
          </section>
      <section
        id="team-events"
        className="team-project-events"
      >
        <div className="team-project-events-head">
          <div>
            <span className="team-event-eyebrow">
              PRÓXIMO ENCONTRO
            </span>

            <h2>
              O que vem por aí na Sala {projectCode}
            </h2>
          </div>

          <span className="team-event-project-pill">
            {projectCode}
          </span>
        </div>

        {projectEvents.length > 0 ? (
          <div className="team-event-list">
            {projectEvents.slice(0, 3).map((event) => {
              const rawDate =
                event?.event_date ||
                event?.date ||
                event?.starts_at

              const eventDate =
                rawDate
                  ? new Date(rawDate)
                  : null

              return (
                <article
                  className="team-event-card"
                  key={event.id}
                >
                  <div className="team-event-date">
                    <strong>
                      {eventDate
                        ? String(
                            eventDate.getDate()
                          ).padStart(2, '0')
                        : '--'}
                    </strong>

                    <span>
                      {eventDate
                        ? eventDate
                            .toLocaleDateString(
                              'pt-BR',
                              { month: 'short' }
                            )
                            .replace('.', '')
                        : ''}
                    </span>
                  </div>

                  <div className="team-event-content">
                    <span className="team-event-label">
                      Evento {projectCode}
                    </span>

                    <h3>
                      {event?.name ||
                        event?.title ||
                        'Evento Sonhar'}
                    </h3>

                    <p>
                      {event?.location ||
                        'Local a confirmar'}
                    </p>
                  </div>

                  {Array.isArray(event?.activities) &&
                    event.activities.length > 0 &&
                    event.registration?.status ===
                      'confirmed' && (
                      <details className="team-event-activity-group team-event-inline-activities">
                        <summary className="team-event-activity-group-summary">
                          <div>
                            <span>
                              ATIVIDADES DO EVENTO
                            </span>

                            <strong>
                              Escolha onde você quer ajudar
                            </strong>
                          </div>

                          <small>
                            {event.activities.length}
                          </small>
                        </summary>

                        <div className="team-event-activities-list">
                          {event.activities.map(
                            (activity) => {
                              const confirmation =
                                myConfirmations.find(
                                  (item) =>
                                    Number(
                                      item.event_role_id ||
                                      item.eventRoleId ||
                                      item.activity_id ||
                                      0
                                    ) ===
                                    Number(activity.id)
                                ) || null

                              const joined =
                                Boolean(
                                  confirmation &&
                                  confirmation.status ===
                                    'confirmed'
                                )

                              return (
                                <article
                                  key={activity.id}
                                  className={`team-event-activity-card ${
                                    joined
                                      ? 'is-joined'
                                      : ''
                                  }`}
                                >
                                  <div>
                                    <strong>
                                      {activity.role_name ||
                                        activity.name ||
                                        'Atividade'}
                                    </strong>

                                    <span>
                                      {activity.team_name ||
                                        'Equipe'}
                                    </span>
                                  </div>

                                  <div className="team-event-activity-meta">
                                    <span>
                                      {Number(
                                        activity.confirmed_count ||
                                        0
                                      )}
                                      {activity.vacancy_limit
                                        ? `/${activity.vacancy_limit}`
                                        : ''}
                                      {' '}
                                      participantes
                                    </span>

                                    {Number(
                                      activity.allows_checklist ||
                                      0
                                    ) === 1 && (
                                      <span className="is-checklist">
                                        checklist
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
                                        entrega
                                      </span>
                                    )}

                                    {joined && (
                                      <span className="is-participating">
                                        ✓ Participando
                                      </span>
                                    )}
                                  </div>

                                  {joined ? (
                                    <div className="team-activity-joined-actions">
                                      <div className="team-activity-joined-label">
                                        <span>✓</span>

                                        <strong>
                                          Já estou participando!
                                        </strong>
                                      </div>

                                      <button
                                        type="button"
                                        className="team-activity-leave-button"
                                        onClick={() =>
                                          handleLeaveActivity(
                                            activity
                                          )
                                        }
                                      >
                                        Sair da atividade
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="team-event-activity-action"
                                      onClick={() =>
                                        handleJoinActivity(
                                          activity
                                        )
                                      }
                                    >
                                      Participar
                                    </button>
                                  )}
                                </article>
                              )
                            }
                          )}
                        </div>
                      </details>
                    )}

                  <div className="team-event-registration">
                    <EventRegistrationPanel
                      event={event}
                      currentUser={currentUser}
                      onUpdated={loadHome}
                      compact
                    />
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="team-event-empty">
            <span>✦</span>

            <div>
              <strong>
                Nenhum encontro anunciado ainda.
              </strong>

              <p>
                Quando surgir um novo evento do seu projeto,
                ele aparecerá aqui.
              </p>
            </div>
          </div>
        )}
      </section>

      
      <div className="team-inline-checklist">
        <VolunteerChecklistPanel
          onUpdated={loadHome}
        />
      </div>



      

      


      {(currentUser?.mediaSupport === true ||
        currentUser?.adminScope === 'global') && (
        <MediaContentStorePanel />
      )}

      {photoDeliveries.length > 0 && (
        <section
          className="section-block"
          id="pos-evento"
        >
          <div className="section-heading">
            <p className="eyebrow eyebrow-orange">
              PÓS-EVENTO
            </p>

            <h2>
              Entregas de fotografia 📸
            </h2>

            <p>
              Prepare, envie e finalize suas fotos
              diretamente por aqui.
            </p>
          </div>

          <div className="cards-stack">
            {photoDeliveries.map((delivery) => (
              <PhotoDeliveryPanel
                key={
                  delivery.confirmation_id ||
                  delivery.confirmationId ||
                  delivery.id
                }
                confirmationId={
                  delivery.confirmation_id ||
                  delivery.confirmationId ||
                  delivery.id
                }
                event={
                  delivery.event || {
                    id:
                      delivery.event_id ||
                      delivery.eventId,
                    name:
                      delivery.event_name ||
                      delivery.eventName ||
                      delivery.title ||
                      'Evento Sonhar',
                  }
                }
                photographerName={
                  delivery.user_name ||
                  delivery.userName ||
                  delivery.photographer_name ||
                  delivery.photographerName ||
                  ''
                }
                deliveryDeadline={
                  delivery.delivery_deadline ||
                  delivery.deliveryDeadline ||
                  null
                }
                reviewStatus={
                  delivery.delivery_review_status ||
                  delivery.deliveryReviewStatus ||
                  ''
                }
                reviewNote={
                  delivery.delivery_review_note ||
                  delivery.deliveryReviewNote ||
                  ''
                }
                deliveryLink={
                  delivery.delivery_link ||
                  delivery.deliveryLink ||
                  ''
                }
                photoSubmittedAt={
                  delivery.photo_submitted_at ||
                  delivery.photoSubmittedAt ||
                  null
                }
                completedAt={
                  delivery.completed_at ||
                  delivery.completedAt ||
                  null
                }
                onCompleted={loadHome}
              />
            ))}
          </div>
        </section>
      )}

      <section
        className="section-block"
        id="mural"
      >
        <div className="section-heading">
          <p className="eyebrow eyebrow-orange">
            MURAL DO SONHAR
          </p>

          <h2>
            Recados importantes para ninguém ficar de fora 📢
          </h2>
        </div>

        {visibleAnnouncements.length > 0 ? (
          <div className="cards-stack">
            {visibleAnnouncements.map(
              (announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                />
              )
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>
              O mural está tranquilo por enquanto.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default MyTeamHome
