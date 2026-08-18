import crypto from 'node:crypto'
import { promisify } from 'node:util'
import {
  adminCanAccessEvent,
  adminCanAccessProject,
  isGlobalAdmin,
  isMediaAdmin,
  isProjectAdmin,
  isTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'

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

function forbidden(response) {
  return response.status(403).json({
    error:
      'Você não possui permissão para essa operação.',
  })
}

function canCreateUserType(
  admin,
  userType
) {
  if (isGlobalAdmin(admin)) {
    return true
  }

  if (isProjectAdmin(admin)) {
    return [
      'volunteer',
      'team_admin',
    ].includes(userType)
  }

  if (isTeamAdmin(admin)) {
    return (
      userType === 'volunteer'
    )
  }

  return false
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
      if (!isGlobalAdmin(admin)) {
        return forbidden(response)
      }

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

    if (action === 'coupon') {
      if (!isGlobalAdmin(admin)) {
        return forbidden(response)
      }

      const code =
        typeof data.code === 'string'
          ? data.code
              .trim()
              .toUpperCase()
          : ''

      const usageLimit =
        Number(data.usageLimit)

      if (
        !code ||
        !Number.isInteger(usageLimit) ||
        usageLimit < 1
      ) {
        return response.status(400).json({
          error:
            'Preencha corretamente o cupom.',
        })
      }

      const existing = await sql`
        SELECT id
        FROM registration_coupons
        WHERE UPPER(code) = ${code}
        LIMIT 1
      `

      if (existing[0]) {
        return response.status(409).json({
          error:
            'Esse cupom já existe.',
        })
      }

      await sql`
        INSERT INTO registration_coupons (
          code,
          usage_limit,
          active
        )
        VALUES (
          ${code},
          ${usageLimit},
          1
        )
      `

      return response.status(201).json({
        success: true,
        message:
          'Cupom criado! 🎟️',
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
        registrationFee,
        registrationDeadline,
        driveLink,
      } = data

      if (
        !name?.trim() ||
        !eventDate ||
        !eventTime ||
        !location?.trim() ||
        !confirmationDeadline ||
        !registrationDeadline ||
        Number.isNaN(
          Number(registrationFee)
        ) ||
        Number(registrationFee) < 0
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

      const targetProjectId =
        projectId
          ? Number(projectId)
          : null

      // Evento geral da ONG é exclusivo do Admin Geral.
      if (
        targetProjectId === null &&
        !isGlobalAdmin(admin)
      ) {
        return forbidden(response)
      }

      if (
        targetProjectId !== null &&
        !adminCanAccessProject(
          admin,
          targetProjectId
        )
      ) {
        return forbidden(response)
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
          registration_fee,
          registration_deadline,
          registrations_open,
          drive_link,
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
          ${Number(registrationFee)},
          ${registrationDeadline},
          1,
          ${driveLink?.trim() || null},
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
        requiresDelivery,
        deliveryDeadline,
      } = data

      const limit = Number(vacancyLimit)

      const deliveryRequired =
        Number(requiresDelivery) === 1
          ? 1
          : 0

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

      const canAccessEvent =
        await adminCanAccessEvent(
          admin,
          eventId
        )

      if (!canAccessEvent) {
        return forbidden(response)
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
          active,
          requires_delivery,
          delivery_deadline
        )
        VALUES (
          ${eventId},
          ${roleId},
          ${description?.trim() || null},
          ${limit},
          1,
          ${deliveryRequired},
          ${
            deliveryRequired === 1 &&
            deliveryDeadline
              ? deliveryDeadline
              : null
          }
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

      if (eventId) {
        const canAccessEvent =
          await adminCanAccessEvent(
            admin,
            eventId
          )

        if (!canAccessEvent) {
          return forbidden(response)
        }
      } else if (
        !isGlobalAdmin(admin)
      ) {
        return forbidden(response)
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
        primaryTeamId,
        mediaSupport,
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
        ![
          'volunteer',
          'team_admin',
          'project_admin',
          'admin',
        ].includes(userType)
      ) {
        return response.status(400).json({
          error: 'Tipo de usuário inválido.',
        })
      }

      if (
        !canCreateUserType(
          admin,
          userType
        )
      ) {
        return forbidden(response)
      }

      if (
        !adminCanAccessProject(
          admin,
          projectId
        )
      ) {
        return forbidden(response)
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

      const createdUsers = await sql`
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
          ${
            userType === 'admin' ||
            userType === 'project_admin' ||
            userType === 'team_admin'
              ? 'admin'
              : 'volunteer'
          },
          1
        )
        RETURNING id
      `

      const createdUserId =
        createdUsers[0].id

      // Todos possuem acesso ao Sócio Sonhador.
      await sql`
        INSERT INTO user_permissions (
          user_id,
          permission,
          admin_scope,
          active
        )
        VALUES (
          ${createdUserId},
          'dreamer',
          NULL,
          1
        )
        ON CONFLICT (
          user_id,
          permission
        )
        DO NOTHING
      `

      // Usuários criados pelo Admin são voluntários.
      await sql`
        INSERT INTO user_permissions (
          user_id,
          permission,
          admin_scope,
          active
        )
        VALUES (
          ${createdUserId},
          'volunteer',
          NULL,
          1
        )
        ON CONFLICT (
          user_id,
          permission
        )
        DO NOTHING
      `

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
            ${createdUserId},
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
      }

      // =================================================
      // TEAM RULE
      // =================================================
      // Uma pessoa pode ter:
      // - 1 equipe principal;
      // - Mídias adicional;
      // - somente Mídias.
      //
      // Nunca duas equipes principais.
      // =================================================

      const primaryTeamNumericId =
        primaryTeamId
          ? Number(primaryTeamId)
          : null

      const wantsMedia =
        String(mediaSupport || '') === '1'

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

      if (
        isTeamAdmin(admin) &&
        !isMediaAdmin(admin)
      ) {
        const allowedTeamIds =
          (
            admin.teams || []
          ).map(
            (team) =>
              Number(team.id)
          )

        const invalidTeam =
          normalizedTeamIds.some(
            (teamId) =>
              !allowedTeamIds.includes(
                Number(teamId)
              )
          )

        if (invalidTeam) {
          return forbidden(response)
        }
      }

      if (
        isTeamAdmin(admin) &&
        isMediaAdmin(admin)
      ) {
        const onlyMedia =
          normalizedTeamIds.every(
            (teamId) =>
              Number(teamId) ===
              Number(mediaTeamId)
          )

        if (!onlyMedia) {
          return forbidden(response)
        }
      }

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
            ${createdUserId},
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
