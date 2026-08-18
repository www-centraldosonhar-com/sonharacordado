import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// COMPLETE PHOTO DELIVERY
// =========================================================
// Marks a Photography confirmation as delivered.
//
// Security:
// - User must be authenticated.
// - Confirmation must belong to the logged-in user.
// - Confirmation must still be active.
// - Role must be Photography.
// =========================================================

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Método não permitido.',
    })
  }

  const sessionUser =
    await getSessionUser(request)

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error: 'Sessão inválida ou expirada.',
    })
  }

  const {
    confirmationId,
  } = request.body ?? {}

  if (!confirmationId) {
    return response.status(400).json({
      error:
        'Confirmação de fotografia não informada.',
    })
  }

  try {
    const confirmations = await sql`
      SELECT
        c.id,
        c.photo_submitted_at,
        r.name AS role_name
      FROM confirmations c
      INNER JOIN event_roles er
        ON c.event_role_id = er.id
      INNER JOIN roles r
        ON er.role_id = r.id
      WHERE c.id = ${confirmationId}
        AND c.user_id = ${sessionUser.userId}
        AND c.status = 'confirmed'
      LIMIT 1
    `

    const confirmation =
      confirmations[0]

    if (!confirmation) {
      return response.status(404).json({
        error:
          'Confirmação não encontrada.',
      })
    }

    if (
      confirmation.role_name
        ?.trim()
        .toLowerCase() !== 'photography'
    ) {
      return response.status(403).json({
        error:
          'Esta confirmação não é de fotografia.',
      })
    }

    // Already delivered: keep the original timestamp.
    if (confirmation.photo_submitted_at) {
      return response.status(200).json({
        success: true,
        alreadySubmitted: true,
        photoSubmittedAt:
          confirmation.photo_submitted_at,
      })
    }

    const updated = await sql`
      UPDATE confirmations
      SET
        photo_submitted_at =
          CURRENT_TIMESTAMP
      WHERE id = ${confirmationId}
        AND user_id = ${sessionUser.userId}
      RETURNING
        id,
        photo_submitted_at
    `

    return response.status(200).json({
      success: true,
      alreadySubmitted: false,
      photoSubmittedAt:
        updated[0].photo_submitted_at,
      message:
        'Entrega de fotografia concluída! 📸✅',
    })
  } catch (error) {
    console.error(
      'Complete photo delivery error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível concluir a entrega das fotos.',
    })
  }
}
