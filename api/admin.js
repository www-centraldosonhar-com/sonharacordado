import adminDataHandler from '../server/actions/admin-data.js'
import adminCreateHandler from '../server/actions/admin-create.js'
import adminUpdateHandler from '../server/actions/admin-update.js'
import adminRegistrationHandler from '../server/actions/admin-registration.js'
import adminExpenseHandler from '../server/actions/admin-expenses.js'
import postEventHandler from '../server/actions/post-event.js'

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
