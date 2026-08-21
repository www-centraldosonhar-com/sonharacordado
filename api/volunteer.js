import homeHandler from '../server/actions/home.js'
import confirmActivityHandler from '../server/actions/confirm-activity.js'
import cancelConfirmationHandler from '../server/actions/cancel-confirmation.js'
import saveEventDriveHandler from '../server/actions/save-event-drive.js'
import completePhotoDeliveryHandler from '../server/actions/complete-photo-delivery.js'
import registrationHandler from '../server/actions/registration.js'

export default async function handler(request, response) {
  const action = request.query?.action

  if (action === 'home') {
    return homeHandler(request, response)
  }

  if (action === 'confirm-activity') {
    return confirmActivityHandler(request, response)
  }

  if (action === 'cancel-confirmation') {
    return cancelConfirmationHandler(request, response)
  }

  if (action === 'save-event-drive') {
    return saveEventDriveHandler(request, response)
  }

  if (action === 'complete-photo-delivery') {
    return completePhotoDeliveryHandler(
      request,
      response
    )
  }

  if (action === 'registration') {
    return registrationHandler(
      request,
      response
    )
  }

  return response.status(404).json({
    error: 'Ação do voluntário não encontrada.',
  })
}
