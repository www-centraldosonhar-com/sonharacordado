import { neon } from '@neondatabase/serverless'

import {
  requireDreamerUser,
} from './_dreamer-access.js'

import {
  getOlympiadCampaign,
} from './_dreamer-frequency.js'

const sql = neon(process.env.DATABASE_URL)

function cleanText(value, maxLength = 255) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function cleanBoolean(value) {
  return value === true || value === 1 || value === '1'
}

function normalizeProjectId(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const number = Number(value)

  return Number.isInteger(number) && number > 0
    ? number
    : Number.NaN
}

function cleanDate(value) {
  const text = cleanText(value, 10)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null
  }

  return text
}

async function getProjects() {
  return sql`
    SELECT id, name
    FROM projects
    WHERE UPPER(name) IN ('APS', 'PPF', 'SJ')
    ORDER BY id
  `
}

async function getHistoricalEvents(campaignId) {
  const events = await sql`
    SELECT
      historical.id,
      historical.campaign_id,
      historical.project_id,
      project.name AS project,
      historical.name,
      historical.event_date,
      historical.attendance_enabled,
      historical.economy_enabled,
      historical.validated,
      historical.validated_by,
      historical.validated_at,
      historical.created_by,
      historical.created_at,
      historical.updated_at
    FROM dreamer_historical_events historical
    LEFT JOIN projects project
      ON project.id = historical.project_id
    WHERE historical.campaign_id = ${campaignId}
    ORDER BY
      historical.event_date DESC,
      historical.id DESC
  `

  if (!events.length) {
    return []
  }

  const eventIds = events.map(
    event => Number(event.id)
  )

  const projectRows = await sql`
    SELECT
      historical_project.id,
      historical_project.historical_event_id,
      historical_project.project_id,
      project.name AS project,
      historical_project.volunteer_base,
      historical_project.collected_amount,
      historical_project.expenses_amount
    FROM dreamer_historical_event_projects
      historical_project
    INNER JOIN projects project
      ON project.id = historical_project.project_id
    WHERE historical_project.historical_event_id =
      ANY(${eventIds}::bigint[])
    ORDER BY
      historical_project.historical_event_id,
      historical_project.project_id
  `

  const attendanceRows = await sql`
    SELECT
      attendance.id,
      attendance.historical_event_id,
      attendance.project_id,
      attendance.user_id,
      attendance.volunteer_name
    FROM dreamer_historical_attendance attendance
    WHERE attendance.historical_event_id =
      ANY(${eventIds}::bigint[])
    ORDER BY
      attendance.historical_event_id,
      attendance.project_id,
      attendance.volunteer_name,
      attendance.id
  `

  const attendanceMap = new Map()

  for (const row of attendanceRows) {
    const key =
      `${row.historical_event_id}:${row.project_id}`

    if (!attendanceMap.has(key)) {
      attendanceMap.set(key, [])
    }

    attendanceMap.get(key).push({
      id: Number(row.id),
      userId:
        row.user_id === null
          ? null
          : Number(row.user_id),
      volunteerName:
        row.volunteer_name,
    })
  }

  const projectsByEvent = new Map()

  for (const row of projectRows) {
    const eventId =
      Number(row.historical_event_id)

    const projectId =
      Number(row.project_id)

    const volunteerBase =
      Number(row.volunteer_base || 0)

    const attendance =
      attendanceMap.get(
        `${row.historical_event_id}:${row.project_id}`
      ) || []

    const presentCount =
      attendance.length

    const collectedAmount =
      row.collected_amount === null
        ? null
        : Number(row.collected_amount)

    const expensesAmount =
      row.expenses_amount === null
        ? null
        : Number(row.expenses_amount)

    const hasEconomy =
      collectedAmount !== null &&
      expensesAmount !== null

    const economyAmount =
      hasEconomy
        ? Math.max(
            0,
            collectedAmount - expensesAmount
          )
        : null

    const item = {
      id: Number(row.id),
      projectId,
      project: row.project,
      volunteerBase,
      attendance,
      presentCount,
      attendanceRate:
        volunteerBase > 0
          ? Number(
              (
                presentCount /
                volunteerBase *
                100
              ).toFixed(2)
            )
          : 0,
      collectedAmount,
      expensesAmount,
      economyAmount:
        economyAmount === null
          ? null
          : Number(economyAmount.toFixed(2)),
      economyPoints:
        economyAmount !== null &&
        volunteerBase > 0
          ? Number(
              (
                economyAmount /
                volunteerBase
              ).toFixed(2)
            )
          : null,
    }

    if (!projectsByEvent.has(eventId)) {
      projectsByEvent.set(eventId, [])
    }

    projectsByEvent.get(eventId).push(item)
  }

  return events.map(event => ({
    id: Number(event.id),
    campaignId: Number(event.campaign_id),
    projectId:
      event.project_id === null
        ? null
        : Number(event.project_id),
    project: event.project || null,
    name: event.name,
    eventDate: event.event_date,
    attendanceEnabled:
      Number(event.attendance_enabled) === 1,
    economyEnabled:
      Number(event.economy_enabled) === 1,
    validated:
      Number(event.validated) === 1,
    validatedBy:
      event.validated_by === null
        ? null
        : Number(event.validated_by),
    validatedAt: event.validated_at,
    createdBy:
      event.created_by === null
        ? null
        : Number(event.created_by),
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    projects:
      projectsByEvent.get(
        Number(event.id)
      ) || [],
  }))
}


