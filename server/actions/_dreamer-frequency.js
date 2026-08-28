import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const OLYMPIAD_SLUG = 'olimpiada-sonhadora'
const CHECKIN_ACTIVITY_NAME =
  'Recepção / Check-in de Voluntários'

function toNumber(value) {
  return Number(value || 0)
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

export async function getOlympiadCampaign() {
  const rows = await sql`
    SELECT
      id,
      name,
      slug,
      status,
      starts_at,
      ends_at
    FROM dreamer_campaigns
    WHERE slug = ${OLYMPIAD_SLUG}
    LIMIT 1
  `

  return rows[0] || null
}

export async function listAttendanceEvents(
  campaignId
) {
  const rows = await sql`
    SELECT
      e.id,
      e.name,
      e.event_type,
      e.event_date,
      e.event_time,
      e.location,
      e.project_id,
      project.name AS project_name,
      e.active,
      e.event_status,
      CASE
        WHEN dae.id IS NOT NULL
          AND dae.active = 1
        THEN 1
        ELSE 0
      END AS selected,
      CASE
        WHEN e.event_date >= (
          timezone('America/Sao_Paulo', now())
        )::date
        THEN 1
        ELSE 0
      END AS can_select
    FROM events e

    LEFT JOIN projects project
      ON project.id = e.project_id

    LEFT JOIN dreamer_attendance_events dae
      ON dae.event_id = e.id
      AND dae.campaign_id = ${campaignId}

    WHERE e.active = 1

    ORDER BY
      e.event_date DESC,
      e.event_time DESC,
      e.id DESC
  `

  return rows.map(row => ({
    id: toNumber(row.id),
    name: row.name,
    eventType: row.event_type,
    eventDate: row.event_date,
    eventTime: row.event_time,
    location: row.location,
    projectId:
      row.project_id == null
        ? null
        : toNumber(row.project_id),
    project: row.project_name,
    eventStatus: row.event_status,
    selected: toNumber(row.selected) === 1,
    canSelect: toNumber(row.can_select) === 1,
  }))
}

export async function setAttendanceEvent({
  campaignId,
  eventId,
  active,
  userId,
}) {
  const eventRows = await sql`
    SELECT id
    FROM events
    WHERE
      id = ${eventId}
      AND active = 1
    LIMIT 1
  `

  if (!eventRows[0]) {
    return false
  }

  await sql`
    INSERT INTO dreamer_attendance_events (
      campaign_id,
      event_id,
      active,
      added_by
    )
    VALUES (
      ${campaignId},
      ${eventId},
      ${active ? 1 : 0},
      ${userId}
    )
    ON CONFLICT (
      campaign_id,
      event_id
    )
    DO UPDATE SET
      active = EXCLUDED.active,
      added_by = EXCLUDED.added_by
  `

  return true
}

export async function calculateAttendanceFrequency(
  campaignId
) {
  const matrixRows = await sql`
    WITH selected_events AS (
      SELECT
        dae.event_id,
        event.name AS event_name,
        event.event_date,
        event.event_time
      FROM dreamer_attendance_events dae
      JOIN events event
        ON event.id = dae.event_id
      WHERE
        dae.campaign_id = ${campaignId}
        AND dae.active = 1
        -- Eventos futuros podem ser pré-selecionados pelo Admin Sócio,
        -- mas só entram na frequência a partir do dia seguinte ao evento.
        -- Isso evita pontuação parcial enquanto o check-in ainda está acontecendo.
        AND event.event_date < (
          timezone('America/Sao_Paulo', now())
        )::date
    ),

    present_by_event_project AS (
      SELECT
        event_role.event_id,
        volunteer.project_id,
        COUNT(
          DISTINCT registration.user_id
        )::int AS present_count

      FROM activity_checklist_items item

      JOIN activity_checklists checklist
        ON checklist.id = item.checklist_id
        AND checklist.active = 1

      JOIN event_roles event_role
        ON event_role.id = checklist.event_role_id

      JOIN roles activity
        ON activity.id = event_role.role_id
        AND activity.name = ${CHECKIN_ACTIVITY_NAME}

      JOIN event_registrations registration
        ON registration.id = item.registration_id
        AND registration.status = 'confirmed'

      JOIN users volunteer
        ON volunteer.id = registration.user_id

      JOIN selected_events selected
        ON selected.event_id = event_role.event_id

      WHERE
        item.checked = 1
        AND item.registration_id IS NOT NULL
        AND volunteer.project_id IS NOT NULL

      GROUP BY
        event_role.event_id,
        volunteer.project_id
    )

    SELECT
      team.project_id,
      project.name AS project_name,
      team.volunteer_count,
      selected.event_id,
      selected.event_name,
      selected.event_date,
      selected.event_time,
      COALESCE(
        presence.present_count,
        0
      )::int AS present_count

    FROM dreamer_campaign_teams team

    JOIN projects project
      ON project.id = team.project_id

    CROSS JOIN selected_events selected

    LEFT JOIN present_by_event_project presence
      ON presence.event_id = selected.event_id
      AND presence.project_id = team.project_id

    WHERE
      team.campaign_id = ${campaignId}
      AND team.active = 1

    ORDER BY
      selected.event_date ASC,
      selected.event_id ASC,
      team.project_id ASC
  `

  const teamRows = await sql`
    SELECT
      team.project_id,
      project.name AS project_name,
      team.volunteer_count
    FROM dreamer_campaign_teams team
    JOIN projects project
      ON project.id = team.project_id
    WHERE
      team.campaign_id = ${campaignId}
      AND team.active = 1
    ORDER BY team.project_id ASC
  `

  const teamsById = new Map(
    teamRows.map(team => [
      toNumber(team.project_id),
      {
        projectId: toNumber(team.project_id),
        project: team.project_name,
        volunteerCount:
          toNumber(team.volunteer_count),
        events: [],
      },
    ])
  )

  const eventsById = new Map()

  for (const row of matrixRows) {
    const projectId = toNumber(row.project_id)
    const eventId = toNumber(row.event_id)
    const volunteerCount =
      toNumber(row.volunteer_count)
    const presentCount =
      toNumber(row.present_count)

    const attendanceRate =
      volunteerCount > 0
        ? (presentCount / volunteerCount) * 100
        : 0

    const eventResult = {
      eventId,
      eventName: row.event_name,
      eventDate: row.event_date,
      eventTime: row.event_time,
      presentCount,
      volunteerCount,
      attendanceRate:
        round(attendanceRate, 4),
    }

    teamsById
      .get(projectId)
      ?.events.push(eventResult)

    if (!eventsById.has(eventId)) {
      eventsById.set(eventId, {
        id: eventId,
        name: row.event_name,
        eventDate: row.event_date,
        eventTime: row.event_time,
      })
    }
  }

  const teams = [...teamsById.values()]
    .map(team => {
      const eventCount = team.events.length
      const averageRate =
        eventCount > 0
          ? team.events.reduce(
              (sum, event) =>
                sum + event.attendanceRate,
              0
            ) / eventCount
          : 0

      return {
        ...team,
        eventCount,
        averageRate:
          round(averageRate, 4),
      }
    })

  const ordered = [...teams].sort(
    (a, b) =>
      b.averageRate - a.averageRate ||
      a.projectId - b.projectId
  )

  const hasTie = ordered.some(
    (team, index) =>
      index > 0 &&
      team.averageRate ===
        ordered[index - 1].averageRate
  )

  const pointsByProject = new Map()

  if (!hasTie && eventsById.size > 0) {
    const scoreByPosition = [10, 5, 0]

    ordered.forEach((team, index) => {
      pointsByProject.set(
        team.projectId,
        scoreByPosition[index] ?? 0
      )
    })
  }

  const ranking = ordered.map(
    (team, index) => ({
      ...team,
      position: index + 1,
      frequencyPoints:
        hasTie || eventsById.size === 0
          ? null
          : pointsByProject.get(
              team.projectId
            ) ?? 0,
    })
  )

  return {
    eventCount: eventsById.size,
    events: [...eventsById.values()],
    teams,
    ranking,
    scoring: {
      hasTie,
      pointsApplied:
        !hasTie && eventsById.size > 0,
      rule: '+10 / +5 / 0',
      note: hasTie
        ? 'Existe empate de frequência. O regulamento ainda precisa definir o critério de desempate antes de aplicar pontos oficiais.'
        : null,
    },
  }
}

export async function saveFrequencySnapshots({
  campaignId,
  frequency,
}) {
  await sql`
    DELETE FROM dreamer_frequency_snapshots snapshot
    WHERE
      snapshot.campaign_id = ${campaignId}
      AND snapshot.event_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM dreamer_attendance_events selected
        WHERE
          selected.campaign_id = ${campaignId}
          AND selected.event_id = snapshot.event_id
          AND selected.active = 1
      )
  `

  for (const team of frequency.teams) {
    for (const event of team.events) {
      await sql`
        INSERT INTO dreamer_frequency_snapshots (
          campaign_id,
          project_id,
          event_id,
          present_count,
          semester_volunteer_count,
          attendance_rate
        )
        VALUES (
          ${campaignId},
          ${team.projectId},
          ${event.eventId},
          ${event.presentCount},
          ${event.volunteerCount},
          ${event.attendanceRate}
        )
        ON CONFLICT (
          campaign_id,
          project_id,
          event_id
        )
        DO UPDATE SET
          present_count = EXCLUDED.present_count,
          semester_volunteer_count = EXCLUDED.semester_volunteer_count,
          attendance_rate = EXCLUDED.attendance_rate,
          created_at = CURRENT_TIMESTAMP
      `
    }
  }
}
