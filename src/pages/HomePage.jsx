import { useCallback, useEffect, useState } from 'react'

import AppHeader from '../components/AppHeader'
import VolunteerAreaSelector from '../components/VolunteerAreaSelector'

import '../styles/home.css'
import '../styles/home-no-sidebar.css'
import CommunityHome from '../components/home/CommunityHome'
import MyTeamHome from '../components/home/MyTeamHome'

async function fetchHomeData() {
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

  return result
}


function HomePage({
  user,
  onBack,
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
      const result =
        await fetchHomeData()

      setData(result)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    fetchHomeData()
      .then((result) => {
        if (!active) {
          return
        }

        setData(result)
        setError('')
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError.message
          )
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

  const myConfirmedActivityIds =
    new Set(
      (data?.myConfirmations || [])
        .filter(
          (confirmation) =>
            confirmation?.status === 'confirmed'
        )
        .map(
          (confirmation) =>
            Number(
              confirmation?.event_role_id ||
              confirmation?.eventRoleId ||
              0
            )
        )
        .filter(Number.isFinite)
    )

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

              // Na Sala:
              // 1. vagas disponíveis = somente da equipe principal;
              // 2. Mídias só aparece se o usuário já assumiu
              //    a atividade pela Central Principal.
              activities:
                event.activities.filter(
                  (activity) => {
                    const teamCode =
                      String(
                        activity?.team_code || ''
                      ).toLowerCase()

                    const ownTeamActivity =
                      Boolean(primaryTeamCode) &&
                      teamCode ===
                        String(
                          primaryTeamCode
                        ).toLowerCase()

                    const joinedMediaActivity =
                      teamCode === 'media' &&
                      myConfirmedActivityIds.has(
                        Number(activity?.id)
                      )

                    return (
                      ownTeamActivity ||
                      joinedMediaActivity
                    )
                  }
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
        onBack={onBack}
        onLogout={onLogout}
        onOpenAdmin={onOpenAdmin}
      />

      <div className="home-layout home-layout--no-sidebar">
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
            <MyTeamHome
              project={currentUser?.project}
              currentUser={currentUser}
              projectEvents={visibleEvents}
              visibleAnnouncements={
                visibleAnnouncements
              }
              myConfirmations={
                data?.myConfirmations || []
              }
              pastEvents={
                data?.pastEvents || []
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

                  const reviewStatus =
                    String(
                      item?.delivery_review_status ||
                      item?.deliveryReviewStatus ||
                      ''
                    )
                      .trim()
                      .toLowerCase()

                  const needsChanges =
                    reviewStatus ===
                    'changes_requested'

                  const waitingReview =
                    reviewStatus ===
                    'pending'

                  const approved =
                    reviewStatus ===
                    'approved'

                  return (
                    requiresDelivery &&
                    !approved &&
                    (
                      !alreadySubmitted ||
                      needsChanges ||
                      waitingReview
                    )
                  )
                })
              }
              loadHome={loadHome}
            />
          )}

          {isGeneralView && (
            <CommunityHome
              currentMonthLabel={currentMonthLabel}
              upcomingEvents={data?.nextEvents || []}
              getLocalDate={getLocalDate}
              universalMediaActivities={
                universalMediaActivities
              }
              approvedPhotoMemories={
                data?.approvedPhotoMemories || []
              }
              myConfirmations={
                data?.myConfirmations || []
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

    </>
  )
}

export default HomePage
