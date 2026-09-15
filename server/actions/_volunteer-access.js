import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

// =========================================================
// VOLUNTEER ACCESS
// =========================================================
//
// Voluntário:
//   projeto próprio + equipes às quais pertence.
//
// Admin de Equipe:
//   mantém acesso normal de voluntário e administra
//   somente as equipes sob sua responsabilidade.
//
// Admin de Projeto:
//   administra as equipes do próprio projeto.
//
// Admin Geral:
//   acesso administrativo global.
//
// Mídias NÃO é uma equipe universal.
// Somente atividades explicitamente marcadas com
// community_visible aparecem na Comunidade.
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

    LEFT JOIN projects p
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

  // Equipes diretamente vinculadas ao usuário,
  // respeitando a configuração ativa do projeto.
  //
  // Exemplo:
  // PPF mantém internamente `volunteers`, mas exibe
  // "Equipe de Voluntários & Assistidos".
  // Vínculos antigos com equipes inativas no projeto
  // (como `assisted` no PPF/SJ) ficam preservados no banco,
  // porém não aparecem operacionalmente.
  const userTeams = await sql`
    SELECT
      t.id,
      t.code,
      COALESCE(
        ptc.display_name,
        t.name
      ) AS name
    FROM user_teams ut

    JOIN teams t
      ON t.id = ut.team_id

    LEFT JOIN project_team_config ptc
      ON ptc.team_id = t.id
      AND ptc.project_id = ${user.project_id}
      AND ptc.active = 1

    WHERE ut.user_id =
      ${user.id}
      AND ut.active = 1
      AND t.active = 1

      AND (
        ${user.project_id} IS NULL
        OR ptc.team_id IS NOT NULL
      )

    ORDER BY
      COALESCE(
        ptc.display_name,
        t.name
      )
  `

  // Todas as equipes existentes.
  // Mantida para o Admin Geral por compatibilidade
  // enquanto o contexto global de projeto ainda não
  // foi conectado a esta função.
  const allTeams = await sql`
    SELECT
      id,
      code,
      name
    FROM teams
    WHERE active = 1
    ORDER BY name
  `

  // Equipes ativas do projeto do usuário.
  // Admin de Projeto passa a enxergar somente
  // as equipes configuradas para o próprio projeto.
  const projectTeams = await sql`
    SELECT
      t.id,
      t.code,
      COALESCE(
        ptc.display_name,
        t.name
      ) AS name
    FROM project_team_config ptc

    JOIN teams t
      ON t.id = ptc.team_id

    WHERE
      ptc.project_id = ${user.project_id}
      AND ptc.active = 1
      AND t.active = 1

    ORDER BY
      COALESCE(
        ptc.display_name,
        t.name
      )
  `

  const primaryTeam =
    userTeams.find(
      (team) =>
        team.code !== 'media'
    ) ||
    userTeams[0] ||
    null

  const adminScope =
    user.admin_scope || null

  let availableTeams

  // =====================================================
  // ADMIN GERAL / ADMIN DE PROJETO
  // =====================================================
  //
  // Admin Geral:
  // mantém catálogo global por compatibilidade nesta etapa.
  //
  // Admin de Projeto:
  // enxerga somente as equipes ativas do próprio projeto.
  //
  // Voluntário/Admin de Equipe:
  // mantém apenas suas equipes, já filtradas pela
  // configuração ativa do projeto.
  // =====================================================

  if (
    adminScope === 'global'
  ) {
    availableTeams =
      allTeams
  } else if (
    adminScope === 'project'
  ) {
    availableTeams =
      projectTeams
  } else {
    availableTeams = [
      ...userTeams,
    ]
  }

  return {
    ...user,

    adminScope,

    teams:
      userTeams,

    availableTeams,

    primaryTeam,

    mediaSupport:
      userTeams.some(
        (team) =>
          String(team.code).toLowerCase() === 'media'
      ),
  }
}
