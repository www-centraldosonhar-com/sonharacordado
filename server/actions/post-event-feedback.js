import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)


// =========================================================
// EVENTO PENDENTE DE AVALIAÇÃO
// =========================================================
//
// Um usuário pode avaliar somente quando:
//
// 1. esteve inscrito;
// 2. teve CHECK-IN confirmado;
// 3. o evento está em Pós-Evento;
// 4. ainda não avaliou aquele evento.
// =========================================================

async function getEligibleEvent(
  userId,
  eventId = null
) {
  const numericEventId =
    eventId == null
      ? null
      : Number(eventId)

  const rows = await sql`
    SELECT DISTINCT
      event.id,
      event.name,
      event.event_date,
      project.name AS event_project

    FROM event_registrations registration

    JOIN activity_checklist_items item
      ON item.registration_id =
        registration.id

      AND item.checked = 1

    JOIN activity_checklists checklist
      ON checklist.id =
        item.checklist_id


    JOIN event_roles role
      ON role.id =
        checklist.event_role_id

      AND role.event_id =
        registration.event_id

    JOIN events event
      ON event.id =
        registration.event_id

    LEFT JOIN projects project
      ON project.id =
        event.project_id

    LEFT JOIN post_event_feedback feedback
      ON feedback.event_id =
        event.id

      AND feedback.user_id =
        registration.user_id

    WHERE
      registration.user_id =
        ${Number(userId)}

      AND registration.status =
        'confirmed'

      AND event.event_status IN (
        'post_event',
        'closed'
      )

      AND feedback.id IS NULL

      AND (
        ${numericEventId}::int IS NULL

        OR event.id =
          ${numericEventId}
      )

    ORDER BY
      event.event_date ASC,
      event.id ASC

    LIMIT 1
  `

  return rows[0] || null
}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  request,
  response
) {
  const sessionUser =
    await getSessionUser(request)

  const userId =
    Number(
      sessionUser?.userId
    )

  if (
    !Number.isInteger(
      userId
    )
  ) {
    return response.status(401).json({
      error:
        'Sua sessão expirou. Entre novamente.',
    })
  }

  try {

    // =====================================================
    // GET
    // Verifica se existe uma avaliação pendente.
    // =====================================================

    if (
      request.method === 'GET'
    ) {
      const event =
        await getEligibleEvent(
          userId
        )

      return response.status(200).json({
        pending:
          Boolean(event),

        event:
          event || null,
      })
    }


    // =====================================================
    // POST
    // Salva a avaliação.
    // =====================================================

    if (
      request.method === 'POST'
    ) {
      const {
        eventId,
        rating,
        comment,
      } = request.body ?? {}

      const numericEventId =
        Number(eventId)

      const numericRating =
        Number(rating)

      if (
        !Number.isInteger(
          numericEventId
        )
      ) {
        return response.status(400).json({
          error:
            'Evento inválido.',
        })
      }

      if (
        !Number.isInteger(
          numericRating
        ) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return response.status(400).json({
          error:
            'Escolha de 1 a 5 corações.',
        })
      }

      const cleanComment =
        typeof comment ===
          'string'
          ? comment.trim()
          : ''

      if (
        cleanComment.length >
        1500
      ) {
        return response.status(400).json({
          error:
            'O comentário é muito longo.',
        })
      }


      // Confirma novamente que o usuário
      // realmente esteve presente.
      const eligibleEvent =
        await getEligibleEvent(
          userId,
          numericEventId
        )

      if (!eligibleEvent) {
        return response.status(409).json({
          error:
            'Esta avaliação não está mais disponível.',
        })
      }


      await sql`
        INSERT INTO post_event_feedback (
          event_id,
          user_id,
          rating,
          comment,
          created_at
        )

        VALUES (
          ${numericEventId},
          ${userId},
          ${numericRating},
          ${cleanComment || null},
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (
          event_id,
          user_id
        )

        DO NOTHING
      `


      // Se existir outro evento pendente,
      // ele será mostrado em seguida.
      const nextEvent =
        await getEligibleEvent(
          userId
        )


      return response.status(200).json({
        success: true,

        message:
          'Obrigado por compartilhar como foi. ♥',

        pending:
          Boolean(nextEvent),

        event:
          nextEvent || null,
      })
    }


    return response.status(405).json({
      error:
        'Method not allowed.',
    })
  } catch (error) {
    console.error(
      'POST EVENT FEEDBACK ERROR:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível carregar a avaliação agora.',
    })
  }
}
