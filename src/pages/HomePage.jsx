import { useCallback, useEffect, useState } from 'react'

import AppHeader from '../components/AppHeader'
import VolunteerChecklistPanel from '../components/VolunteerChecklistPanel'
import VolunteerAreaSelector from '../components/VolunteerAreaSelector'

import '../styles/home.css'
import CommunityHome from '../components/home/CommunityHome'
import MyTeamHome from '../components/home/MyTeamHome'

function HomePage({
  user,
  onLogout,
  onOpenAdmin,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const [
    selectedArea,
    setSelectedArea,
  ] = useState('general')

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

  const volunteerAccess =
    data?.volunteerAccess

  // =====================================================
  // HOME VIEWS
  // =====================================================
  //
  // general:
  // - página principal da Central;
  // - todos os próximos eventos;
  // - atividades de Mídias;
  // - conteúdo geral da ONG;
  //
  // team:
  // - apenas o projeto do voluntário;
  // - apenas sua equipe principal;
  // - inscrição do evento;
  // - checklists, combinados e tarefas pessoais.
  // =====================================================

  const activeView =
    selectedArea === 'team'
      ? 'team'
      : 'general'

  const isGeneralView =
    activeView === 'general'

  const isTeamView =
    activeView === 'team'

  const currentProjectId =
    Number(
      volunteerAccess?.project?.id
    )

  const primaryTeam =
    volunteerAccess?.primaryTeam ||
    volunteerAccess
      ?.availableTeams
      ?.find(
        (team) =>
          team.code !== 'media'
      ) ||
    null

  const primaryTeamCode =
    primaryTeam?.code || null

  // =====================================================
  // GENERAL CONTENT
  // =====================================================
  // Conteúdo geral inclui:
  // - Mídias;
  // - conteúdo realmente global.
  // =====================================================

  function matchesGeneralContent(item) {
    const teamCode =
      item?.team_code || null

    const projectId =
      item?.project_id === null ||
      item?.project_id === undefined
        ? null
        : Number(item.project_id)

    if (teamCode === 'media') {
      return true
    }

    return (
      teamCode === null &&
      projectId === null
    )
  }

  // =====================================================
  // TEAM CONTENT
  // =====================================================
  // Conteúdo da equipe precisa:
  // - pertencer ao projeto do voluntário;
  // - pertencer à equipe principal dele.
  //
  // Conteúdo de projeto sem equipe também pode aparecer.
  // =====================================================

  function matchesTeamContent(item) {
    const teamCode =
      item?.team_code || null

    const projectId =
      item?.project_id === null ||
      item?.project_id === undefined
        ? null
        : Number(item.project_id)

    if (
      projectId !== currentProjectId
    ) {
      return false
    }

    if (!teamCode) {
      return true
    }

    return (
      primaryTeamCode &&
      teamCode === primaryTeamCode
    )
  }

  // =====================================================
  // EVENTS
  // =====================================================

  const visibleEvents =
    isGeneralView
      ? data.nextEvents.map(
          (event) => ({
            ...event,

            // Na página geral mostramos somente
            // atividades de Mídias.
            activities:
              event.activities.filter(
                (activity) =>
                  activity.team_code ===
                  'media'
              ),
          })
        )
      : data.nextEvents
          .filter(
            (event) =>
              Number(
                event.project_id
              ) === currentProjectId
          )
          .map(
            (event) => ({
              ...event,

              // Na página da equipe mostramos somente
              // atividades da equipe principal.
              activities:
                event.activities.filter(
                  (activity) =>
                    activity.team_code ===
                    primaryTeamCode
                ),
            })
          )

  // =====================================================
  // MISSIONS / ANNOUNCEMENTS
  // =====================================================


  const visibleAnnouncements =
    data.announcements.filter(
      isGeneralView
        ? matchesGeneralContent
        : matchesTeamContent
    )
    visibleEvents.length === 2 &&
    String(
      visibleEvents[0].event_date
    ).slice(0, 10) ===
      String(
        visibleEvents[1].event_date
      ).slice(0, 10)

  const communityNow = new Date()

  const currentMonthLabel =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        month: 'long',
        year: 'numeric',
      }
    )
      .format(communityNow)
      .replace(
        /^./,
        (letter) => letter.toUpperCase()
      )

  const getLocalDate = (value) => {
    if (!value) return null

    // Evita alteração de dia causada por UTC em datas YYYY-MM-DD.
    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      const [year, month, day] =
        value.split('-').map(Number)

      return new Date(
        year,
        month - 1,
        day
      )
    }

    const parsed = new Date(value)

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed
  }

  const universalEvents =
    data?.nextEvents ||
    data?.upcomingEvents ||
    data?.events ||
    []

  const currentMonthEvents =
    universalEvents.filter((event) => {
      const date = getLocalDate(
        event?.date ||
        event?.event_date ||
        event?.starts_at
      )

      if (!date) return false

      return (
        date.getMonth() ===
          communityNow.getMonth() &&
        date.getFullYear() ===
          communityNow.getFullYear()
      )
    })

  const universalMediaActivities =
    data?.communityActivities || []

  const monthlyBirthdays =
    data?.monthlyBirthdays ||
    data?.birthdays ||
    []

  const isBirthdayToday = (person) => {
    const date = getLocalDate(
      person?.birth_date ||
      person?.birthDate ||
      person?.birthday
    )

    if (!date) return false

    return (
      date.getDate() ===
        communityNow.getDate() &&
      date.getMonth() ===
        communityNow.getMonth()
    )
  }

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

              <a href="#eventos">
                📅 Encontros
              </a>

              

              <a href="#mural">
                📢 Mural
              </a>

              {isGeneralView && (
                <a href="#memorias">
                  📸 Memórias
                </a>
              )}
            </nav>
          </div>
        </aside>

        <main
          className={`app-shell home-main project-theme-${String(
            currentUser?.project || ''
          ).toLowerCase()}`}
          id="inicio"
        >
          <VolunteerAreaSelector
            access={volunteerAccess}
            selectedArea={activeView}
            onSelect={setSelectedArea}
            primaryTeam={volunteerAccess?.primaryTeam}
            project={currentUser?.project}
          />

          {isTeamView && (
            <VolunteerChecklistPanel
              onUpdated={loadHome}
            />
          )}

          {isTeamView && (
            <MyTeamHome
              project={currentUser?.project}
              currentUser={currentUser}
              projectEvents={
                (data?.nextEvents || []).filter((event) => {
                  const userProject =
                    String(
                      currentUser?.project || ''
                    )
                      .trim()
                      .toUpperCase()

                  const eventProject =
                    String(
                      event?.project ||
                      event?.project_code ||
                      event?.projectCode ||
                      ''
                    )
                      .trim()
                      .toUpperCase()

                  return (
                    eventProject === userProject
                  )
                })
              }
              visibleAnnouncements={
                visibleAnnouncements
              }
              myConfirmations={
                data?.myConfirmations || []
              }
              communityCommitments={
                (data?.myConfirmations || []).filter(
                  (item) =>
                    item?.community_visible === true ||
                    item?.community_visible === 1
                )
              }
              photoDeliveries={
                (
                  data?.myConfirmations ||
                  data?.confirmations ||
                  []
                ).filter((item) => {
                  const requiresDelivery =
                    item?.requires_delivery === true ||
                    item?.requiresDelivery === true ||
                    item?.requires_delivery === 1

                  const alreadySubmitted =
                    Boolean(
                      item?.photo_submitted_at ||
                      item?.photoSubmittedAt
                    )

                  return (
                    requiresDelivery &&
                    !alreadySubmitted
                  )
                })
              }
              loadHome={loadHome}
            />
          )}

          {isGeneralView && (
            <CommunityHome
              currentMonthLabel={currentMonthLabel}
              currentMonthEvents={currentMonthEvents}
              getLocalDate={getLocalDate}
              universalMediaActivities={
                universalMediaActivities
              }
              monthlyBirthdays={monthlyBirthdays}
              monthlyCommunity={data?.monthlyCommunity}
              isBirthdayToday={isBirthdayToday}
              currentUser={currentUser}
              loadHome={loadHome}
            />
          )}








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

        {isGeneralView && (
          <>
            

            <a href="#mural">
              <span>📢</span>
              <small>Mural</small>
            </a>

            <a href="#memorias">
              <span>📸</span>
              <small>Memórias</small>
            </a>
          </>
        )}

        {isTeamView && (
          <>
            <a href="#combinados">
              <span>🤝</span>
              <small>Combinados</small>
            </a>

            

            <a href="#mural">
              <span>📢</span>
              <small>Mural</small>
            </a>
          </>
        )}
      </nav>
    </>
  )
}

export default HomePage
