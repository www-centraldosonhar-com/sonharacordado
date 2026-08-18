import { useCallback, useEffect, useState } from 'react'

import AppHeader from '../components/AppHeader'
import EventCard from '../components/EventCard'
import ActivityCard from '../components/ActivityCard'
import CommitmentCard from '../components/CommitmentCard'
import MissionCard from '../components/MissionCard'
import AnnouncementCard from '../components/AnnouncementCard'
import PastEventCard from '../components/PastEventCard'
import PhotoDeliveryPanel from '../components/PhotoDeliveryPanel'
import VolunteerCard from '../components/VolunteerCard'

import '../styles/home.css'

function HomePage({
  user,
  onLogout,
  onOpenAdmin,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadHome = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/volunteer?action=home'
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível carregar a Central.'
        )
      }

      setData(result)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    fetch('/api/volunteer?action=home')
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar a Central.'
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
      <main className="screen-center">
        <div className="loading-card">
          <p>
            Abrindo a Central... ✨
          </p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="screen-center">
        <div className="error-card">
          <h1>Central do Sonhar</h1>

          <p>{error}</p>

          <button
            type="button"
            className="secondary-button"
            onClick={loadHome}
          >
            Tentar novamente
          </button>
        </div>
      </main>
    )
  }

  const currentUser =
    data?.currentUser || user

  const sameDay =
    data.nextEvents.length === 2 &&
    String(data.nextEvents[0].event_date).slice(0, 10) ===
      String(data.nextEvents[1].event_date).slice(0, 10)

  return (
    <>
      <AppHeader
        user={currentUser}
        onLogout={onLogout}
        onOpenAdmin={onOpenAdmin}
      />

      <div className="home-layout">
        <aside className="home-sidebar">
          <div className="home-sidebar-card">
            <nav className="sidebar-nav">
              <a href="#inicio">🏠 Início</a>
              <a href="#eventos">📅 Encontros</a>
              <a href="#combinados">🤝 Combinados</a>
              <a href="#minhas-missoes">🚀 Minhas missões</a>
              <a href="#missoes">💡 Missões</a>
              <a href="#mural">📢 Mural</a>
              <a href="#memorias">📸 Memórias</a>
              <a href="#equipe">🫶 Equipe</a>
            </nav>
          </div>
        </aside>

        <main
          className="app-shell home-main"
          id="inicio"
        >
          <section className="welcome-strip">
            <div className="welcome-dot" />

            <p>
              <strong>
                Seu cantinho para fazer o bem acontecer.
              </strong>
              {' '}
              Veja o que está rolando e onde você pode
              somar hoje.
            </p>
          </section>

          <section
            className="section-block"
            id="eventos"
          >
            <div className="section-heading">
              <p className="eyebrow">
                PRÓXIMOS ENCONTROS
              </p>

              <h2>
                Tem coisa boa chegando ✨
              </h2>
            </div>

            {sameDay && (
              <div className="same-day-banner">
                ✨ Dois encontros acontecendo no mesmo dia!
              </div>
            )}

            {data.nextEvents.length > 0 ? (
              <div className="upcoming-events-grid">
                {data.nextEvents.map((event) => (
                  <div
                    className="upcoming-event-group"
                    key={event.id}
                  >
                    <EventCard event={event} />

                    <div className="event-activities-block">
                      <div className="event-activities-heading">
                        <span>🙋</span>

                        <strong>
                          Atividades deste encontro
                        </strong>
                      </div>

                      {event.activities.length > 0 ? (
                        <div className="cards-grid">
                          {event.activities.map(
                            (activity) => (
                              <ActivityCard
                                key={activity.id}
                                activity={activity}
                                onUpdated={loadHome}
                              />
                            )
                          )}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <p>
                            Nenhuma atividade aberta
                            para este encontro.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>
                  Nenhum encontro programado agora.
                </p>
              </div>
            )}
          </section>

          {data.myConfirmations
            .filter((confirmation) => {
              const role =
                confirmation.role
                  ?.toLowerCase() || ''

              const isPhotography =
                role.includes('photo') ||
                role.includes('foto')

              const eventDate =
                String(
                  confirmation.event_date
                ).slice(0, 10)

              const eventAlreadyHappened =
                eventDate &&
                new Date(
                  `${eventDate}T23:59:59`
                ) < new Date()

              return (
                isPhotography &&
                eventAlreadyHappened
              )
            })
            .map((confirmation) => (
              <PhotoDeliveryPanel
                key={
                  `photos-${confirmation.id}`
                }
                event={{
                  id:
                    confirmation.event_id,

                  name:
                    confirmation.event_name,
                }}
                photographerName={
                  data.currentUser.name
                }
                confirmationId={
                  confirmation.id
                }
                photoSubmittedAt={
                  confirmation.photo_submitted_at
                }
              />
            ))}

          <section
            className="section-block"
            id="combinados"
          >
            <div className="section-heading">
              <p className="eyebrow eyebrow-red">
                MEUS COMBINADOS
              </p>

              <h2>
                Onde você já disse “conta comigo” 🤝
              </h2>
            </div>

            {data.myConfirmations.length > 0 ? (
              <div className="cards-grid">
                {data.myConfirmations.map(
                  (confirmation) => (
                    <CommitmentCard
                      key={confirmation.id}
                      confirmation={confirmation}
                      onUpdated={loadHome}
                    />
                  )
                )}
              </div>
            ) : (
              <div className="empty-state">
                <p>
                  Você ainda não confirmou nenhuma atividade.
                </p>
              </div>
            )}
          </section>

          <section
            className="section-block"
            id="minhas-missoes"
          >
            <div className="section-heading">
              <p className="eyebrow eyebrow-blue">
                MINHAS MISSÕES
              </p>

              <h2>
                Tudo que você topou ajudar a tirar do papel 🚀
              </h2>
            </div>

            {data.myTasks.length > 0 ? (
              <div className="cards-stack">
                {data.myTasks.map((mission) => (
                  <MissionCard
                    key={mission.participation_id}
                    mission={mission}
                    mine
                    onUpdated={loadHome}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>
                  Você ainda não pegou nenhuma missão.
                </p>
              </div>
            )}
          </section>

          <section
            className="section-block"
            id="missoes"
          >
            <div className="section-heading">
              <p className="eyebrow eyebrow-blue">
                MISSÕES DISPONÍVEIS
              </p>

              <h2>
                Tem algo aqui que combina com você? ✨
              </h2>
            </div>

            {data.tasks.length > 0 ? (
              <div className="cards-grid">
                {data.tasks.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onUpdated={loadHome}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>
                  Nenhuma missão disponível agora.
                </p>
              </div>
            )}
          </section>

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

            {data.announcements.length > 0 ? (
              <div className="cards-stack">
                {data.announcements.map(
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

          <section
            className="section-block"
            id="memorias"
          >
            <div className="section-heading">
              <p className="eyebrow eyebrow-orange">
                MEMÓRIAS
              </p>

              <h2>
                Reviva um pouquinho do que aconteceu por aqui 📸
              </h2>
            </div>

            {data.pastEvents.length > 0 ? (
              <div className="memories-grid">
                {data.pastEvents.map((event) => (
                  <PastEventCard
                    key={event.id}
                    event={event}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">
                  📷
                </span>

                <p>
                  Assim que as fotos forem disponibilizadas,
                  elas aparecem aqui.
                </p>
              </div>
            )}
          </section>

          <section
            className="section-block last-section"
            id="equipe"
          >
            <div className="section-heading">
              <p className="eyebrow eyebrow-red">
                QUEM VAI ESTAR LÁ?
              </p>

              <h2>
                Gente que já disse “eu vou” 🫶
              </h2>
            </div>

            {data.confirmations.length > 0 ? (
              <div className="people-list">
                {data.confirmations.map(
                  (volunteer, index) => (
                    <VolunteerCard
                      key={`${volunteer.name}-${volunteer.role}-${index}`}
                      volunteer={volunteer}
                    />
                  )
                )}
              </div>
            ) : (
              <div className="empty-state">
                <p>Ninguém confirmado ainda.</p>
              </div>
            )}
          </section>
        </main>
      </div>

      <nav className="mobile-bottom-nav">
        <a href="#inicio">
          <span>🏠</span>
          <small>Início</small>
        </a>

        <a href="#eventos">
          <span>📅</span>
          <small>Eventos</small>
        </a>

        <a href="#missoes">
          <span>🚀</span>
          <small>Missões</small>
        </a>

        <a href="#memorias">
          <span>📸</span>
          <small>Memórias</small>
        </a>

        <a href="#equipe">
          <span>🫶</span>
          <small>Equipe</small>
        </a>
      </nav>
    </>
  )
}

export default HomePage
