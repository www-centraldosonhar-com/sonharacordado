import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// VOLUNTEER ACCESS
// =========================================================
// Regras:
// - precisa possuir permission = volunteer;
// - uma equipe principal no máximo;
// - Mídias pode existir sozinha ou junto da principal;
// - Mídias é transversal aos projetos;
// - demais equipes ficam limitadas ao projeto do usuário.
// =========================================================

export async function requireVolunteer(request) {
  const sessionUser =
    await getSessionUser(request)

  if (!sessionUser?.userId) {
    return null
  }

  const users = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.avatar_path,
      u.user_type,
      u.active,
      u.project_id,
      p.name AS project
    FROM users u
    JOIN projects p
      ON p.id = u.project_id
    JOIN user_permissions up
      ON up.user_id = u.id
      AND up.permission = 'volunteer'
      AND up.active = 1
    WHERE u.id = ${sessionUser.userId}
      AND u.active = 1
    LIMIT 1
  `

  const user = users[0]

  if (!user) {
    return null
  }

  const teams = await sql`
    SELECT
      t.id,
      t.code,
      t.name
    FROM user_teams ut
    JOIN teams t
      ON t.id = ut.team_id
    WHERE ut.user_id = ${user.id}
      AND ut.active = 1
      AND t.active = 1
    ORDER BY
      CASE
        WHEN t.code = 'media'
        THEN 2
        ELSE 1
      END,
      t.name
  `

  const mediaTeam =
    teams.find(
      (team) =>
        team.code === 'media'
    ) || null

  const primaryTeam =
    teams.find(
      (team) =>
        team.code !== 'media'
    ) || null

  return {
    ...user,

    teams,

    primaryTeam,

    mediaSupport:
      Boolean(mediaTeam),
  }
}
