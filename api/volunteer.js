import homeHandler from '../server/actions/home.js'
import confirmActivityHandler from '../server/actions/confirm-activity.js'
import cancelConfirmationHandler from '../server/actions/cancel-confirmation.js'
import joinTaskHandler from '../server/actions/join-task.js'
import leaveTaskHandler from '../server/actions/leave-task.js'
import submitDeliveryHandler from '../server/actions/submit-delivery.js'
import saveEventDriveHandler from '../server/actions/save-event-drive.js'
import completePhotoDeliveryHandler from '../server/actions/complete-photo-delivery.js'

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

  if (action === 'join-task') {
    return joinTaskHandler(request, response)
  }

  if (action === 'leave-task') {
    return leaveTaskHandler(request, response)
  }

  if (action === 'submit-delivery') {
    return submitDeliveryHandler(request, response)
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

  return response.status(404).json({
    error: 'Ação do voluntário não encontrada.',
  })
}
