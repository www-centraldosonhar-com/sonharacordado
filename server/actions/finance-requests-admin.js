import {
  requireAdmin,
  sql,
} from './_admin.js'


// =========================================================
// PROJECT ADMIN ACCESS
// =========================================================
//
// Comunicados financeiros são direcionados
// exclusivamente ao Admin de Projeto.
//
// Admin global e Admin de Equipe não respondem
// por este fluxo.
// =========================================================

async function requireProjectAdmin(
  request
) {
  const admin =
    await requireAdmin(request)

  if (
    admin.adminScope !==
    'project'
  ) {
    const error =
      new Error(
        'Acesso exclusivo do Admin de Projeto.'
      )

    error.statusCode = 403

    throw error
  }

  if (!admin.projectId) {
    const error =
      new Error(
        'Admin de Projeto sem projeto associado.'
      )

    error.statusCode = 403

    throw error
  }

  return admin
}


// =========================================================
// HANDLER
// =========================================================

export default async function
financeRequestsAdmin(
  request,
  response
) {
  try {
    const admin =
      await requireProjectAdmin(
        request
      )

    const operation =
      request.method === 'GET'
        ? request.query?.operation
        : request.body?.operation


    // =====================================================
    // LIST
    // =====================================================

    if (
      operation === 'list'
    ) {
      const rows =
        await sql`
          SELECT
            fr.id,
            fr.project_id,
            fr.event_id,

            fr.subject,
            fr.message,

            fr.priority,
            fr.response_deadline,
            fr.status,

            fr.response_text,
            fr.responded_at,

            fr.resolved_at,
            fr.created_at,
            fr.updated_at,

            p.name AS project_name,
            e.name AS event_name,

            creator.name
              AS created_by_name,

            responder.name
              AS responded_by_name

          FROM finance_requests fr

          JOIN projects p
            ON p.id =
              fr.project_id

          LEFT JOIN events e
            ON e.id =
              fr.event_id

          JOIN users creator
            ON creator.id =
              fr.created_by

          LEFT JOIN users responder
            ON responder.id =
              fr.responded_by

          WHERE
            fr.project_id =
              ${admin.projectId}

          ORDER BY
            CASE
              WHEN
                fr.status = 'pending'
                AND
                fr.priority = 'urgent'
              THEN 0

              WHEN
                fr.status = 'pending'
              THEN 1

              WHEN
                fr.status = 'answered'
              THEN 2

              ELSE 3
            END,

            fr.created_at DESC
        `

      return response
        .status(200)
        .json({
          requests: rows,
        })
    }


    // =====================================================
    // RESPOND
    // =====================================================

    if (
      operation === 'respond'
    ) {
      if (
        request.method !== 'POST'
      ) {
        return response
          .status(405)
          .json({
            error:
              'Método não permitido.',
          })
      }

      const requestId =
        Number(
          request.body
            ?.requestId
        )

      const responseText =
        String(
          request.body
            ?.responseText || ''
        ).trim()


      if (
        !Number.isInteger(
          requestId
        )
      ) {
        return response
          .status(400)
          .json({
            error:
              'Solicitação inválida.',
          })
      }


      if (
        responseText.length < 3
      ) {
        return response
          .status(400)
          .json({
            error:
              'Escreva uma resposta.',
          })
      }


      // A própria query garante que
      // o Admin só consiga responder
      // solicitações do seu projeto.
      const rows =
        await sql`
          SELECT
            id,
            status

          FROM finance_requests

          WHERE
            id =
              ${requestId}

            AND project_id =
              ${admin.projectId}

          LIMIT 1
        `

      const financeRequest =
        rows[0]


      if (!financeRequest) {
        return response
          .status(404)
          .json({
            error:
              'Solicitação não encontrada para este projeto.',
          })
      }


      if (
        financeRequest.status !==
        'pending'
      ) {
        return response
          .status(409)
          .json({
            error:
              'Esta solicitação não está pendente.',
          })
      }


      await sql`
        UPDATE finance_requests

        SET
          status =
            'answered',

          response_text =
            ${responseText},

          responded_by =
            ${admin.id},

          responded_at =
            CURRENT_TIMESTAMP,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id =
            ${requestId}

          AND project_id =
            ${admin.projectId}
      `


      return response
        .status(200)
        .json({
          ok: true,

          message:
            'Resposta enviada ao Financeiro.',
        })
    }


    return response
      .status(400)
      .json({
        error:
          'Operação de comunicado financeiro desconhecida.',
      })

  } catch (error) {
    console.error(
      'Finance requests admin error:',
      error
    )

    return response
      .status(
        error.statusCode ||
        error.status ||
        500
      )
      .json({
        error:
          error.message ||
          'Erro interno.',
      })
  }
}