async function getEditableHistoricalEvent(
  campaignId,
  historicalEventId
) {
  const id = Number(historicalEventId)

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return {
      error: 'Evento histórico inválido.',
      status: 400,
    }
  }

  const [event] = await sql`
    SELECT
      id,
      campaign_id,
      project_id,
      attendance_enabled,
      economy_enabled,
      validated
    FROM dreamer_historical_events
    WHERE id = ${id}
      AND campaign_id = ${campaignId}
    LIMIT 1
  `

  if (!event) {
    return {
      error: 'Evento histórico não encontrado.',
      status: 404,
    }
  }

  if (Number(event.validated) === 1) {
    return {
      error:
        'Este evento histórico já foi validado e não pode ser alterado.',
      status: 409,
    }
  }

  return {
    event: {
      id: Number(event.id),
      campaignId:
        Number(event.campaign_id),
      projectId:
        event.project_id === null
          ? null
          : Number(event.project_id),
      attendanceEnabled:
        Number(event.attendance_enabled) === 1,
      economyEnabled:
        Number(event.economy_enabled) === 1,
      validated:
        Number(event.validated) === 1,
    },
  }
}

async function getAllowedHistoricalProject(
  event,
  projectId
) {
  const normalized =
    normalizeProjectId(projectId)

  if (
    normalized === null ||
    Number.isNaN(normalized)
  ) {
    return {
      error: 'Projeto inválido.',
      status: 400,
    }
  }

  if (
    event.projectId !== null &&
    event.projectId !== normalized
  ) {
    return {
      error:
        'Este projeto não pertence ao evento histórico.',
      status: 400,
    }
  }

  const [project] = await sql`
    SELECT id, name
    FROM projects
    WHERE id = ${normalized}
      AND UPPER(name) IN (
        'APS',
        'PPF',
        'SJ'
      )
    LIMIT 1
  `

  if (!project) {
    return {
      error: 'Projeto inválido.',
      status: 400,
    }
  }

  return {
    project: {
      id: Number(project.id),
      name: project.name,
    },
  }
}

function parseMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const number = Number(value)

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return NaN
  }

  return Math.round(
    number * 100
  ) / 100
}

function normalizeAttendanceNames(value) {
  if (!Array.isArray(value)) {
    return null
  }

  const names = []
  const seen = new Set()

  for (const item of value) {
    const rawName =
      typeof item === 'string'
        ? item
        : item?.name

    const name =
      cleanText(rawName, 180)

    if (!name) continue

    const key =
      name
        .normalize('NFKC')
        .toLocaleLowerCase('pt-BR')

    if (seen.has(key)) continue

    seen.add(key)
    names.push(name)
  }

  return names
}

