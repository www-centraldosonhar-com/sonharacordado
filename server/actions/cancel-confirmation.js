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

  const sessionUser = await getSessionUser(request)

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error: 'Sessão inválida ou expirada.',
    })
  }

  const { confirmationId, reason } = request.body ?? {}

  if (!confirmationId) {
    return response.status(400).json({
      error: 'Confirmação inválida.',
    })
  }

  if (!reason?.trim()) {
    return response.status(400).json({
      error: 'Conte pra gente o motivo da desistência.',
    })
  }

  try {
    const confirmations = await sql`
      SELECT
        c.id,
        c.status,
        e.confirmation_deadline,
        e.name AS event_name,
        r.name AS role_name
      FROM confirmations c
      JOIN event_roles er
        ON c.event_role_id = er.id
      JOIN events e
        ON er.event_id = e.id
      JOIN roles r
        ON er.role_id = r.id
      WHERE c.id = ${confirmationId}
        AND c.user_id = ${sessionUser.userId}
      LIMIT 1
    `

    const confirmation = confirmations[0]

    if (
      !confirmation ||
      confirmation.status !== 'confirmed'
    ) {
      return response.status(404).json({
        error: 'Confirmação não encontrada.',
      })
    }

    if (
      new Date(confirmation.confirmation_deadline) <
      new Date()
    ) {
      return response.status(400).json({
        error:
          'O prazo para alterar essa confirmação já encerrou.',
      })
    }

    await sql`
      UPDATE confirmations
      SET
        status = 'cancelled',
        cancellation_reason = ${reason.trim()}
      WHERE id = ${confirmation.id}
        AND user_id = ${sessionUser.userId}
    `

    return response.status(200).json({
      success: true,
      message: 'Confirmação cancelada.',
    })
  } catch (error) {
    console.error('Cancel confirmation error:', error)

    return response.status(500).json({
      error:
        'Não foi possível cancelar sua confirmação.',
    })
  }
}
