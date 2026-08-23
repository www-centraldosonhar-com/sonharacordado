import AnnouncementCard from '../AnnouncementCard'
import PhotoDeliveryPanel from '../PhotoDeliveryPanel'
import CommitmentCard from '../CommitmentCard'
import EventRegistrationPanel from '../EventRegistrationPanel'

function MyTeamHome({
  project,
  currentUser,
  projectEvents = [],
  visibleAnnouncements,
  communityCommitments = [],
  photoDeliveries = [],
  loadHome,
}) {
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
      <section className="team-project-events">
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
                    event.activities.length > 0 && (
                      <div className="team-event-activities">
                        <div className="team-event-activities-head">
                          <span>
                            ATIVIDADES DA EQUIPE
                          </span>

                          <small>
                            {event.activities.length}
                            {' '}
                            {event.activities.length === 1
                              ? 'atividade'
                              : 'atividades'}
                          </small>
                        </div>

                        <div className="team-event-activities-list">
                          {event.activities.map((activity) => (
                            <article
                              key={activity.id}
                              className="team-event-activity-card"
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
                                {activity.vacancy_limit ? (
                                  <span>
                                    {Number(
                                      activity.confirmed_count ||
                                      0
                                    )}
                                    /
                                    {activity.vacancy_limit}
                                    {' '}
                                    confirmados
                                  </span>
                                ) : (
                                  <span>
                                    {Number(
                                      activity.confirmed_count ||
                                      0
                                    )}
                                    {' '}
                                    confirmados
                                  </span>
                                )}

                                {activity.requires_delivery && (
                                  <span className="is-delivery">
                                    entrega
                                  </span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
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

      <nav className="team-section-nav">
        <a href="#combinados">
          🤝 Combinados
        </a>

        
      </nav>

      

      

      {communityCommitments.length > 0 && (
        <section
          className="section-block community-commitments-section"
          id="atividades-comunidade"
        >
          <div className="section-heading">
            <p className="eyebrow eyebrow-blue">
              ATIVIDADE DA COMUNIDADE
            </p>

            <h2>
              O que você topou fazer com todo o Sonhar ✨
            </h2>

            <p>
              Essas atividades foram abertas para voluntários
              de todos os projetos e agora fazem parte da sua Sala.
            </p>
          </div>

          <div className="cards-stack">
            {communityCommitments.map((confirmation) => (
              <div
                className="community-commitment-wrapper"
                key={
                  confirmation.id ||
                  confirmation.confirmation_id
                }
              >
                <div className="community-origin-badge">
                  <span>✦</span>
                  Comunidade
                </div>

                <CommitmentCard
                  confirmation={confirmation}
                  onUpdated={loadHome}
                />
              </div>
            ))}
          </div>
        </section>
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
