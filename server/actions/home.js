import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const sessionUser = await getSessionUser(request)

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error: 'Sessão inválida ou expirada.',
    })
  }

  try {
    // =====================================================
    // CURRENT USER
    // =====================================================
    const users = await sql`
      SELECT
        users.id,
        users.name,
        users.avatar_path,
        users.user_type,
        users.active,
        projects.name AS project
      FROM users
      JOIN projects
        ON users.project_id = projects.id
      WHERE users.id = ${sessionUser.userId}
      LIMIT 1
    `

    const currentUser = users[0]

    if (!currentUser || !currentUser.active) {
      return response.status(401).json({
        error: 'Usuário inativo.',
      })
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
        events.event_date,
        events.event_time,
        events.location,
        events.sympla_link,
        events.event_image_path,
        events.confirmation_deadline,
        projects.name AS project
      FROM events
      LEFT JOIN projects
        ON events.project_id = projects.id
      WHERE events.active = 1
        AND events.event_date >= CURRENT_DATE
      ORDER BY
        events.event_date ASC,
        events.event_time ASC
      LIMIT 2
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
            events.confirmation_deadline
          ORDER BY roles.name
        `

        return {
          ...event,
          activities,
        }
      })
    )

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
        projects.name AS project
      FROM events
      LEFT JOIN projects
        ON events.project_id = projects.id
      WHERE events.event_date < CURRENT_DATE
        AND events.drive_link IS NOT NULL
        AND TRIM(events.drive_link) <> ''
      ORDER BY
        events.event_date DESC,
        events.event_time DESC
      LIMIT 8
    `

    // =====================================================
    // AVAILABLE TASKS
    // =====================================================
    const tasks = await sql`
      SELECT
        tasks.id,
        tasks.title,
        tasks.description,
        tasks.deadline,
        tasks.priority,
        tasks.status,
        tasks.volunteer_limit,
        COUNT(task_users.id)::int AS volunteer_count,
        CASE
          WHEN tasks.deadline < CURRENT_TIMESTAMP
          THEN 1
          ELSE 0
        END AS overdue
      FROM tasks
      LEFT JOIN task_users
        ON task_users.task_id = tasks.id
        AND task_users.status = 'active'
      WHERE tasks.active = 1
        AND tasks.status != 'completed'
        AND NOT EXISTS (
          SELECT 1
          FROM task_users existing_participation
          WHERE existing_participation.task_id = tasks.id
            AND existing_participation.user_id = ${currentUser.id}
            AND existing_participation.status = 'active'
        )
      GROUP BY
        tasks.id,
        tasks.title,
        tasks.description,
        tasks.deadline,
        tasks.priority,
        tasks.status,
        tasks.volunteer_limit
      ORDER BY
        CASE tasks.priority
          WHEN 'urgent' THEN 1
          WHEN 'important' THEN 2
          ELSE 3
        END,
        tasks.deadline ASC
    `

    // =====================================================
    // CURRENT USER TASKS
    // =====================================================
    const myTasks = await sql`
      SELECT
        task_users.id AS participation_id,
        task_users.delivery_link,
        task_users.submitted_at,
        tasks.id AS task_id,
        tasks.title,
        tasks.description,
        tasks.deadline,
        tasks.priority,
        tasks.status
      FROM task_users
      JOIN tasks
        ON task_users.task_id = tasks.id
      WHERE task_users.user_id = ${currentUser.id}
        AND task_users.status = 'active'
        AND tasks.active = 1
      ORDER BY tasks.deadline ASC
    `

    // =====================================================
    // ANNOUNCEMENTS
    // =====================================================
    const announcements = await sql`
      SELECT
        announcements.id,
        announcements.title,
        announcements.message,
        announcements.priority,
        announcements.created_at,
        users.name AS created_by_name
      FROM announcements
      JOIN users
        ON announcements.created_by = users.id
      WHERE announcements.active = 1
      ORDER BY
        CASE announcements.priority
          WHEN 'urgent' THEN 1
          WHEN 'important' THEN 2
          ELSE 3
        END,
        announcements.created_at DESC
    `

    return response.status(200).json({
      currentUser,
      confirmations,
      myConfirmations,
      nextEvents,
      pastEvents,
      tasks,
      myTasks,
      announcements,
    })
  } catch (error) {
    console.error('Home API error:', error)

    return response.status(500).json({
      error: 'Não foi possível carregar a Central.',
    })
  }
}
