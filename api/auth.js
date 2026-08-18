import loginHandler from '../server/actions/login.js'
import sessionHandler from '../server/actions/session.js'
import logoutHandler from '../server/actions/logout.js'

export default async function handler(request, response) {
  const action = request.query?.action

  if (action === 'login') {
    return loginHandler(request, response)
  }

  if (action === 'session') {
    return sessionHandler(request, response)
  }

  if (action === 'logout') {
    return logoutHandler(request, response)
  }

  return response.status(404).json({
    error: 'Ação de autenticação não encontrada.',
  })
}
