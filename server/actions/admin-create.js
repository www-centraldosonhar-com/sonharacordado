import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { requireAdmin, sql } from './_admin.js'

const scryptAsync = promisify(crypto.scrypt)

async function createWerkzeugHash(password) {
  const salt = crypto
    .randomBytes(8)
    .toString('hex')

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

  return `scrypt:${n}:${r}:${p}$${salt}$${key.toString('hex')}`
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const admin = await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error: 'Acesso administrativo não autorizado.',
    })
  }

  const {
    action,
    data,
  } = request.body ?? {}

  if (!action || !data) {
    return response.status(400).json({
      error: 'Dados inválidos.',
    })
  }

  try {
    if (action === 'announcement') {
      const title = data.title?.trim()
      const message = data.message?.trim()
      const priority = data.priority || 'normal'

      if (!title || !message) {
        return response.status(400).json({
          error: 'Informe título e mensagem.',
        })
      }

      if (
        !['normal', 'important', 'urgent']
          .includes(priority)
      ) {
        return response.status(400).json({
          error: 'Prioridade inválida.',
        })
      }

      await sql`
        INSERT INTO announcements (
          title,
          message,
          priority,
          created_by,
          active
        )
        VALUES (
          ${title},
          ${message},
          ${priority},
          ${admin.id},
          1
        )
      `

      return response.status(201).json({
        success: true,
        message: 'Comunicado publicado! 📢',
      })
    }

    if (action === 'event') {
      const {
        name,
        projectId,
        eventType,
        eventDate,
        eventTime,
        location,
        confirmationDeadline,
        symplaLink,
      } = data

      if (
        !name?.trim() ||
        !eventDate ||
        !eventTime ||
        !location?.trim() ||
        !confirmationDeadline
      ) {
        return response.status(400).json({
          error: 'Preencha os campos obrigatórios.',
        })
      }

      if (
        !['specific', 'general']
          .includes(eventType)
      ) {
        return response.status(400).json({
          error: 'Tipo de evento inválido.',
        })
      }

      await sql`
        INSERT INTO events (
          name,
          project_id,
          event_type,
          event_date,
          event_time,
          location,
          confirmation_deadline,
          sympla_link,
          active
        )
        VALUES (
          ${name.trim()},
          ${projectId || null},
          ${eventType},
          ${eventDate},
          ${eventTime},
          ${location.trim()},
          ${confirmationDeadline},
          ${symplaLink?.trim() || null},
          1
        )
      `

      return response.status(201).json({
        success: true,
        message: 'Evento criado! 📅',
      })
    }

    if (action === 'activity') {
      const {
        eventId,
        roleId,
        description,
        vacancyLimit,
      } = data

      const limit = Number(vacancyLimit)

      if (
        !eventId ||
        !roleId ||
        !Number.isInteger(limit) ||
        limit < 1
      ) {
        return response.status(400).json({
          error: 'Preencha corretamente a atividade.',
        })
      }

      const existing = await sql`
        SELECT id
        FROM event_roles
        WHERE event_id = ${eventId}
          AND role_id = ${roleId}
        LIMIT 1
      `

      if (existing[0]) {
        return response.status(409).json({
          error:
            'Essa atividade já existe nesse evento.',
        })
      }

      await sql`
        INSERT INTO event_roles (
          event_id,
          role_id,
          description,
          vacancy_limit,
          active
        )
        VALUES (
          ${eventId},
          ${roleId},
          ${description?.trim() || null},
          ${limit},
          1
        )
      `

      return response.status(201).json({
        success: true,
        message: 'Atividade aberta! 🙋',
      })
    }

    if (action === 'task') {
      const {
        title,
        description,
        eventId,
        deadline,
        priority,
        volunteerLimit,
      } = data

      const limit = Number(volunteerLimit)

      if (
        !title?.trim() ||
        !deadline ||
        !Number.isInteger(limit) ||
        limit < 1
      ) {
        return response.status(400).json({
          error: 'Preencha corretamente a missão.',
        })
      }

      if (
        !['normal', 'important', 'urgent']
          .includes(priority)
      ) {
        return response.status(400).json({
          error: 'Prioridade inválida.',
        })
      }

      await sql`
        INSERT INTO tasks (
          title,
          description,
          event_id,
          deadline,
          priority,
          status,
          volunteer_limit,
          active
        )
        VALUES (
          ${title.trim()},
          ${description?.trim() || null},
          ${eventId || null},
          ${deadline},
          ${priority},
          'open',
          ${limit},
          1
        )
      `

      return response.status(201).json({
        success: true,
        message: 'Missão criada! 🚀',
      })
    }

    if (action === 'user') {
      const {
        name,
        projectId,
        email,
        userType,
        password,
      } = data

      if (
        !name?.trim() ||
        !projectId ||
        !password ||
        password.length < 4
      ) {
        return response.status(400).json({
          error:
            'Informe usuário, projeto e senha com no mínimo 4 caracteres.',
        })
      }

      if (/\s/.test(name.trim())) {
        return response.status(400).json({
          error: 'O usuário não pode conter espaços.',
        })
      }

      if (
        !['volunteer', 'admin']
          .includes(userType)
      ) {
        return response.status(400).json({
          error: 'Tipo de usuário inválido.',
        })
      }

      const existing = await sql`
        SELECT id
        FROM users
        WHERE LOWER(name) = LOWER(${name.trim()})
          AND project_id = ${projectId}
        LIMIT 1
      `

      if (existing[0]) {
        return response.status(409).json({
          error:
            'Já existe esse usuário nesse projeto.',
        })
      }

      const passwordHash =
        await createWerkzeugHash(password)

      await sql`
        INSERT INTO users (
          name,
          project_id,
          email,
          password_hash,
          user_type,
          active
        )
        VALUES (
          ${name.trim()},
          ${projectId},
          ${email?.trim() || null},
          ${passwordHash},
          ${userType},
          1
        )
      `

      return response.status(201).json({
        success: true,
        message: 'Usuário cadastrado! 👤',
      })
    }

    return response.status(400).json({
      error: 'Ação administrativa inválida.',
    })
  } catch (error) {
    console.error('Admin create error:', error)

    return response.status(500).json({
      error:
        'Não foi possível concluir essa operação.',
    })
  }
}
