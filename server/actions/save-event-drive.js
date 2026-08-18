import process from 'node:process'
import { neon } from '@neondatabase/serverless'

import {
  getSessionUser,
} from './_session.js'


// =========================================================
// SAVE EVENT GOOGLE DRIVE FOLDER
// =========================================================
// Saves the Google Drive folder generated after a
// photographer successfully uploads the event photos.
//
// Security:
// - Requires an authenticated user.
// - The user must have an active Photography confirmation
//   for this specific event.
// =========================================================

export default async function saveEventDriveHandler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Método não permitido.',
    })
  }

  try {
    const sessionUser =
      await getSessionUser(request)

    if (!sessionUser) {
      return response.status(401).json({
        error: 'Sessão inválida.',
      })
    }

    const {
      eventId,
      driveLink,
    } = request.body || {}

    if (
      !eventId ||
      !driveLink ||
      typeof driveLink !== 'string'
    ) {
      return response.status(400).json({
        error:
          'Evento ou pasta do Google Drive inválida.',
      })
    }

    const cleanDriveLink =
      driveLink.trim()

    if (
      !cleanDriveLink.startsWith(
        'https://drive.google.com/'
      )
    ) {
      return response.status(400).json({
        error:
          'O link informado não pertence ao Google Drive.',
      })
    }

    const sql =
      neon(process.env.DATABASE_URL)

    // =====================================================
    // VERIFY PHOTOGRAPHER PERMISSION
    // =====================================================

    const permissions = await sql`
      SELECT
        confirmations.id
      FROM confirmations
      INNER JOIN event_roles
        ON confirmations.event_role_id =
          event_roles.id
      INNER JOIN roles
        ON event_roles.role_id =
          roles.id
      WHERE confirmations.user_id =
          ${sessionUser.userId}
        AND event_roles.event_id =
          ${eventId}
        AND confirmations.status =
          'confirmed'
        AND LOWER(roles.name) =
          'photography'
      LIMIT 1
    `

    if (!permissions[0]) {
      return response.status(403).json({
        error:
          'Você não possui permissão para entregar fotos deste evento.',
      })
    }

    // =====================================================
    // SAVE DRIVE LINK
    // =====================================================

    const updatedEvents = await sql`
      UPDATE events
      SET drive_link =
        ${cleanDriveLink}
      WHERE id = ${eventId}
      RETURNING
        id,
        name,
        drive_link
    `

    if (!updatedEvents[0]) {
      return response.status(404).json({
        error: 'Evento não encontrado.',
      })
    }

    return response.status(200).json({
      success: true,

      event:
        updatedEvents[0],

      message:
        'Pasta de fotos vinculada ao evento! 📸',
    })
  } catch (error) {
    console.error(
      'Save event Drive error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível vincular as fotos ao evento.',
    })
  }
}
