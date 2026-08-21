import loginHandler from '../server/actions/login.js'
import sessionHandler from '../server/actions/session.js'
import registerExternalHandler from '../server/actions/register-external.js'
import logoutHandler from '../server/actions/logout.js'
import setupPinHandler from '../server/actions/setup-pin.js'
import googleOAuthCallbackHandler from '../server/actions/google-oauth-callback.js'

export default async function handler(request, response) {
  const action = request.query?.action

  if (action === 'login') {
    return loginHandler(request, response)
  }

  if (action === 'session') {
    return sessionHandler(request, response)
  }

  if (action === 'register-external') {
    return registerExternalHandler(
      request,
      response
    )
  }

  if (action === 'setup-pin') {
    return setupPinHandler(
      request,
      response
    )
  }

  if (
    action ===
    'google-oauth-callback'
  ) {
    try {
      return await googleOAuthCallbackHandler(
        request,
        response
      )
    } catch (error) {
      console.error(
        'GOOGLE OAUTH CALLBACK ERROR:',
        error
      )

      return response.status(500).json({
        error:
          error?.message ||
          'Não foi possível concluir o OAuth do Google.',
      })
    }
  }


  if (action === 'logout') {
    return logoutHandler(request, response)
  }

  return response.status(404).json({
    error: 'Ação de autenticação não encontrada.',
  })
}