async function saveHistoricalProjectData(
  request,
  response,
  campaign
) {
  const editable =
    await getEditableHistoricalEvent(
      campaign.id,
      request.body?.historicalEventId
    )

  if (editable.error) {
    return response
      .status(editable.status)
      .json({
        error: editable.error,
      })
  }

  const allowed =
    await getAllowedHistoricalProject(
      editable.event,
      request.body?.projectId
    )

  if (allowed.error) {
    return response
      .status(allowed.status)
      .json({
        error: allowed.error,
      })
  }

  const volunteerBase =
    Number(request.body?.volunteerBase)

  if (
    !Number.isInteger(volunteerBase) ||
    volunteerBase <= 0
  ) {
    return response.status(400).json({
      error:
        'A base histórica precisa ser um número inteiro maior que zero.',
    })
  }

  let collectedAmount = null
  let expensesAmount = null

  if (editable.event.economyEnabled) {
    collectedAmount =
      parseMoney(
        request.body?.collectedAmount
      )

    expensesAmount =
      parseMoney(
        request.body?.expensesAmount
      )

    const onlyOneValue =
      (
        collectedAmount === null &&
        expensesAmount !== null
      ) ||
      (
        collectedAmount !== null &&
        expensesAmount === null
      )

    if (
      Number.isNaN(collectedAmount) ||
      Number.isNaN(expensesAmount)
    ) {
      return response.status(400).json({
        error:
          'Os valores financeiros precisam ser números iguais ou maiores que zero.',
      })
    }

    if (onlyOneValue) {
      return response.status(400).json({
        error:
          'Informe arrecadado e despesas juntos.',
      })
    }
  }

  await sql`
    INSERT INTO dreamer_historical_event_projects (
      historical_event_id,
      project_id,
      volunteer_base,
      collected_amount,
      expenses_amount
    )
    VALUES (
      ${editable.event.id},
      ${allowed.project.id},
      ${volunteerBase},
      ${collectedAmount},
      ${expensesAmount}
    )
    ON CONFLICT (
      historical_event_id,
      project_id
    )
    DO UPDATE SET
      volunteer_base =
        EXCLUDED.volunteer_base,
      collected_amount =
        EXCLUDED.collected_amount,
      expenses_amount =
        EXCLUDED.expenses_amount
  `

  return response.status(200).json({
    ok: true,
    message:
      'Dados históricos do projeto salvos.',
  })
}

async function saveHistoricalAttendance(
  request,
  response,
  campaign
) {
  const editable =
    await getEditableHistoricalEvent(
      campaign.id,
      request.body?.historicalEventId
    )

  if (editable.error) {
    return response
      .status(editable.status)
      .json({
        error: editable.error,
      })
  }

  if (!editable.event.attendanceEnabled) {
    return response.status(400).json({
      error:
        'Este evento histórico não possui frequência habilitada.',
    })
  }

  const allowed =
    await getAllowedHistoricalProject(
      editable.event,
      request.body?.projectId
    )

  if (allowed.error) {
    return response
      .status(allowed.status)
      .json({
        error: allowed.error,
      })
  }

  const names =
    normalizeAttendanceNames(
      request.body?.names
    )

  if (names === null) {
    return response.status(400).json({
      error:
        'Envie a lista nominal de presença.',
    })
  }

  const [projectData] = await sql`
    SELECT volunteer_base
    FROM dreamer_historical_event_projects
    WHERE historical_event_id =
      ${editable.event.id}
      AND project_id =
        ${allowed.project.id}
    LIMIT 1
  `

  if (!projectData) {
    return response.status(400).json({
      error:
        'Informe primeiro a base histórica deste projeto.',
    })
  }

  const volunteerBase =
    Number(projectData.volunteer_base)

  if (names.length > volunteerBase) {
    return response.status(400).json({
      error:
        `A lista possui ${names.length} presentes, mas a base histórica é ${volunteerBase}.`,
    })
  }

  /*
   * A lista permanece nominal.
   *
   * Nesta primeira versão não vinculamos
   * automaticamente nomes antigos a users.id.
   * Isso evita associações incorretas por nome.
   */
  await sql`
    DELETE FROM dreamer_historical_attendance
    WHERE historical_event_id =
      ${editable.event.id}
      AND project_id =
        ${allowed.project.id}
  `

  if (names.length > 0) {
    await sql`
      INSERT INTO dreamer_historical_attendance (
        historical_event_id,
        user_id,
        volunteer_name,
        project_id
      )
      SELECT
        ${editable.event.id},
        NULL,
        volunteer_name,
        ${allowed.project.id}
      FROM unnest(${names}::text[])
        AS attendance_names(volunteer_name)
    `
  }

  return response.status(200).json({
    ok: true,
    presentCount: names.length,
    volunteerBase,
    attendanceRate:
      volunteerBase > 0
        ? Number(
            (
              names.length /
              volunteerBase *
              100
            ).toFixed(2)
          )
        : 0,
    message:
      'Lista histórica de presença salva.',
  })
}

