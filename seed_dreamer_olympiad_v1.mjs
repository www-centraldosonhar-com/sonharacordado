import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const MIKIO_USER_ID = 1
const CAROL_USER_ID = 314

const APS_PROJECT_ID = 1
const PPF_PROJECT_ID = 2
const SJ_PROJECT_ID = 3


console.log('\n===== DREAMER ADMINS =====')

await sql`
  INSERT INTO dreamer_roles (
    user_id,
    role_code,
    active
  )
  VALUES
    (${MIKIO_USER_ID}, 'dreamer_admin', 1),
    (${CAROL_USER_ID}, 'dreamer_admin', 1)
  ON CONFLICT (
    user_id,
    role_code
  )
  DO UPDATE SET
    active = 1
`

const admins = await sql`
  SELECT
    dreamer_roles.user_id,
    users.full_name,
    users.username,
    projects.name AS project,
    dreamer_roles.role_code,
    dreamer_roles.active

  FROM dreamer_roles

  JOIN users
    ON users.id = dreamer_roles.user_id

  LEFT JOIN projects
    ON projects.id = users.project_id

  WHERE
    dreamer_roles.role_code =
      'dreamer_admin'

  ORDER BY
    dreamer_roles.user_id
`

console.table(admins)


console.log('\n===== OLIMPÍADA SONHADORA =====')

const existingCampaign = await sql`
  SELECT id
  FROM dreamer_campaigns
  WHERE slug = 'olimpiada-sonhadora'
  LIMIT 1
`

let campaignId

if (existingCampaign.length > 0) {
  campaignId =
    existingCampaign[0].id

  await sql`
    UPDATE dreamer_campaigns
    SET
      name =
        'Olimpíada Sonhadora',

      campaign_type =
        'olympiad',

      description =
        'Competição interna de arrecadação entre APS, PPF e SJ, com participação e apoio da comunidade Sócio Sonhador.',

      allows_external_entries = 1,

      allows_direct_contributions = 1,

      uses_team_ranking = 1,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE id = ${campaignId}
  `
} else {
  const created = await sql`
    INSERT INTO dreamer_campaigns (
      name,
      slug,
      campaign_type,
      description,
      status,
      allows_external_entries,
      allows_direct_contributions,
      uses_team_ranking,
      created_by
    )
    VALUES (
      'Olimpíada Sonhadora',
      'olimpiada-sonhadora',
      'olympiad',
      'Competição interna de arrecadação entre APS, PPF e SJ, com participação e apoio da comunidade Sócio Sonhador.',
      'draft',
      1,
      1,
      1,
      ${MIKIO_USER_ID}
    )
    RETURNING id
  `

  campaignId =
    created[0].id
}


console.log(
  `Campanha ID: ${campaignId}`
)


console.log('\n===== TIMES =====')

for (const projectId of [
  APS_PROJECT_ID,
  PPF_PROJECT_ID,
  SJ_PROJECT_ID,
]) {
  await sql`
    INSERT INTO dreamer_campaign_teams (
      campaign_id,
      project_id,
      active
    )
    VALUES (
      ${campaignId},
      ${projectId},
      1
    )

    ON CONFLICT (
      campaign_id,
      project_id
    )

    DO UPDATE SET
      active = 1
  `
}


const teams = await sql`
  SELECT
    dreamer_campaign_teams.id,
    dreamer_campaign_teams.campaign_id,
    projects.id AS project_id,
    projects.name AS project,
    dreamer_campaign_teams.volunteer_count,
    dreamer_campaign_teams.active

  FROM dreamer_campaign_teams

  JOIN projects
    ON projects.id =
      dreamer_campaign_teams.project_id

  WHERE
    dreamer_campaign_teams.campaign_id =
      ${campaignId}

  ORDER BY
    projects.id
`

console.table(teams)


console.log('\n✅ Seed Sócio Sonhador concluído.')

process.exit(0)
