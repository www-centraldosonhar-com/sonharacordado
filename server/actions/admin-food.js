import {
  isGlobalAdmin,
  isProjectAdmin,
  isTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'


// =========================================================
// FOOD ACCESS
// =========================================================
//
// Admin Geral
//   → todos os projetos
//
// Admin de Projeto
//   → próprio projeto
//
// Admin da Equipe Alimentação
//   → próprio projeto
//
// =========================================================

function isFoodTeamAdmin(admin) {
  return (
    isTeamAdmin(admin) &&
    (
      admin?.teams || []
    ).some(
      team =>
        team.code === 'food'
    )
  )
}


function canViewFoodRestrictions(
  admin
) {
  return (
    isGlobalAdmin(admin) ||
    isProjectAdmin(admin) ||
    isFoodTeamAdmin(admin)
  )
}


export default async function handler(
  request,
  response
) {
  const admin =
    await requireAdmin(request)

  if (
    !admin ||
    !canViewFoodRestrictions(
      admin
    )
  ) {
    return response.status(403).json({
      error:
        'Você não possui acesso às informações de Alimentação.',
    })
  }


  if (request.method !== 'GET') {
    return response.status(405).json({
      error:
        'Method not allowed.',
    })
  }


  // =======================================================
  // ASSISTIDOS
  // =======================================================

  const assistedRows =
    await sql`
      SELECT
        assisted.id,
        assisted.full_name,
        assisted.allergies,
        assisted.notes,
        assisted.project_id,

        project.name
          AS project_name

      FROM assisted_people assisted

      JOIN projects project
        ON project.id =
          assisted.project_id

      WHERE
        assisted.active = 1

        AND (
          ${isGlobalAdmin(admin)}
          OR assisted.project_id =
            ${admin.projectId}
        )

        AND NULLIF(
          TRIM(
            assisted.allergies
          ),
          ''
        ) IS NOT NULL

      ORDER BY
        project.name,
        assisted.full_name
    `


  // =======================================================
  // VOLUNTÁRIOS
  // =======================================================

  const volunteerRows =
    await sql`
      SELECT
        users.id,

        COALESCE(
          NULLIF(
            TRIM(
              users.full_name
            ),
            ''
          ),
          users.name
        ) AS full_name,

        users.allergies,
        users.project_id,

        project.name
          AS project_name

      FROM users

      JOIN projects project
        ON project.id =
          users.project_id

      WHERE
        users.active = 1

        AND (
          ${isGlobalAdmin(admin)}
          OR users.project_id =
            ${admin.projectId}
        )

        AND NULLIF(
          TRIM(
            users.allergies
          ),
          ''
        ) IS NOT NULL

      ORDER BY
        project.name,
        full_name
    `


  return response.status(200).json({
    assisted:
      assistedRows,

    volunteers:
      volunteerRows,

    totals: {
      assisted:
        assistedRows.length,

      volunteers:
        volunteerRows.length,
    },
  })
}
