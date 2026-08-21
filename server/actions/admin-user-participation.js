import {
  isGlobalAdmin,
  isProjectAdmin,
  isVolunteerTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'


function canViewVolunteerProfiles(admin) {
  return (
    isGlobalAdmin(admin) ||
    isProjectAdmin(admin) ||
    isVolunteerTeamAdmin(admin)
  )
}


export default async function handler(
  request,
  response
) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }


  const admin =
    await requireAdmin(request)


  if (!admin) {
    return response.status(403).json({
      error:
        'Acesso administrativo não autorizado.',
    })
  }


  if (!canViewVolunteerProfiles(admin)) {
    return response.status(403).json({
      error:
        'Você não possui permissão para visualizar este histórico.',
    })
  }


  const userId =
    Number(
      request.query?.userId
    )


  if (!Number.isInteger(userId)) {
    return response.status(400).json({
      error:
        'Usuário inválido.',
    })
  }


  const userRows = await sql`
    SELECT
      u.id,
      u.project_id
    FROM users u
    WHERE u.id = ${userId}
    LIMIT 1
  `


  const user =
    userRows[0]


  if (!user) {
    return response.status(404).json({
      error:
        'Usuário não encontrado.',
    })
  }


  /*
   * Admin de projeto só pode consultar
   * usuários do próprio projeto.
   */
  if (
    isProjectAdmin(admin) &&
    Number(user.project_id) !==
      Number(admin.projectId)
  ) {
    return response.status(403).json({
      error:
        'Este usuário pertence a outro projeto.',
    })
  }


  const registrations = await sql`
    SELECT
      er.id,
      er.event_id,
      er.team,
      er.status,
      er.created_at,
      er.reviewed_at,

      e.name AS event_name,
      e.event_date,
      e.event_time,
      e.location,
      e.event_status

    FROM event_registrations er

    JOIN events e
      ON e.id = er.event_id

    WHERE
      er.user_id = ${userId}

    ORDER BY
      e.event_date DESC,
      e.event_time DESC,
      er.id DESC
  `


  return response.status(200).json({
    success: true,

    total:
      registrations.length,

    participations:
      registrations,
  })
}
