import process from 'node:process'
import {
  isGlobalAdmin,
  isProjectAdmin,
  isVolunteerTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'


function canImportVolunteers(admin) {
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


  if (!canImportVolunteers(admin)) {
    return response.status(403).json({
      error:
        'Você não possui permissão para importar voluntários.',
    })
  }


  /*
   * Nesta primeira etapa apenas informamos ao frontend
   * se a integração já possui configuração.
   *
   * Nenhuma senha do Google será armazenada.
   */
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_VOLUNTEERS_SPREADSHEET_ID || ''

  const clientId =
    process.env.GOOGLE_CLIENT_ID || ''

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET || ''

  const integrations = await sql`
    SELECT
      id
    FROM external_integrations
    WHERE provider = 'google'
      AND integration_key =
        'volunteer_sheet'
      AND refresh_token IS NOT NULL
      AND active = 1
    LIMIT 1
  `

  const authorized =
    integrations.length > 0


  const configured =
    Boolean(
      spreadsheetId &&
      clientId &&
      clientSecret &&
      authorized
    )


  return response.status(200).json({
    success: true,

    integration: {
      provider: 'google_sheets',

      configured,

      formConfigured:
        Boolean(spreadsheetId),

      authorizationConfigured:
        Boolean(
          clientId &&
          clientSecret &&
          authorized
        ),

      /*
       * Nunca retornamos credenciais.
       */
      status:
        configured
          ? 'connected'
          : 'waiting_authorization',
    },
  })
}
