import EventRegistrationPanel from '../EventRegistrationPanel'
import UserAvatar from '../UserAvatar'
import { useState } from 'react'

function CommunityHome({
  currentMonthLabel,
  currentMonthEvents,
  getLocalDate,
  universalMediaActivities,
  monthlyBirthdays,
  monthlyCommunity,
  isBirthdayToday,
  currentUser,
  loadHome,
}) {
  const [selectedEvent, setSelectedEvent] = useState(null)

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
                {currentMonthEvents.length}
                {' '}
                {currentMonthEvents.length === 1
                  ? 'evento'
                  : 'eventos'}
              </span>
            </div>

            <div className="community-timeline">
              {currentMonthEvents.length > 0 ? (
                currentMonthEvents.map((event, index) => {
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
              {universalMediaActivities.length > 0 ? (
                universalMediaActivities
                  .slice(0, 4)
                  .map((activity, index) => (
                    <div
                      className="community-media-task"
                      key={
                        activity?.id ||
                        `${activity?.title}-${index}`
                      }
                    >
                      <div className="community-media-number">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div>
                        <strong>
                          {activity?.title ||
                            activity?.name ||
                            'Atividade de Mídias'}
                        </strong>

                        <span>
                          {activity?.description ||
                            activity?.role ||
                            'Colaboração aberta'}
                        </span>
                      </div>
                    </div>
                  ))
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
            <span className="community-eyebrow">
              Memórias
            </span>

            <h3>
              Fotos que contam o Sonhar.
            </h3>

            <p>
              Registros dos encontros de todos
              os projetos reunidos em um só lugar.
            </p>

            <div className="community-photo-collage">
              <div />
              <div />
              <div />
            </div>

            <button
              className="community-ghost-button"
              type="button"
            >
              Ver fotos
              <span>↗</span>
            </button>
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
