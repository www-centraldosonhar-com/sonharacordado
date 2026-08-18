import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { requireAdmin, sql } from './_admin.js'

const scryptAsync = promisify(crypto.scrypt)

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(8).toString('hex')

  const n = 32768
  const r = 8
  const p = 1

  const key = await scryptAsync(
    password,
    salt,
    64,
    {
      N: n,
      r,
      p,
      maxmem: 132 * n * r * p,
    }
  )

  return (
    `scrypt:${n}:${r}:${p}` +
    `$${salt}` +
    `$${key.toString('hex')}`
  )
}

function cleanText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
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
      const name = cleanText(data.name)
      const email = cleanText(data.email)
      const projectId = Number(data.projectId)
      const userType = data.userType

      if (
        !name ||
        !Number.isInteger(projectId) ||
        !['volunteer', 'admin'].includes(userType)
      ) {
        return response.status(400).json({
          error: 'Dados do usuário inválidos.',
        })
      }

      if (/\s/.test(name)) {
        return response.status(400).json({
          error:
            'O usuário não pode conter espaços.',
        })
      }

      const duplicate = await sql`
        SELECT id
        FROM users
        WHERE LOWER(name) = LOWER(${name})
          AND project_id = ${projectId}
          AND id != ${recordId}
        LIMIT 1
      `

      if (duplicate[0]) {
        return response.status(409).json({
          error:
            'Já existe esse usuário nesse projeto.',
        })
      }

      if (
        recordId === Number(admin.id) &&
        userType !== 'admin'
      ) {
        return response.status(400).json({
          error:
            'Você não pode remover seu próprio acesso administrativo.',
        })
      }

      const updated = await sql`
        UPDATE users
        SET
          name = ${name},
          email = ${email || null},
          project_id = ${projectId},
          user_type = ${userType}
        WHERE id = ${recordId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Usuário não encontrado.',
        })
      }

      return response.status(200).json({
        success: true,
        message: 'Usuário atualizado! ✅',
      })
    }

    if (action === 'reset-password') {
      const password = data.password

      if (
        typeof password !== 'string' ||
        password.length < 4
      ) {
        return response.status(400).json({
          error:
            'A senha precisa ter pelo menos 4 caracteres.',
        })
      }

      const passwordHash =
        await createPasswordHash(password)

      const updated = await sql`
        UPDATE users
        SET password_hash = ${passwordHash}
        WHERE id = ${recordId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Usuário não encontrado.',
        })
      }

      return response.status(200).json({
        success: true,
        message: 'Senha redefinida! 🔑',
      })
    }

    // ---------------------------------
    // EVENT
    // ---------------------------------

    if (action === 'toggle-event') {
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

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Evento não encontrado.',
        })
      }

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

      const symplaLink =
        cleanText(data.symplaLink)

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
          sympla_link = ${symplaLink || null},
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

      if (
        !Number.isInteger(vacancyLimit) ||
        vacancyLimit < 1
      ) {
        return response.status(400).json({
          error:
            'A quantidade de vagas é inválida.',
        })
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
            ${deliveryDeadline}
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

    if (action === 'toggle-task') {
      const updated = await sql`
        UPDATE tasks
        SET status =
          CASE
            WHEN status = 'completed'
              THEN 'open'
            ELSE 'completed'
          END
        WHERE id = ${recordId}
        RETURNING status
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Missão não encontrada.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          updated[0].status === 'completed'
            ? 'Missão concluída! 🎯'
            : 'Missão reaberta! 🚀',
      })
    }

    if (action === 'update-task') {
      const title = cleanText(data.title)
      const description =
        cleanText(data.description)

      const deadline = data.deadline
      const priority = data.priority

      const volunteerLimit =
        Number(data.volunteerLimit)

      const rawEventId = data.eventId
      const eventId =
        rawEventId === '' ||
        rawEventId === null ||
        rawEventId === undefined
          ? null
          : Number(rawEventId)

      if (
        !title ||
        !deadline ||
        !['normal', 'important', 'urgent']
          .includes(priority) ||
        !Number.isInteger(volunteerLimit) ||
        volunteerLimit < 1 ||
        (
          eventId !== null &&
          !Number.isInteger(eventId)
        )
      ) {
        return response.status(400).json({
          error: 'Dados da missão inválidos.',
        })
      }

      const participants = await sql`
        SELECT COUNT(*)::int AS total
        FROM task_users
        WHERE task_id = ${recordId}
          AND status = 'active'
      `

      if (
        volunteerLimit <
        Number(participants[0]?.total || 0)
      ) {
        return response.status(400).json({
          error:
            'O limite não pode ficar abaixo do número de participantes.',
        })
      }

      const updated = await sql`
        UPDATE tasks
        SET
          title = ${title},
          description =
            ${description || null},
          event_id = ${eventId},
          deadline = ${deadline},
          priority = ${priority},
          volunteer_limit =
            ${volunteerLimit}
        WHERE id = ${recordId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error: 'Missão não encontrada.',
        })
      }

      return response.status(200).json({
        success: true,
        message: 'Missão atualizada! 🚀',
      })
    }

    // =====================================================
    // MISSION PARTICIPANT WORKFLOW
    // =====================================================
    // Permite ao Admin finalizar individualmente a
    // participação de um voluntário em uma missão.
    // Isso não conclui a missão inteira.
    // =====================================================

    if (action === 'toggle-task-participant') {
      const taskData = await sql`
        SELECT
          id,
          submitted_at
        FROM task_users
        WHERE id = ${recordId}
          AND status = 'active'
        LIMIT 1
      `

      const taskParticipation =
        taskData[0]

      if (!taskParticipation) {
        return response.status(404).json({
          error:
            'Participação na missão não encontrada.',
        })
      }

      if (!taskParticipation.submitted_at) {
        return response.status(400).json({
          error:
            'A missão ainda não possui uma entrega para aprovar.',
        })
      }

      const participations = await sql`
        UPDATE task_users
        SET completed_at =
          CASE
            WHEN completed_at IS NULL
              THEN CURRENT_TIMESTAMP
            ELSE NULL
          END
        WHERE id = ${recordId}
          AND status = 'active'
        RETURNING id, completed_at
      `

      if (!participations[0]) {
        return response.status(404).json({
          error:
            'Participação na missão não encontrada.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          participations[0].completed_at
            ? 'Participação na missão concluída! ✅'
            : 'Conclusão da missão removida.',
      })
    }

    // ---------------------------------
    // ANNOUNCEMENT
    // ---------------------------------

    if (action === 'toggle-announcement') {
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

      const updated = await sql`
        UPDATE announcements
        SET
          title = ${title},
          message = ${message},
          priority = ${priority}
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
