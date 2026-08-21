import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// VOLUNTEER ACCESS
// =========================================================
//
// Voluntário:
//   equipe principal + Mídias.
//
// Admin de Equipe:
//   equipe administrada + Mídias.
//
// Admin de Projeto:
//   todas as equipes do próprio projeto.
//
// Admin Geral:
//   todas as equipes de todos os projetos.
//
// Mídias continua sendo uma área acessível a todos.
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
      p.name AS project,

      (
        SELECT up_admin.admin_scope
        FROM user_permissions up_admin
        WHERE
          up_admin.user_id = u.id
          AND up_admin.permission = 'admin'
          AND up_admin.active = 1
        LIMIT 1
      ) AS admin_scope

    FROM users u

    JOIN projects p
      ON p.id = u.project_id

    JOIN user_permissions up_volunteer
      ON up_volunteer.user_id = u.id
      AND up_volunteer.permission = 'volunteer'
      AND up_volunteer.active = 1

    WHERE u.id =
      ${sessionUser.userId}
      AND u.active = 1

    LIMIT 1
  `

  const user = users[0]

  if (!user) {
    return null
  }

  // Equipes diretamente vinculadas ao usuário.
  const userTeams = await sql`
    SELECT
      t.id,
      t.code,
      t.name
    FROM user_teams ut

    JOIN teams t
      ON t.id = ut.team_id

    WHERE ut.user_id =
      ${user.id}
      AND ut.active = 1
      AND t.active = 1

    ORDER BY t.name
  `

  // Todas as equipes existentes.
  const allTeams = await sql`
    SELECT
      id,
      code,
      name
    FROM teams
    WHERE active = 1
    ORDER BY name
  `

  const mediaTeam =
    allTeams.find(
      (team) =>
        team.code === 'media'
    ) || null

  const primaryTeam =
    userTeams.find(
      (team) =>
        team.code !== 'media'
    ) || null

  const adminScope =
    user.admin_scope || null

  let availableTeams

  // =====================================================
  // ADMIN GERAL / ADMIN DE PROJETO
  // =====================================================
  // Ambos enxergam todas as equipes.
  // A diferença de projeto será aplicada pelo backend
  // quando carregarmos conteúdo específico de cada área.
  // =====================================================

  if (
    adminScope === 'global' ||
    adminScope === 'project'
  ) {
    availableTeams =
      allTeams
  } else {
    // Voluntário/Admin de Equipe:
    // mantém as próprias equipes.
    availableTeams = [
      ...userTeams,
    ]

    // Mídias é aberta para todos.
    if (
      mediaTeam &&
      !availableTeams.some(
        (team) =>
          Number(team.id) ===
          Number(mediaTeam.id)
      )
    ) {
      availableTeams.push(
        mediaTeam
      )
    }
  }

  return {
    ...user,

    adminScope,

    teams:
      userTeams,

    availableTeams,

    primaryTeam,

    mediaSupport:
      true,
  }
}
