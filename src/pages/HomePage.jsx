import { useCallback, useEffect, useState } from 'react'

import AppHeader from '../components/AppHeader'
import EventCard from '../components/EventCard'
import ActivityCard from '../components/ActivityCard'
import MissionCard from '../components/MissionCard'
import AnnouncementCard from '../components/AnnouncementCard'
import VolunteerCard from '../components/VolunteerCard'
import CommitmentCard from '../components/CommitmentCard'

import '../styles/home.css'

function HomePage({ user, onLogout, onOpenAdmin }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadHome = useCallback(async () => {
    try {
      const response = await fetch('/api/home')
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
    let isActive = true

    fetch('/api/home')
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar a Central.'
          )
        }

        if (isActive) {
          setData(result)
        }
      })
      .catch((loadError) => {
        if (isActive) {
          setError(loadError.message)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  if (isLoading) {
    return (
      <main className="screen-center">
        <div className="loading-card">
          <div className="brand-hearts">
            <span className="heart-red">♥</span>
            <span className="heart-orange">♥</span>
            <span className="heart-blue">♥</span>
          </div>

          <p>Abrindo a Central... ✨</p>
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
              <a href="#inicio">
                🏠 Início
              </a>

              <a href="#evento">
                📅 Próximo encontro
              </a>

              <a href="#atividades">
                🙋 Atividades
              </a>

              <a href="#minhas-missoes">
                🚀 Minhas missões
              </a>

              <a href="#missoes">
                💡 Missões
              </a>

              <a href="#mural">
                📢 Mural
              </a>

              <a href="#equipe">
                🫶 Equipe
              </a>
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
            id="evento"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  PRÓXIMO ENCONTRO
                </p>

                <h2>
                  Tem coisa boa chegando ✨
                </h2>
              </div>
            </div>

            <EventCard
              event={data.nextEvent}
            />
          </section>

          <section
            className="section-block"
            id="atividades"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow eyebrow-red">
                  ATIVIDADES DO EVENTO
                </p>

                <h2>
                  Escolha onde você quer somar ❤️
                </h2>
              </div>
            </div>

            {data.eventRoles.length > 0 ? (
              <div className="cards-grid">
                {data.eventRoles.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onUpdated={loadHome}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">
                  ✨
                </span>

                <p>
                  Nenhuma atividade aberta agora.
                </p>
              </div>
            )}
          </section>

          <section
            className="section-block"
            id="combinados"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow eyebrow-red">
                  MEUS COMBINADOS
                </p>

                <h2>
                  Onde você já disse “conta comigo” 🤝
                </h2>
              </div>
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
                <span className="empty-icon">
                  🌱
                </span>

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
              <div>
                <p className="eyebrow eyebrow-blue">
                  MINHAS MISSÕES
                </p>

                <h2>
                  Tudo que você topou ajudar a tirar do papel 🚀
                </h2>
              </div>
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
                <span className="empty-icon">
                  🌱
                </span>

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
              <div>
                <p className="eyebrow eyebrow-blue">
                  MISSÕES DISPONÍVEIS
                </p>

                <h2>
                  Tem algo aqui que combina com você? ✨
                </h2>
              </div>
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
                <span className="empty-icon">
                  🌈
                </span>

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
              <div>
                <p className="eyebrow eyebrow-orange">
                  MURAL DO SONHAR
                </p>

                <h2>
                  Recados importantes para ninguém ficar de fora 📢
                </h2>
              </div>
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
                <span className="empty-icon">
                  💬
                </span>

                <p>
                  O mural está tranquilo por enquanto.
                </p>
              </div>
            )}
          </section>

          <section
            className="section-block last-section"
            id="equipe"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow eyebrow-red">
                  QUEM VAI ESTAR LÁ?
                </p>

                <h2>
                  Gente que já disse “eu vou” 🫶
                </h2>
              </div>
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
                <span className="empty-icon">
                  🫶
                </span>

                <p>
                  Ninguém confirmado ainda.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>

      <nav
        className="mobile-bottom-nav"
        aria-label="Navegação principal"
      >
        <a href="#inicio">
          <span>🏠</span>
          <small>Início</small>
        </a>

        <a href="#atividades">
          <span>🙋</span>
          <small>Atividades</small>
        </a>

        <a href="#missoes">
          <span>🚀</span>
          <small>Missões</small>
        </a>

        <a href="#mural">
          <span>📢</span>
          <small>Mural</small>
        </a>

        <a href="#equipe">
          <span>🫶</span>
          <small>Equipe</small>
        </a>
      </nav>

      <footer className="app-footer">
        <div className="brand-hearts footer-hearts">
          <span className="heart-red">♥</span>
          <span className="heart-orange">♥</span>
          <span className="heart-blue">♥</span>
        </div>

        <p>
          Feito para ajudar quem ajuda.
        </p>
      </footer>
    </>
  )
}

export default HomePage
