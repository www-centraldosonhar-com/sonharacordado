export async function calculateEventEconomy(
  sql,
  campaignId
) {
  const rows = await sql`
    SELECT
      team.project_id,
      project.name AS project,
      team.volunteer_count,

      event.id AS event_id,
      event.name AS event_name,

      COALESCE((
        SELECT SUM(
          CASE
            WHEN registration.status = 'confirmed'
              AND registration.coupon_id IS NULL
            THEN event.registration_fee
            ELSE 0
          END
        )
        FROM event_registrations registration
        WHERE registration.event_id = event.id
      ), 0)::numeric(12,2)
        AS collected_amount,

      COALESCE((
        SELECT SUM(expense.amount)
        FROM team_expenses expense
        WHERE expense.event_id = event.id
          AND expense.active = 1
      ), 0)::numeric(12,2)
        AS expenses_amount

    FROM dreamer_campaign_teams team

    JOIN projects project
      ON project.id = team.project_id

    JOIN events event
      ON event.project_id = team.project_id

    JOIN post_event_closures closure
      ON closure.event_id = event.id
      AND closure.expenses_closed = 1

    WHERE
      team.campaign_id = ${campaignId}

    ORDER BY
      team.project_id,
      event.event_date,
      event.id
  `

  const campaignTeams = await sql`
    SELECT
      team.project_id,
      project.name AS project,
      team.volunteer_count
    FROM dreamer_campaign_teams team
    JOIN projects project
      ON project.id = team.project_id
    WHERE team.campaign_id = ${campaignId}
      AND team.active = 1
    ORDER BY team.project_id
  `

  const byProject = new Map(
    campaignTeams.map(team => [
      Number(team.project_id),
      {
        projectId: Number(team.project_id),
        project: team.project,
        volunteerCount:
          Number(team.volunteer_count || 0),
        economyAmount: 0,
        calculatedEvents: 0,
        events: [],
        economyPoints: 0,
      },
    ])
  )

  for (const row of rows) {
    const projectId =
      Number(row.project_id)

    const collectedAmount =
      Number(row.collected_amount || 0)

    const expensesAmount =
      Number(row.expenses_amount || 0)

    const balanceAmount =
      collectedAmount - expensesAmount

    const economyAmount =
      Math.max(0, balanceAmount)

    if (!byProject.has(projectId)) {
      byProject.set(projectId, {
        projectId,
        project: row.project,
        volunteerCount:
          Number(row.volunteer_count || 0),
        economyAmount: 0,
        calculatedEvents: 0,
        events: [],
      })
    }

    const result =
      byProject.get(projectId)

    result.economyAmount +=
      economyAmount

    result.calculatedEvents += 1

    result.events.push({
      eventId: Number(row.event_id),
      eventName: row.event_name,
      collectedAmount,
      expensesAmount,
      balanceAmount,
      economyAmount,
    })
  }

  // Primeiro calcula a pontuação dos eventos nativos usando
  // a base competitiva atual da campanha.
  for (const result of byProject.values()) {
    result.economyAmount =
      Number(result.economyAmount.toFixed(2))

    result.nativeEconomyPoints =
      result.volunteerCount > 0
        ? result.economyAmount /
          result.volunteerCount
        : 0

    result.historicalEconomyPoints = 0
  }

  // Eventos históricos validados de projeto participam da Economia.
  // Eventos gerais (project_id NULL) permanecem fora desta categoria,
  // seguindo a mesma regra dos eventos nativos.
  const historicalRows = await sql`
    SELECT
      historical.id AS historical_event_id,
      historical.name AS event_name,
      historical.event_date,
      historical.project_id,
      historical_project.volunteer_base,
      historical_project.collected_amount,
      historical_project.expenses_amount
    FROM dreamer_historical_events historical
    JOIN dreamer_historical_event_projects historical_project
      ON historical_project.historical_event_id =
        historical.id
      AND historical_project.project_id =
        historical.project_id
    WHERE
      historical.campaign_id = ${campaignId}
      AND historical.validated = 1
      AND historical.economy_enabled = 1
      AND historical.project_id IS NOT NULL
    ORDER BY
      historical.project_id,
      historical.event_date,
      historical.id
  `

  for (const row of historicalRows) {
    const projectId =
      Number(row.project_id)

    const result =
      byProject.get(projectId)

    if (!result) {
      continue
    }

    const volunteerBase =
      Number(row.volunteer_base || 0)

    const collectedAmount =
      Number(row.collected_amount || 0)

    const expensesAmount =
      Number(row.expenses_amount || 0)

    if (volunteerBase <= 0) {
      continue
    }

    const balanceAmount =
      collectedAmount - expensesAmount

    const economyAmount =
      Math.max(0, balanceAmount)

    const economyPoints =
      economyAmount / volunteerBase

    result.economyAmount +=
      economyAmount

    result.historicalEconomyPoints +=
      economyPoints

    result.calculatedEvents += 1

    result.events.push({
      eventId: null,
      historicalEventId:
        Number(row.historical_event_id),
      historical: true,
      eventName: row.event_name,
      eventDate: row.event_date,
      volunteerCount: volunteerBase,
      collectedAmount,
      expensesAmount,
      balanceAmount,
      economyAmount:
        Number(economyAmount.toFixed(2)),
      economyPoints:
        Number(economyPoints.toFixed(2)),
    })
  }

  for (const result of byProject.values()) {
    result.economyAmount =
      Number(result.economyAmount.toFixed(2))

    result.nativeEconomyPoints =
      Number(
        result.nativeEconomyPoints.toFixed(2)
      )

    result.historicalEconomyPoints =
      Number(
        result.historicalEconomyPoints.toFixed(2)
      )

    result.economyPoints =
      Number(
        (
          result.nativeEconomyPoints +
          result.historicalEconomyPoints
        ).toFixed(2)
      )
  }

  return byProject
}
