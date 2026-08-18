import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

async function requireAdmin(request) {
  const sessionUser = await getSessionUser(request)

  if (!sessionUser?.userId) {
    return null
  }

  const users = await sql`
    SELECT
      id,
      user_type,
      active
    FROM users
    WHERE id = ${sessionUser.userId}
    LIMIT 1
  `

  const user = users[0]

  if (
    !user ||
    !user.active ||
    user.user_type !== 'admin'
  ) {
    return null
  }

  return user
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const admin = await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error: 'Acesso administrativo não autorizado.',
    })
  }

  try {
    const projects = await sql`
      SELECT
        id,
        name
      FROM projects
      ORDER BY name
    `

    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.user_type,
        u.active,
        u.avatar_path,
        u.project_id,
        p.name AS project
      FROM users u
      JOIN projects p
        ON u.project_id = p.id
      ORDER BY
        u.active DESC,
        u.name
    `

    const events = await sql`
      SELECT
        e.id,
        e.name,
        e.project_id,
        e.event_type,
        e.event_date,
        e.event_time,
        e.location,
        e.confirmation_deadline,
        e.sympla_link,
        e.drive_link,
        e.event_image_path,
        e.active,
        p.name AS project
      FROM events e
      LEFT JOIN projects p
        ON e.project_id = p.id
      ORDER BY
        e.event_date DESC,
        e.event_time DESC
    `

    const roles = await sql`
      SELECT
        id,
        name
      FROM roles
      ORDER BY name
    `

    const eventRoles = await sql`
      SELECT
        er.id,
        er.event_id,
        er.role_id,
        er.description,
        er.vacancy_limit,
        er.active,
        er.requires_delivery,
        er.delivery_deadline,
        e.name AS event_name,
        e.event_date,
        r.name AS role_name,
        COUNT(c.id)::int AS confirmed_count
      FROM event_roles er
      JOIN events e
        ON er.event_id = e.id
      JOIN roles r
        ON er.role_id = r.id
      LEFT JOIN confirmations c
        ON c.event_role_id = er.id
        AND c.status = 'confirmed'
      GROUP BY
        er.id,
        er.event_id,
        er.role_id,
        er.description,
        er.vacancy_limit,
        er.active,
        er.requires_delivery,
        er.delivery_deadline,
        e.name,
        e.event_date,
        r.name
      ORDER BY
        e.event_date DESC,
        r.name
    `

    const tasks = await sql`
      SELECT
        t.id,
        t.title,
        t.description,
        t.event_id,
        t.deadline,
        t.priority,
        t.status,
        t.volunteer_limit,
        t.active,
        e.name AS event_name,
        COUNT(tu.id)::int AS volunteer_count
      FROM tasks t
      LEFT JOIN events e
        ON t.event_id = e.id
      LEFT JOIN task_users tu
        ON tu.task_id = t.id
        AND tu.status = 'active'
      GROUP BY
        t.id,
        t.title,
        t.description,
        t.event_id,
        t.deadline,
        t.priority,
        t.status,
        t.volunteer_limit,
        t.active,
        e.name
      ORDER BY
        t.deadline DESC
    `

    // =====================================================
    // ACTIVITY PARTICIPANTS
    // =====================================================
    // Lista individualmente os voluntários confirmados nas
    // atividades dos eventos. O completed_at será usado pelo
    // admin para controlar a conclusão de cada participação.
    // =====================================================

    const activityParticipants = await sql`
      SELECT
        c.id AS confirmation_id,
        c.event_role_id,
        c.user_id,
        c.status,
        c.completed_at,
        c.photo_submitted_at,
        er.requires_delivery,
        er.delivery_deadline,
        u.name AS user_name,
        p.name AS project_name,
        r.name AS role_name,
        e.name AS event_name
      FROM confirmations c
      JOIN users u
        ON c.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN event_roles er
        ON c.event_role_id = er.id
      JOIN roles r
        ON er.role_id = r.id
      JOIN events e
        ON er.event_id = e.id
      WHERE c.status = 'confirmed'
        AND c.completed_at IS NULL
      ORDER BY
        e.event_date DESC,
        r.name,
        u.name
    `

    // =====================================================
    // MISSION PARTICIPANTS
    // =====================================================
    // Lista quem assumiu cada missão e permite que o Admin
    // acompanhe entrega e conclusão individual.
    // =====================================================

    const taskParticipants = await sql`
      SELECT
        tu.id AS participation_id,
        tu.task_id,
        tu.user_id,
        tu.status,
        tu.delivery_link,
        tu.submitted_at,
        tu.completed_at,
        u.name AS user_name,
        p.name AS project_name,
        t.title AS task_title
      FROM task_users tu
      JOIN users u
        ON tu.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN tasks t
        ON tu.task_id = t.id
      WHERE tu.status = 'active'
      ORDER BY
        t.deadline DESC,
        u.name
    `

    const announcements = await sql`
      SELECT
        a.id,
        a.title,
        a.message,
        a.priority,
        a.active,
        a.created_at,
        u.name AS created_by_name
      FROM announcements a
      JOIN users u
        ON a.created_by = u.id
      ORDER BY
        a.created_at DESC
    `

    const confirmations = await sql`
      SELECT
        c.id,
        u.name,
        p.name AS project,
        r.name AS role,
        e.name AS event_name
      FROM confirmations c
      JOIN users u
        ON c.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN event_roles er
        ON c.event_role_id = er.id
      JOIN roles r
        ON er.role_id = r.id
      JOIN events e
        ON er.event_id = e.id
      WHERE c.status = 'confirmed'
      ORDER BY
        e.event_date DESC,
        u.name
    `

    return response.status(200).json({
      projects,
      users,
      events,
      roles,
      eventRoles,
      tasks,
      activityParticipants,
      taskParticipants,
      announcements,
      confirmations,
    })
  } catch (error) {
    console.error(
      'Admin data error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível carregar o painel administrativo.',
    })
  }
}
