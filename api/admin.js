import adminGoogleSheetsResponsesHandler from '../server/actions/admin-google-sheets-responses.js'
import googleOAuthStartHandler from '../server/actions/google-oauth-start.js'
import adminGoogleFormsHandler from '../server/actions/admin-google-forms.js'
import adminDataHandler from '../server/actions/admin-data.js'
import adminCreateHandler from '../server/actions/admin-create.js'
import adminUpdateHandler from '../server/actions/admin-update.js'
import adminImportUsersHandler from '../server/actions/admin-import-users.js'
import adminRegistrationHandler from '../server/actions/admin-registration.js'
import adminExpenseHandler from '../server/actions/admin-expenses.js'
import postEventHandler from '../server/actions/post-event.js'
import financeRequestsAdminHandler from '../server/actions/finance-requests-admin.js'

export default async function handler(request, response) {
  const action = request.query?.action

  if (action === 'data') {
    return adminDataHandler(request, response)
  }

  if (action === 'create') {
    return adminCreateHandler(request, response)
  }

  if (action === 'update') {
    return adminUpdateHandler(request, response)
  }

  if (action === 'google-sheets-responses') {
    try {
      return await adminGoogleSheetsResponsesHandler(
        request,
        response
      )
    } catch (error) {
      console.error(
        'GOOGLE SHEETS RESPONSES ERROR:',
        error
      )

      return response.status(500).json({
        error:
          error?.message ||
          'Não foi possível buscar as respostas do Google Sheets.',
      })
    }
  }


  if (action === 'google-oauth-start') {
    try {
      return await googleOAuthStartHandler(
        request,
        response
      )
    } catch (error) {
      console.error(
        'GOOGLE OAUTH START ERROR:',
        error
      )

      return response.status(500).json({
        error:
          error?.message ||
          'Não foi possível iniciar a autorização do Google.',
      })
    }
  }


  if (action === 'google-forms') {
    try {
      return await adminGoogleFormsHandler(
        request,
        response
      )
    } catch (error) {
      console.error(
        'ADMIN GOOGLE FORMS ERROR:',
        error
      )

      return response.status(500).json({
        error:
          error?.message ||
          'Erro interno na integração com Google Forms.',
      })
    }
  }


  if (action === 'import-users') {
    try {
      return await adminImportUsersHandler(
        request,
        response
      )
    } catch (error) {
      console.error(
        'ADMIN IMPORT USERS ERROR:',
        error
      )

      return response.status(500).json({
        error:
          error?.message ||
          'Erro interno ao analisar voluntários.',
        detail:
          error?.name ||
          'UnknownError',
      })
    }
  }

  if (action === 'registrations') {
    return adminRegistrationHandler(
      request,
      response
    )
  }

  if (action === 'expenses') {
    return adminExpenseHandler(
      request,
      response
    )
  }

  if (action === 'finance-requests') {
    return financeRequestsAdminHandler(
      request,
      response
    )
  }

  if (action === 'post-event') {
    return postEventHandler(
      request,
      response
    )
  }


  return response.status(404).json({
    error: 'Ação administrativa não encontrada.',
  })
}
