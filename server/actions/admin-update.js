import {
  adminCanAccessEvent,
  adminCanUseContentScope,
  adminCanAccessUser,
  adminCanAccessProject,
  isGlobalAdmin,
  isMediaAdmin,
  isTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'

function cleanText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function forbidden(response) {
  return response.status(403).json({
    error:
      'Você não possui permissão para essa operação.',
  })
}

export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const admin = await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error:
        'Acesso administrativo não autorizado.',
    })
  }

  const {
    action,
    id,
    data = {},
  } = request.body ?? {}

  const recordId = Number(id)

  if (
    !action ||
    !Number.isInteger(recordId) ||
    recordId < 1
  ) {
    return response.status(400).json({
      error: 'Operação inválida.',
    })
  }

  try {
    // ---------------------------------
    // USER
    // ---------------------------------

    const userActions = [
      'toggle-user',
      'update-user',
      'reset-password',
    ]

    if (
      userActions.includes(action)
    ) {
      const canAccessUser =
        await adminCanAccessUser(
          admin,
          recordId
        )

      if (!canAccessUser) {
        return forbidden(response)
      }
    }

    if (action === 'toggle-user') {
      if (recordId === Number(admin.id)) {
        return response.status(400).json({
          error:
            'Você não pode desativar sua própria conta.',
        })
      }

      const users = await sql`
        UPDATE users
        SET active =
          CASE
            WHEN active = 1 THEN 0
            ELSE 1
          END
        WHERE id = ${recordId}
        RETURNING id, active
      `

      if (!users[0]) {
        return response.status(404).json({
          error: 'Usuário não encontrado.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          Number(users[0].active) === 1
            ? 'Usuário ativado! 👤'
            : 'Usuário desativado.',
      })
    }

    if (action === 'update-user') {
      const email = cleanText(data.email)
      const projectId =
        Number(data.projectId)

      const userType =
        data.userType

      const primaryTeamNumericId =
        data.primaryTeamId
          ? Number(
              data.primaryTeamId
            )
          : null

      const wantsMedia =
        String(
          data.mediaSupport || ''
        ) === '1'

      let primaryTeam = null

      if (primaryTeamNumericId) {
        const primaryTeams = await sql`
          SELECT
            id,
            code,
            name
          FROM teams
          WHERE id =
            ${primaryTeamNumericId}
            AND active = 1
          LIMIT 1
        `

        primaryTeam =
          primaryTeams[0]

        if (
          !primaryTeam ||
          primaryTeam.code === 'media'
        ) {
          return response.status(400).json({
            error:
              'Equipe principal inválida.',
          })
        }
      }

      const mediaTeams = await sql`
        SELECT id
        FROM teams
        WHERE code = 'media'
          AND active = 1
        LIMIT 1
      `

      const mediaTeamId =
        mediaTeams[0]?.id

      if (
        wantsMedia &&
        !mediaTeamId
      ) {
        return response.status(500).json({
          error:
            'Equipe de Mídias não configurada.',
        })
      }

      if (
        ![
          'admin',
          'project_admin',
        ].includes(userType) &&
        !primaryTeam &&
        !wantsMedia
      ) {
        return response.status(400).json({
          error:
            'Escolha uma equipe principal ou habilite Mídias.',
        })
      }

      const normalizedTeamIds = []

      if (primaryTeam) {
        normalizedTeamIds.push(
          Number(primaryTeam.id)
        )
      }

      if (wantsMedia) {
        normalizedTeamIds.push(
          Number(mediaTeamId)
        )
      }

      // =================================================
      // PROJECT / GLOBAL ADMIN
      // =================================================
      // Admin de Projeto e Admin Geral não ficam presos
      // a uma equipe. O escopo administrativo deles vem
      // exclusivamente de admin_scope.
      // =================================================

      if (
        userType === 'project_admin' ||
        userType === 'admin'
      ) {
        normalizedTeamIds.length = 0
      }

      const fullName =
        String(
          data.fullName ||
          data.name ||
          ''
        )
          .trim()
          .replace(/\s+/g, ' ')

      const username =
        String(
          data.username || ''
        )
          .trim()
          .replace(/^@+/, '')
          .toLowerCase()

      if (
        !fullName ||
        !username ||
        !Number.isInteger(projectId) ||
        ![
          'volunteer',
          'team_admin',
          'project_admin',
          'admin',
        ].includes(userType)
      ) {
        return response.status(400).json({
          error: 'Dados do usuário inválidos.',
        })
      }

      if (
        !/^[a-z0-9._]+$/.test(username)
      ) {
        return response.status(400).json({
          error:
            'O @usuário deve usar apenas letras, números, ponto ou underline.',
        })
      }

      if (
        !adminCanAccessProject(
          admin,
          projectId
        )
      ) {
        return forbidden(response)
      }

      // Apenas Admin Geral pode conceder Admin Geral
      // ou Admin de Projeto.
      if (
        (
          userType === 'admin' ||
          userType === 'project_admin'
        ) &&
        !isGlobalAdmin(admin)
      ) {
        return forbidden(response)
      }

      // Admin de equipe não promove outros admins.
      if (
        isTeamAdmin(admin) &&
        userType !== 'volunteer'
      ) {
        return forbidden(response)
      }

      const duplicateUsername =
        await sql`
          SELECT id
          FROM users
          WHERE
            LOWER(username) =
              LOWER(${username})
            AND id != ${recordId}
          LIMIT 1
        `

      if (duplicateUsername[0]) {
        return response.status(409).json({
          error:
            'Este @usuário já está em uso.',
        })
      }

      if (
        recordId === Number(admin.id) &&
        admin.adminScope === 'global' &&
        userType !== 'admin'
      ) {
        return response.status(400).json({
          error:
            'Você não pode remover seu próprio acesso administrativo.',
        })
      }

      const birthDate =
        data.birthDate || null

      const allergies =
        data.allergies?.trim() || null

      const updated = await sql`
        UPDATE users
        SET
          name = ${fullName},
          full_name = ${fullName},
          username = ${username},
          email = ${email || null},
          project_id = ${projectId},
          user_type = ${
            userType === 'admin' ||
            userType === 'project_admin' ||
            userType === 'team_admin'
              ? 'admin'
              : 'volunteer'
          },
          birth_date = ${birthDate},
          allergies = ${allergies}
        WHERE id = ${recordId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Usuário não encontrado.',
        })
      }

      // -----------------------------------------------
      // DREAMER ACCESS
      // -----------------------------------------------
      //
      // Sócio Sonhador é uma condição separada.
      // Não deve ser ativado automaticamente ao editar
      // um voluntário/admin.
      //
      // -----------------------------------------------
      // VOLUNTEER ACCESS
      // -----------------------------------------------

      await sql`
        INSERT INTO user_permissions (
          user_id,
          permission,
          admin_scope,
          active
        )
        VALUES (
          ${recordId},
          'volunteer',
          NULL,
          1
        )
        ON CONFLICT (
          user_id,
          permission
        )
        DO UPDATE SET active = 1
      `

      // -----------------------------------------------
      // ADMIN ACCESS
      // -----------------------------------------------

      if (
        userType === 'admin' ||
        userType === 'project_admin' ||
        userType === 'team_admin'
      ) {
        await sql`
          INSERT INTO user_permissions (
            user_id,
            permission,
            admin_scope,
            active
          )
          VALUES (
            ${recordId},
            'admin',
            ${
              userType === 'admin'
                ? 'global'
                : userType ===
                  'project_admin'
                  ? 'project'
                  : 'team'
            },
            1
          )
          ON CONFLICT (
            user_id,
            permission
          )
          DO UPDATE SET
            admin_scope =
              EXCLUDED.admin_scope,
            active = 1
        `
      } else {
        await sql`
          UPDATE user_permissions
          SET
            active = 0,
            admin_scope = NULL
          WHERE
            user_id = ${recordId}
            AND permission = 'admin'
        `
      }

      // -----------------------------------------------
      // USER TEAMS
      // -----------------------------------------------

      await sql`
        UPDATE user_teams
        SET active = 0
        WHERE user_id = ${recordId}
      `

      for (
        const teamId
        of normalizedTeamIds
      ) {
        await sql`
          INSERT INTO user_teams (
            user_id,
            team_id,
            active
          )
          VALUES (
            ${recordId},
            ${teamId},
            1
          )
          ON CONFLICT (
            user_id,
            team_id
          )
          DO UPDATE SET
            active = 1
        `
      }

      return response.status(200).json({
        success: true,
        message: 'Usuário atualizado! ✅',
      })
    }

    if (action === 'toggle-event') {
      // -------------------------------------------------
      // EVENT ACCESS
      // -------------------------------------------------
      // Valida o evento com as permissões administrativas
      // atuais antes de permitir ativar/desativar.
      const event = await sql`
        SELECT
          id,
          project_id,
          active
        FROM events
        WHERE id = ${recordId}
        LIMIT 1
      `

      if (!event[0]) {
        return response.status(404).json({
          error: 'Evento não encontrado.',
        })
      }

      const canAccess =
        await adminCanAccessEvent(
          admin,
          recordId
        )

      if (!canAccess) {
        return forbidden(response)
      }

      // -------------------------------------------------
      // TOGGLE
      // -------------------------------------------------
      const updated = await sql`
        UPDATE events
        SET active =
          CASE
            WHEN active = 1 THEN 0
            ELSE 1
          END
        WHERE id = ${recordId}
        RETURNING active
      `

      return response.status(200).json({
        success: true,
        message:
          Number(updated[0].active) === 1
            ? 'Evento ativado! 📅'
            : 'Evento desativado.',
      })
    }

    if (action === 'update-event') {
      const name = cleanText(data.name)
      const eventType = data.eventType
      const eventDate = data.eventDate
      const eventTime = data.eventTime
      const location = cleanText(data.location)
      const confirmationDeadline =
        data.confirmationDeadline

      const rawProjectId = data.projectId
      const projectId =
        rawProjectId === '' ||
        rawProjectId === null ||
        rawProjectId === undefined
          ? null
          : Number(rawProjectId)

      const driveLink =
        cleanText(data.driveLink)

      if (
        !name ||
        !eventDate ||
        !eventTime ||
        !location ||
        !confirmationDeadline ||
        !['specific', 'general'].includes(
          eventType
        ) ||
        (
          projectId !== null &&
          !Number.isInteger(projectId)
        )
      ) {
        return response.status(400).json({
          error: 'Dados do evento inválidos.',
        })
      }

      // Evento geral da ONG é exclusivo do Admin Geral.
      if (
        projectId === null &&
        !isGlobalAdmin(admin)
      ) {
        return forbidden(response)
      }

      // Admin de Projeto/Equipe só pode apontar
      // o evento para um projeto permitido.
      if (
        projectId !== null &&
        !adminCanAccessProject(
          admin,
          projectId
        )
      ) {
        return forbidden(response)
      }

      const updated = await sql`
        UPDATE events
        SET
          name = ${name},
          project_id = ${projectId},
          event_type = ${eventType},
          event_date = ${eventDate},
          event_time = ${eventTime},
          location = ${location},
          confirmation_deadline =
            ${confirmationDeadline},
          drive_link = ${driveLink || null}
        WHERE id = ${recordId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Evento não encontrado.',
        })
      }

      return response.status(200).json({
        success: true,
        message: 'Evento atualizado! 📅',
      })
    }

    // ---------------------------------
    // ACTIVITY
    // ---------------------------------

    if (action === 'toggle-activity') {
      const updated = await sql`
        UPDATE event_roles
        SET active =
          CASE
            WHEN active = 1 THEN 0
            ELSE 1
          END
        WHERE id = ${recordId}
        RETURNING active
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Atividade não encontrada.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          Number(updated[0].active) === 1
            ? 'Atividade reaberta! 🙋'
            : 'Atividade fechada.',
      })
    }

    if (action === 'update-activity') {
      const description =
        cleanText(data.description)

      const vacancyLimit =
        Number(data.vacancyLimit)

      const requiresDelivery =
        Number(data.requiresDelivery) === 1
          ? 1
          : 0

      const deliveryDeadline =
        requiresDelivery === 1 &&
        data.deliveryDeadline
          ? data.deliveryDeadline
          : null

      const teamId =
        data.teamId
          ? Number(data.teamId)
          : null

      const communityVisible =
        data.communityVisible === true ||
        data.communityVisible === 'true' ||
        data.communityVisible === 1 ||
        data.communityVisible === '1'


      if (
        !Number.isInteger(vacancyLimit) ||
        vacancyLimit < 1
      ) {
        return response.status(400).json({
          error:
            'A quantidade de vagas é inválida.',
        })
      }

      const activityRows = await sql`
        SELECT
          e.project_id
        FROM event_roles er
        JOIN events e
          ON e.id = er.event_id
        WHERE er.id = ${recordId}
        LIMIT 1
      `

      const activityProjectId =
        activityRows[0]?.project_id ?? null

      const canUseScope =
        await adminCanUseContentScope(
          admin,
          activityProjectId,
          teamId
        )

      if (!canUseScope) {
        return forbidden(response)
      }

      let communityEnabled = 0

      if (communityVisible) {
        const canPublishCommunity =
          isGlobalAdmin(admin) ||
          isMediaAdmin(admin)

        if (!canPublishCommunity) {
          return response.status(403).json({
            error:
              'Somente Admin de Mídias ou Admin Geral pode publicar atividades na Comunidade.',
          })
        }

        if (!teamId) {
          return response.status(400).json({
            error:
              'A atividade comunitária precisa pertencer à equipe de Mídias.',
          })
        }

        const teamRows = await sql`
          SELECT code
          FROM teams
          WHERE id = ${teamId}
          LIMIT 1
        `

        const teamCode =
          String(teamRows[0]?.code || '')
            .trim()
            .toLowerCase()

        if (teamCode !== 'media') {
          return response.status(400).json({
            error:
              'Somente atividades da equipe de Mídias podem ser publicadas na Comunidade.',
          })
        }

        communityEnabled = 1
      }

      const confirmed = await sql`
        SELECT COUNT(*)::int AS total
        FROM confirmations
        WHERE event_role_id = ${recordId}
          AND status = 'confirmed'
      `

      if (
        vacancyLimit <
        Number(confirmed[0]?.total || 0)
      ) {
        return response.status(400).json({
          error:
            'As vagas não podem ficar abaixo do número de confirmados.',
        })
      }

      const updated = await sql`
        UPDATE event_roles
        SET
          description =
            ${description || null},
          vacancy_limit =
            ${vacancyLimit},
          requires_delivery =
            ${requiresDelivery},
          delivery_deadline =
            ${deliveryDeadline},
          team_id =
            ${teamId},
          community_visible =
            ${communityEnabled}
        WHERE id = ${recordId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Atividade não encontrada.',
        })
      }

      return response.status(200).json({
        success: true,
        message: 'Atividade atualizada! 🙋',
      })
    }

    // =====================================================
    // ACTIVITY PARTICIPANT WORKFLOW
    // =====================================================
    // Permite ao Admin marcar individualmente a participação
    // de um voluntário em uma atividade como concluída.
    // Se já estiver concluída, a ação desfaz a conclusão.
    // =====================================================

    if (action === 'toggle-activity-participant') {
      const activityData = await sql`
        SELECT
          c.id,
          c.photo_submitted_at,
          er.requires_delivery
        FROM confirmations c
        JOIN event_roles er
          ON c.event_role_id = er.id
        WHERE c.id = ${recordId}
          AND c.status = 'confirmed'
        LIMIT 1
      `

      const activityParticipation =
        activityData[0]

      if (!activityParticipation) {
        return response.status(404).json({
          error:
            'Participação na atividade não encontrada.',
        })
      }

      if (
        Number(
          activityParticipation.requires_delivery
        ) === 1 &&
        !activityParticipation.photo_submitted_at
      ) {
        return response.status(400).json({
          error:
            'Essa atividade exige entrega antes da finalização.',
        })
      }

      const confirmations = await sql`
        UPDATE confirmations
        SET completed_at =
          CASE
            WHEN completed_at IS NULL
              THEN CURRENT_TIMESTAMP
            ELSE NULL
          END
        WHERE id = ${recordId}
          AND status = 'confirmed'
        RETURNING id, completed_at
      `

      if (!confirmations[0]) {
        return response.status(404).json({
          error:
            'Participação na atividade não encontrada.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          confirmations[0].completed_at
            ? 'Participação concluída! ✅'
            : 'Conclusão removida.',
      })
    }

    // ---------------------------------
    // TASK
    // ---------------------------------

    if (action === 'toggle-announcement') {
      if (!isGlobalAdmin(admin)) {
        return forbidden(response)
      }

      const updated = await sql`
        UPDATE announcements
        SET active =
          CASE
            WHEN active = 1 THEN 0
            ELSE 1
          END
        WHERE id = ${recordId}
        RETURNING active
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Comunicado não encontrado.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          Number(updated[0].active) === 1
            ? 'Comunicado reativado! 📢'
            : 'Comunicado arquivado.',
      })
    }

    if (action === 'update-announcement') {
      const title = cleanText(data.title)
      const message =
        cleanText(data.message)
      const priority = data.priority

      const projectId =
        data.projectId
          ? Number(data.projectId)
          : null

      const teamId =
        data.teamId
          ? Number(data.teamId)
          : null

      if (
        !title ||
        !message ||
        !['normal', 'important', 'urgent']
          .includes(priority)
      ) {
        return response.status(400).json({
          error:
            'Dados do comunicado inválidos.',
        })
      }

      const canUseScope =
        await adminCanUseContentScope(
          admin,
          projectId,
          teamId
        )

      if (!canUseScope) {
        return forbidden(response)
      }

      const updated = await sql`
        UPDATE announcements
        SET
          title = ${title},
          message = ${message},
          priority = ${priority},
          project_id = ${projectId},
          team_id = ${teamId}
        WHERE id = ${recordId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Comunicado não encontrado.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          'Comunicado atualizado! 📢',
      })
    }

    // ---------------------------------
    // COMMUNITY — IDENTIDADE DO MÊS
    // ---------------------------------

    if (
      action ===
      'update-monthly-community'
    ) {
      if (
        !isGlobalAdmin(admin) &&
        !isMediaAdmin(admin)
      ) {
        return forbidden(response)
      }

      const word =
        cleanText(data.word)

      const message =
        cleanText(data.message)

      if (!word) {
        return response.status(400).json({
          error:
            'Informe a palavra do mês.',
        })
      }

      if (word.length > 120) {
        return response.status(400).json({
          error:
            'A palavra do mês é muito longa.',
        })
      }

      const updated = await sql`
        INSERT INTO
          community_monthly_settings (
            year,
            month,
            word,
            message,
            updated_by,
            updated_at
          )
        VALUES (
          EXTRACT(
            YEAR FROM CURRENT_DATE
          ),
          EXTRACT(
            MONTH FROM CURRENT_DATE
          ),
          ${word},
          ${message || null},
          ${admin.id},
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (year, month)
        DO UPDATE SET
          word =
            EXCLUDED.word,
          message =
            EXCLUDED.message,
          updated_by =
            EXCLUDED.updated_by,
          updated_at =
            CURRENT_TIMESTAMP

        RETURNING
          id,
          year,
          month,
          word,
          message,
          updated_at
      `

      return response.status(200).json({
        success: true,
        message:
          'Identidade do mês atualizada! ✨',
        monthlyCommunity:
          updated[0],
      })
    }

    return response.status(400).json({
      error:
        'Ação administrativa desconhecida.',
    })
  } catch (error) {
    console.error(
      'Admin update error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível concluir essa alteração.',
    })
  }
}
