import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const campaignRows = await sql`
  SELECT id
  FROM dreamer_campaigns
  WHERE slug = 'olimpiada-sonhadora'
  LIMIT 1
`

if (campaignRows.length === 0) {
  throw new Error(
    'Campanha Olimpíada Sonhadora não encontrada.'
  )
}

const campaignId =
  campaignRows[0].id

const counts = [
  {
    projectId: 1,
    project: 'APS',
    volunteerCount: 52,
  },
  {
    projectId: 2,
    project: 'PPF',
    volunteerCount: 42,
  },
  {
    projectId: 3,
    project: 'SJ',
    volunteerCount: 26,
  },
]

for (const item of counts) {
  await sql`
    UPDATE dreamer_campaign_teams
    SET
      volunteer_count =
        ${item.volunteerCount}

    WHERE
      campaign_id =
        ${campaignId}

      AND project_id =
        ${item.projectId}
  `
}

const result = await sql`
  SELECT
    dct.project_id,
    p.name AS project,
    dct.volunteer_count
  FROM dreamer_campaign_teams dct
  JOIN projects p
    ON p.id = dct.project_id
  WHERE
    dct.campaign_id =
      ${campaignId}
  ORDER BY
    dct.project_id
`

console.log(
  '\n===== CONTAGEM OFICIAL CONGELADA ====='
)

console.table(result)

console.log(
  '\n✅ Denominadores da Olimpíada atualizados.'
)

process.exit(0)
