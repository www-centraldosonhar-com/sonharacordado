import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { requireVolunteer } from './_volunteer-access.js'

const sql = neon(process.env.DATABASE_URL)

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const currentUser =
    await requireVolunteer(request)

  if (!currentUser) {
    return response.status(403).json({
      error:
        'Você não possui acesso à Central do Voluntário.',
    })
  }

  try {
    const hasMediaAccess =
      currentUser.mediaSupport

    const currentProjectId =
      Number(currentUser.project_id)


    const userTeamIds = new Set(
      (currentUser.teams || [])
        .map((team) =>
          Number(
            typeof team === 'object'
              ? team.id
              : team
          )
        )
        .filter(Number.isFinite)
    )

    const canSeeScopedContent = (item) => {
      const projectId =
        item?.project_id == null
          ? null
          : Number(item.project_id)

      const teamId =
        item?.team_id == null
          ? null
          : Number(item.team_id)

      const projectAllowed =
        projectId === null ||
        projectId === currentProjectId

      const teamAllowed =
        teamId === null ||
        userTeamIds.has(teamId)

      return projectAllowed && teamAllowed
    }

    // =====================================================
    // ALL CONFIRMED VOLUNTEERS
    // =====================================================
    const confirmations = await sql`
      SELECT
        users.name,
        users.avatar_path,
        projects.name AS project,
        roles.name AS role,
        events.name AS event_name
      FROM confirmations
      JOIN users
        ON confirmations.user_id = users.id
      JOIN projects
        ON users.project_id = projects.id
      JOIN event_roles
        ON confirmations.event_role_id = event_roles.id
      JOIN roles
        ON event_roles.role_id = roles.id
      JOIN events
        ON event_roles.event_id = events.id
      WHERE confirmations.status = 'confirmed'
      ORDER BY
        events.event_date,
        users.name
    `

    // =====================================================
    // CURRENT USER CONFIRMATIONS
    // =====================================================
    const myConfirmations = await sql`
      SELECT
        confirmations.id,
        confirmations.event_role_id,
        confirmations.status,
        confirmations.photo_submitted_at,
        confirmations.completed_at,
        confirmations.delivery_link,
        confirmations.delivery_review_status,
        confirmations.delivery_review_note,
        confirmations.delivery_reviewed_at,
        event_roles.requires_delivery,
        event_roles.delivery_deadline,
        event_roles.community_visible,
        events.id AS event_id,
        events.event_date,
        roles.name AS role,
        events.name AS event_name,
        CASE
          WHEN events.confirmation_deadline >= CURRENT_TIMESTAMP
          THEN 1
          ELSE 0
        END AS cancellation_open
      FROM confirmations
      JOIN event_roles
        ON confirmations.event_role_id = event_roles.id
      JOIN roles
        ON event_roles.role_id = roles.id
      JOIN events
        ON event_roles.event_id = events.id
      WHERE confirmations.user_id = ${currentUser.id}
        AND confirmations.status = 'confirmed'
      ORDER BY
        events.event_date,
        roles.name
    `

    // =====================================================
    // NEXT TWO EVENTS
    // =====================================================
    const upcomingEvents = await sql`
      SELECT
        events.id,
        events.name,
        events.project_id,
        events.event_date,
        events.event_time,
        events.location,
        events.event_image_path,
        events.confirmation_deadline,
        events.registration_fee,
        events.registration_deadline,
        events.registrations_open,
        events.active,
        (
          SELECT COUNT(*)::int
          FROM event_registrations er_count
          WHERE er_count.event_id =
            events.id
            AND er_count.status =
              'confirmed'
        ) AS registration_count,
        projects.name AS project
      FROM events
      LEFT JOIN projects
        ON events.project_id = projects.id
      WHERE events.active = 1
        AND events.event_date >= CURRENT_DATE
      ORDER BY
        events.event_date ASC,
        events.event_time ASC
      LIMIT 8
    `

    // Load activities independently for each upcoming event.
    const nextEvents = await Promise.all(
      upcomingEvents.map(async (event) => {
        const activities = await sql`
          SELECT
            event_roles.id,
            roles.name,
            event_roles.vacancy_limit,
            event_roles.description,
            event_roles.requires_delivery,
            event_roles.delivery_deadline,
            event_roles.team_id,
            event_roles.community_visible,
            teams.code AS team_code,
            teams.name AS team_name,
            events.project_id,
            COUNT(confirmations.id)::int AS confirmed_count,
            CASE
              WHEN events.confirmation_deadline >= CURRENT_TIMESTAMP
              THEN 1
              ELSE 0
            END AS confirmation_open
          FROM event_roles
          JOIN roles
            ON event_roles.role_id = roles.id
          JOIN events
            ON event_roles.event_id = events.id
          LEFT JOIN teams
            ON teams.id = event_roles.team_id
          LEFT JOIN confirmations
            ON confirmations.event_role_id = event_roles.id
            AND confirmations.status = 'confirmed'
          WHERE event_roles.event_id = ${event.id}
            AND event_roles.active = 1
            AND events.active = 1
          GROUP BY
            event_roles.id,
            roles.name,
            event_roles.vacancy_limit,
            event_roles.description,
            event_roles.requires_delivery,
            event_roles.delivery_deadline,
            event_roles.team_id,
            event_roles.community_visible,
            teams.code,
            teams.name,
            events.project_id,
            events.confirmation_deadline
          ORDER BY roles.name
        `

        const registrations = await sql`
          SELECT
            id,
            email,
            team,
            status,
            rejection_reason,
            created_at
          FROM event_registrations
          WHERE event_id = ${event.id}
            AND user_id =
              ${currentUser.id}
          LIMIT 1
        `

        return {
          ...event,
          activities,
          registration:
            registrations[0] || null,
        }
      })
    )

    // =====================================================
    // COMMUNITY MEDIA ACTIVITIES
    // Atividades publicadas na Comunidade.
    // A inscrição no evento continua obrigatória no momento
    // da confirmação da atividade.
    // =====================================================

    const monthlyBirthdays = await sql`
      SELECT
        users.id,
        users.name,
        users.birth_date,
        users.avatar_path,
        projects.name AS project

      FROM users

      LEFT JOIN projects
        ON users.project_id = projects.id

      WHERE users.active = 1
        AND users.birth_date IS NOT NULL
        AND EXTRACT(
          MONTH FROM users.birth_date
        ) = EXTRACT(
          MONTH FROM CURRENT_DATE
        )

      ORDER BY
        EXTRACT(
          DAY FROM users.birth_date
        ) ASC,
        users.name ASC
    `

    const communityActivities = await sql`
      SELECT
        event_roles.id,

        (
          SELECT COUNT(*)::int
          FROM confirmations activity_count
          WHERE activity_count.event_role_id =
            event_roles.id
            AND activity_count.status = 'confirmed'
        ) AS real_confirmed_count,

        EXISTS (
          SELECT 1
          FROM confirmations my_activity
          WHERE my_activity.event_role_id =
            event_roles.id
            AND my_activity.user_id =
              ${currentUser.id}
            AND my_activity.status = 'confirmed'
        ) AS user_joined,

        (
          SELECT my_activity.id
          FROM confirmations my_activity
          WHERE my_activity.event_role_id =
            event_roles.id
            AND my_activity.user_id =
              ${currentUser.id}
            AND my_activity.status = 'confirmed'
          ORDER BY my_activity.id DESC
          LIMIT 1
        ) AS user_confirmation_id,
        event_roles.event_id,
        event_roles.role_id,
        event_roles.team_id,
        event_roles.vacancy_limit,
        event_roles.requires_delivery,
        event_roles.delivery_deadline,
        event_roles.community_visible,

        roles.name AS role_name,

        teams.code AS team_code,
        teams.name AS team_name,

        events.name AS event_name,
        events.event_date,
        events.event_time,
        events.location,

        projects.name AS project

      FROM event_roles

      JOIN roles
        ON event_roles.role_id = roles.id

      LEFT JOIN teams
        ON event_roles.team_id = teams.id

      JOIN events
        ON event_roles.event_id = events.id

      LEFT JOIN projects
        ON events.project_id = projects.id

      WHERE event_roles.community_visible = TRUE
        AND event_roles.active = 1
        AND events.active = 1
        AND events.event_date >= CURRENT_DATE
        AND LOWER(
          COALESCE(teams.code, '')
        ) = 'media'

      ORDER BY
        events.event_date ASC,
        events.event_time ASC,
        roles.name ASC
    `

    // =====================================================
    // AFTER — PAST EVENTS WITH PHOTOS
    // =====================================================
    const pastEvents = await sql`
      SELECT
        events.id,
        events.name,
        events.event_date,
        events.event_time,
        events.location,
        events.event_image_path,
        events.drive_link,
        projects.name AS project,

        (
          SELECT STRING_AGG(
            DISTINCT r_activity.name,
            ', '
            ORDER BY r_activity.name
          )
          FROM event_roles er_names
          JOIN roles r_activity
            ON er_names.role_id = r_activity.id
          WHERE er_names.event_id = events.id
        ) AS activity_names,

        (
          SELECT STRING_AGG(
            DISTINCT u.name,
            ', '
            ORDER BY u.name
          )
          FROM confirmations c_names
          JOIN users u
            ON c_names.user_id = u.id
          JOIN event_roles er_users
            ON c_names.event_role_id = er_users.id
          WHERE er_users.event_id = events.id
            AND c_names.status = 'confirmed'
        ) AS helper_names

      FROM events
      LEFT JOIN projects
        ON events.project_id = projects.id
      WHERE events.event_date < CURRENT_DATE
        AND events.drive_link IS NOT NULL
        AND TRIM(events.drive_link) <> ''
        AND (
          ${hasMediaAccess}
          OR events.project_id =
            ${currentProjectId}
          OR events.project_id IS NULL
        )
      ORDER BY
        events.event_date DESC,
        events.event_time DESC
      LIMIT 8
    `

    // =====================================================
    // APPROVED PHOTO MEMORIES
    // Evento + fotógrafo aprovado + link oficial do Drive
    // =====================================================

    const approvedPhotoMemories = await sql`
      SELECT
        events.id AS event_id,
        events.name AS event_name,
        events.event_date,
        events.drive_link,

        projects.name AS project,

        users.id AS photographer_id,
        users.name AS photographer_name,
        users.username AS photographer_username,

        confirmations.photo_submitted_at,
        confirmations.completed_at

      FROM confirmations

      JOIN users
        ON users.id = confirmations.user_id

      JOIN event_roles
        ON event_roles.id =
          confirmations.event_role_id

      JOIN roles
        ON roles.id =
          event_roles.role_id

      JOIN events
        ON events.id =
          event_roles.event_id

      LEFT JOIN projects
        ON projects.id =
          events.project_id

      WHERE confirmations.status = 'confirmed'

        AND confirmations.photo_submitted_at
          IS NOT NULL

        AND confirmations.completed_at
          IS NOT NULL

        AND events.drive_link IS NOT NULL

        AND TRIM(events.drive_link) <> ''

        AND roles.name ILIKE '%fot%'

      ORDER BY
        events.event_date DESC,
        confirmations.completed_at DESC
    `

    // =====================================================
    const allAnnouncements = await sql`
      SELECT
        announcements.id,
        announcements.title,
        announcements.message,
        announcements.priority,
        announcements.created_at,
        announcements.project_id,
        announcements.team_id,
        teams.code AS team_code,
        teams.name AS team_name,
        users.name AS created_by_name
      FROM announcements
      JOIN users
        ON announcements.created_by = users.id
      LEFT JOIN teams
        ON teams.id = announcements.team_id
      WHERE announcements.active = 1
      ORDER BY
        CASE announcements.priority
          WHEN 'urgent' THEN 1
          WHEN 'important' THEN 2
          ELSE 3
        END,
        announcements.created_at DESC
    `

    const announcements =
      allAnnouncements.filter(canSeeScopedContent)

    const monthlyCommunityRows = await sql`
      SELECT
        word,
        message,
        month,
        year
      FROM community_monthly_settings
      WHERE year = EXTRACT(
        YEAR FROM CURRENT_DATE
      )
        AND month = EXTRACT(
          MONTH FROM CURRENT_DATE
        )
      LIMIT 1
    `

    const monthlyCommunity =
      monthlyCommunityRows[0] || null

    const volunteerAccess = {
      project: {
        id:
          currentUser.project_id,
        name:
          currentUser.project,
      },

      primaryTeam:
        currentUser.primaryTeam,

      mediaSupport:
        currentUser.mediaSupport,

      teams:
        currentUser.teams,

      availableTeams:
        currentUser.availableTeams,

      adminScope:
        currentUser.adminScope,
    }

    return response.status(200).json({
      currentUser,
      volunteerAccess,
      confirmations,
      myConfirmations,
      nextEvents,
      communityActivities,
      monthlyBirthdays,
      monthlyCommunity,
      pastEvents,
      approvedPhotoMemories,
      announcements,
    })
  } catch (error) {
    console.error('Home API error:', error)

    return response.status(500).json({
      error: 'Não foi possível carregar a Central.',
    })
  }
}
