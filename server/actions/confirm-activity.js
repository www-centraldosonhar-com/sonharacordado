import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const sessionUser =
    await getSessionUser(request)

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error:
        'Sessão inválida ou expirada.',
    })
  }

  const {
    eventRoleId,
    source,
  } = request.body ?? {}

  const normalizedSource =
    String(source || '')
      .trim()
      .toLowerCase()

  if (!eventRoleId) {
    return response.status(400).json({
      error: 'Atividade inválida.',
    })
  }

  if (
    normalizedSource !== 'team' &&
    normalizedSource !== 'community'
  ) {
    return response.status(400).json({
      error:
        'Origem da atividade inválida.',
    })
  }

  try {
    // =====================================================
    // ACTIVITY CONTEXT
    // =====================================================

    const eventRoles = await sql`
      SELECT
        er.id,
        er.event_id,
        er.team_id,
        er.vacancy_limit,
        er.active,
        er.community_visible,
        er.accept_until,

        e.active AS event_active,
        e.project_id,
        e.name AS event_name,

        r.name AS role_name,

        t.code AS team_code,
        t.name AS team_name

      FROM event_roles er

      JOIN events e
        ON er.event_id = e.id

      JOIN roles r
        ON er.role_id = r.id

      LEFT JOIN teams t
        ON t.id = er.team_id

      WHERE er.id = ${eventRoleId}

      LIMIT 1
    `

    const eventRole =
      eventRoles[0]

    if (
      !eventRole ||
      !eventRole.active ||
      !eventRole.event_active
    ) {
      return response.status(400).json({
        error:
          'Essa atividade não está disponível.',
      })
    }

    // =====================================================
    // USER CONTEXT
    // Usa SOMENTE equipes realmente vinculadas ao usuário.
    // Admin não ganha automaticamente direito de participar
    // de uma equipe operacional.
    // =====================================================

    const users = await sql`
      SELECT
        id,
        project_id
      FROM users
      WHERE id =
        ${sessionUser.userId}
        AND active = 1
      LIMIT 1
    `

    const user = users[0]

    if (!user) {
      return response.status(403).json({
        error:
          'Usuário sem acesso à Central.',
      })
    }

    const teamMembership = await sql`
      SELECT 1
      FROM user_teams
      WHERE user_id =
        ${sessionUser.userId}

        AND team_id =
          ${eventRole.team_id}

        AND active = 1

      LIMIT 1
    `

    const belongsToActivityTeam =
      Boolean(teamMembership[0])

    const activityTeamCode =
      String(
        eventRole.team_code || ''
      )
        .trim()
        .toLowerCase()

    // =====================================================
    // BUSINESS RULE — COMMUNITY
    // Só Mídias pode ser assumida pela Central Principal.
    // =====================================================

    if (
      normalizedSource ===
      'community'
    ) {
      if (
        activityTeamCode !==
          'media' ||
        !eventRole.community_visible
      ) {
        return response.status(403).json({
          error:
            'Na Central Principal só é possível assumir atividades de Mídias.',
        })
      }
    }

    // =====================================================
    // BUSINESS RULE — TEAM ROOM
    //
    // Sala:
    // - somente equipe real do usuário;
    // - somente projeto do usuário;
    // - Mídias NUNCA é assumida pela Sala.
    // =====================================================

    if (
      normalizedSource ===
      'team'
    ) {
      if (
        activityTeamCode ===
        'media'
      ) {
        return response.status(403).json({
          error:
            'Atividades de Mídias devem ser assumidas pela Central Principal.',
        })
      }

      if (
        Number(
          eventRole.project_id
        ) !==
        Number(
          user.project_id
        )
      ) {
        return response.status(403).json({
          error:
            'Essa atividade pertence a outro projeto.',
        })
      }

      if (!belongsToActivityTeam) {
        return response.status(403).json({
          error:
            `Essa atividade é exclusiva da ${
              eventRole.team_name ||
              'equipe responsável'
            }.`,
        })
      }
    }

    // =====================================================
    // DEADLINE
    // =====================================================

    /*
     * O prazo do EVENTO controla inscrição no evento.
     *
     * O prazo da ATIVIDADE controla até quando
     * novas pessoas podem assumir esta função.
     *
     * accept_until vazio significa que a atividade
     * não possui prazo próprio.
     */
    const activityDeadlinePassed =
      Boolean(
        eventRole.accept_until
      ) &&
      new Date(
        eventRole.accept_until
      ) < new Date()

    if (activityDeadlinePassed) {
      return response.status(400).json({
        error:
          'O prazo para assumir esta atividade já encerrou.',
      })
    }

    // =====================================================
    // EVENT REGISTRATION REQUIRED
    // =====================================================

    const registrations = await sql`
      SELECT id
      FROM event_registrations
      WHERE event_id =
        ${eventRole.event_id}

        AND user_id =
          ${sessionUser.userId}

        AND status =
          'confirmed'

      LIMIT 1
    `

    if (!registrations[0]) {
      return response.status(403).json({
        error:
          'Você precisa ter sua inscrição no evento confirmada antes de assumir uma atividade.',
      })
    }

    // =====================================================
    // EXISTING CONFIRMATION
    // =====================================================

    const existing = await sql`
      SELECT
        id,
        status,
        completed_at,
        delivery_review_status

      FROM confirmations

      WHERE user_id =
        ${sessionUser.userId}

        AND event_role_id =
          ${eventRoleId}

      LIMIT 1
    `

    if (
      existing[0]?.status ===
      'confirmed'
    ) {
      return response.status(409).json({
        error:
          'Você já confirmou essa atividade.',
      })
    }

    // =====================================================
    // VACANCIES
    // =====================================================

    const counts = await sql`
      SELECT
        COUNT(*)::int AS total

      FROM confirmations

      WHERE event_role_id =
        ${eventRoleId}

        AND status =
          'confirmed'
    `

    const confirmedCount =
      Number(
        counts[0]?.total || 0
      )

    const vacancyLimit =
      Number(
        eventRole.vacancy_limit ||
        0
      )

    if (
      vacancyLimit > 0 &&
      confirmedCount >=
        vacancyLimit
    ) {
      return response.status(409).json({
        error:
          'As vagas dessa atividade acabaram.',
      })
    }

    // =====================================================
    // CONFIRM
    // =====================================================

    if (existing[0]) {
      await sql`
        UPDATE confirmations
        SET
          status = 'confirmed',
          cancellation_reason = NULL,
          completed_at = NULL,
          delivery_review_status = NULL,
          delivery_review_note = NULL,
          delivery_reviewed_at = NULL

        WHERE id =
          ${existing[0].id}
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

      message:
        `Você confirmou ${eventRole.role_name}! ❤️`,
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