export default async function dreamerHistoricalEventsHandler(
  request,
  response
) {
  try {
    const auth =
      await requireDreamerUser(
        request,
        response
      )

    if (!auth) return

    if (!auth.isDreamerAdmin) {
      return response.status(403).json({
        error:
          'Acesso restrito aos administradores do Sócio Sonhador.',
      })
    }

    const campaign =
      await getOlympiadCampaign()

    if (!campaign) {
      return response.status(404).json({
        error:
          'Campanha da Olimpíada não encontrada.',
      })
    }

    if (request.method === 'GET') {
      const [projects, events] =
        await Promise.all([
          getProjects(),
          getHistoricalEvents(campaign.id),
        ])

      return response.status(200).json({
        campaign,
        projects: projects.map(project => ({
          id: Number(project.id),
          name: project.name,
        })),
        events,
      })
    }

    if (request.method !== 'POST') {
      return response.status(405).json({
        error: 'Método não permitido.',
      })
    }

    const operation =
      cleanText(
        request.body?.operation,
        60
      )

    if (operation === 'saveProjectData') {
      return saveHistoricalProjectData(
        request,
        response,
        campaign
      )
    }

    if (operation === 'saveAttendance') {
      return saveHistoricalAttendance(
        request,
        response,
        campaign
      )
    }

    if (operation !== 'createEvent') {
      return response.status(400).json({
        error: 'Operação inválida.',
      })
    }

    const name =
      cleanText(request.body?.name, 180)

    const eventDate =
      cleanDate(request.body?.eventDate)

    const projectId =
      normalizeProjectId(
        request.body?.projectId
      )

    const attendanceEnabled =
      cleanBoolean(
        request.body?.attendanceEnabled
      )

    const economyEnabled =
      cleanBoolean(
        request.body?.economyEnabled
      )

    if (!name) {
      return response.status(400).json({
        error: 'Informe o nome do evento.',
      })
    }

    if (!eventDate) {
      return response.status(400).json({
        error:
          'Informe uma data válida para o evento.',
      })
    }

    if (Number.isNaN(projectId)) {
      return response.status(400).json({
        error: 'Projeto inválido.',
      })
    }

    if (
      !attendanceEnabled &&
      !economyEnabled
    ) {
      return response.status(400).json({
        error:
          'O evento precisa possuir frequência, economia ou ambos.',
      })
    }

    if (projectId !== null) {
      const [project] = await sql`
        SELECT id
        FROM projects
        WHERE id = ${projectId}
          AND UPPER(name) IN (
            'APS',
            'PPF',
            'SJ'
          )
        LIMIT 1
      `

      if (!project) {
        return response.status(400).json({
          error: 'Projeto inválido.',
        })
      }
    }

    const [created] = await sql`
      INSERT INTO dreamer_historical_events (
        campaign_id,
        project_id,
        name,
        event_date,
        attendance_enabled,
        economy_enabled,
        validated,
        created_by
      )
      VALUES (
        ${campaign.id},
        ${projectId},
        ${name},
        ${eventDate},
        ${attendanceEnabled ? 1 : 0},
        ${economyEnabled ? 1 : 0},
        0,
        ${auth.id}
      )
      RETURNING id
    `

    return response.status(201).json({
      ok: true,
      id: Number(created.id),
      message:
        'Evento histórico criado em modo de revisão.',
    })
  } catch (error) {
    console.error(
      'Dreamer historical events:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível carregar os eventos históricos.',
    })
  }
}
