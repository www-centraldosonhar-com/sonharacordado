import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const sessionUser = await getSessionUser(
    request
  )

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error: 'Sessão inválida ou expirada.',
    })
  }

  const {
    eventRoleId,
  } = request.body ?? {}

  if (!eventRoleId) {
    return response.status(400).json({
      error: 'Atividade inválida.',
    })
  }

  try {
    const eventRoles = await sql`
      SELECT
        er.id,
        er.event_id,
        er.vacancy_limit,
        er.active,
        e.active AS event_active,
        e.confirmation_deadline,
        r.name AS role_name,
        e.name AS event_name
      FROM event_roles er
      JOIN events e
        ON er.event_id = e.id
      JOIN roles r
        ON er.role_id = r.id
      WHERE er.id = ${eventRoleId}
      LIMIT 1
    `

    const eventRole = eventRoles[0]

    if (
      !eventRole ||
      !eventRole.active ||
      !eventRole.event_active
    ) {
      return response.status(400).json({
        error: 'Essa atividade não está disponível.',
      })
    }

    const deadlinePassed =
      new Date(eventRole.confirmation_deadline)
      < new Date()

    if (deadlinePassed) {
      return response.status(400).json({
        error: 'O prazo de confirmação já encerrou.',
      })
    }

    const registrations = await sql`
      SELECT id
      FROM event_registrations
      WHERE event_id =
        ${eventRole.event_id}
        AND user_id =
          ${sessionUser.userId}
        AND status = 'confirmed'
      LIMIT 1
    `

    if (!registrations[0]) {
      return response.status(403).json({
        error:
          'Você precisa ter sua inscrição no evento confirmada antes de assumir uma atividade.',
      })
    }

    const existing = await sql`
      SELECT id, status
      FROM confirmations
      WHERE user_id = ${sessionUser.userId}
        AND event_role_id = ${eventRoleId}
      LIMIT 1
    `

    if (
      existing[0]?.status === 'confirmed'
    ) {
      return response.status(409).json({
        error: 'Você já confirmou essa atividade.',
      })
    }

    const counts = await sql`
      SELECT COUNT(*)::int AS total
      FROM confirmations
      WHERE event_role_id = ${eventRoleId}
        AND status = 'confirmed'
    `

    const confirmedCount =
      Number(counts[0]?.total || 0)

    if (
      confirmedCount >=
      Number(eventRole.vacancy_limit)
    ) {
      return response.status(409).json({
        error: 'As vagas dessa atividade acabaram.',
      })
    }

    if (existing[0]) {
      await sql`
        UPDATE confirmations
        SET
          status = 'confirmed',
          cancellation_reason = NULL
        WHERE id = ${existing[0].id}
      `
    } else {
      await sql`
        INSERT INTO confirmations (
          user_id,
          event_role_id,
          status
        )
        VALUES (
          ${sessionUser.userId},
          ${eventRoleId},
          'confirmed'
        )
      `
    }

    return response.status(200).json({
      success: true,
      message: `Você confirmou ${eventRole.role_name}! ❤️`,
    })
  } catch (error) {
    console.error(
      'Confirm activity error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível confirmar essa atividade.',
    })
  }
}
