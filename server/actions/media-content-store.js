import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { requireVolunteer } from './_volunteer-access.js'

const sql = neon(process.env.DATABASE_URL)

function canAccessMediaStore(user) {
  return (
    user?.mediaSupport === true ||
    user?.adminScope === 'global'
  )
}

function isGoogleDriveLink(value) {
  const link = String(value || '')
    .trim()
    .toLowerCase()

  return link.startsWith(
    'https://drive.google.com/'
  )
}

export default async function handler(
  request,
  response
) {
  const currentUser =
    await requireVolunteer(request)

  if (!currentUser) {
    return response.status(401).json({
      error: 'Sessão inválida ou expirada.',
    })
  }

  if (!canAccessMediaStore(currentUser)) {
    return response.status(403).json({
      error:
        'O Armazém de Criação é exclusivo da Equipe de Mídias.',
    })
  }

  if (request.method === 'GET') {
    try {
      const myAssignments = await sql`
        SELECT
          confirmations.id AS confirmation_id,
          event_roles.id AS event_role_id,
          events.id AS event_id,
          events.name AS event_name,
          events.event_date,
          projects.id AS project_id,
          projects.name AS project_name,
          roles.name AS role_name,
          media_content_deliveries.id AS delivery_id,
          media_content_deliveries.drive_link,
          media_content_deliveries.created_at,
          media_content_deliveries.updated_at

        FROM confirmations

        JOIN event_roles
          ON event_roles.id =
            confirmations.event_role_id

        JOIN roles
          ON roles.id =
            event_roles.role_id

        JOIN teams
          ON teams.id =
            event_roles.team_id

        JOIN events
          ON events.id =
            event_roles.event_id

        LEFT JOIN projects
          ON projects.id =
            events.project_id

        LEFT JOIN media_content_deliveries
          ON media_content_deliveries.user_id =
            confirmations.user_id
          AND media_content_deliveries.event_id =
            events.id
          AND media_content_deliveries.event_role_id =
            event_roles.id

        WHERE
          confirmations.user_id =
            ${currentUser.id}

          AND confirmations.status =
            'confirmed'

          AND teams.code =
            'media'

          AND (
            roles.name ILIKE '%fot%'
            OR roles.name ILIKE '%story%'
          )

        ORDER BY
          events.event_date DESC,
          roles.name
      `

      const items = await sql`
        SELECT
          media_content_deliveries.id,
          media_content_deliveries.drive_link,
          media_content_deliveries.created_at,
          media_content_deliveries.updated_at,

          events.id AS event_id,
          events.name AS event_name,
          events.event_date,

          projects.id AS project_id,
          projects.name AS project_name,

          roles.name AS role_name,

          users.id AS user_id,

          COALESCE(
            NULLIF(
              TRIM(users.full_name),
              ''
            ),
            users.name
          ) AS user_name

        FROM media_content_deliveries

        JOIN events
          ON events.id =
            media_content_deliveries.event_id

        JOIN event_roles
          ON event_roles.id =
            media_content_deliveries.event_role_id

        JOIN roles
          ON roles.id =
            event_roles.role_id

        JOIN teams
          ON teams.id =
            event_roles.team_id

        JOIN users
          ON users.id =
            media_content_deliveries.user_id

        LEFT JOIN projects
          ON projects.id =
            events.project_id

        WHERE
          teams.code = 'media'

          AND (
            roles.name ILIKE '%fot%'
            OR roles.name ILIKE '%story%'
          )

        ORDER BY
          events.event_date DESC,
          media_content_deliveries.updated_at DESC
      `

      return response.status(200).json({
        myAssignments,
        items,
        total: items.length,
      })
    } catch (error) {
      console.error(
        'Media content store GET error:',
        error
      )

      return response.status(500).json({
        error:
          'Não foi possível carregar o Armazém de Criação.',
      })
    }
  }

  if (request.method === 'POST') {
    const {
      eventRoleId,
      driveLink,
    } = request.body || {}

    const cleanDriveLink =
      String(driveLink || '').trim()

    if (!eventRoleId) {
      return response.status(400).json({
        error:
          'Atividade de Mídias não informada.',
      })
    }

    if (!isGoogleDriveLink(cleanDriveLink)) {
      return response.status(400).json({
        error:
          'Informe um link válido do Google Drive.',
      })
    }

    try {
      const assignments = await sql`
        SELECT
          events.id AS event_id,
          event_roles.id AS event_role_id,
          roles.name AS role_name,
          teams.code AS team_code

        FROM confirmations

        JOIN event_roles
          ON event_roles.id =
            confirmations.event_role_id

        JOIN roles
          ON roles.id =
            event_roles.role_id

        JOIN teams
          ON teams.id =
            event_roles.team_id

        JOIN events
          ON events.id =
            event_roles.event_id

        WHERE
          confirmations.user_id =
            ${currentUser.id}

          AND confirmations.status =
            'confirmed'

          AND event_roles.id =
            ${eventRoleId}

          AND teams.code =
            'media'

          AND (
            roles.name ILIKE '%fot%'
            OR roles.name ILIKE '%story%'
          )

        LIMIT 1
      `

      const assignment =
        assignments[0]

      if (!assignment) {
        return response.status(403).json({
          error:
            'Você não possui uma atividade válida de Fotografia ou Storymaker.',
        })
      }

      const saved = await sql`
        INSERT INTO
          media_content_deliveries (
            event_id,
            event_role_id,
            user_id,
            drive_link
          )

        VALUES (
          ${assignment.event_id},
          ${assignment.event_role_id},
          ${currentUser.id},
          ${cleanDriveLink}
        )

        ON CONFLICT (
          user_id,
          event_id,
          event_role_id
        )

        DO UPDATE SET
          drive_link =
            EXCLUDED.drive_link,
          updated_at =
            CURRENT_TIMESTAMP

        RETURNING
          id,
          event_id,
          event_role_id,
          user_id,
          drive_link,
          created_at,
          updated_at
      `

      return response.status(200).json({
        success: true,
        item: saved[0],
        message:
          'Material salvo no Armazém de Criação! 📦✨',
      })
    } catch (error) {
      console.error(
        'Media content store POST error:',
        error
      )

      return response.status(500).json({
        error:
          'Não foi possível salvar o material no Armazém.',
      })
    }
  }

  return response.status(405).json({
    error: 'Método não permitido.',
  })
}
