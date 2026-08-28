import dreamerHomeHandler from '../server/actions/dreamer-home.js'
import dreamerFrequencyHandler from '../server/actions/dreamer-frequency.js'

export default async function handler(
  request,
  response
) {
  const action =
    request.query?.action

  if (action === 'frequency') {
    return dreamerFrequencyHandler(
      request,
      response
    )
  }

  if (
    !action ||
    action === 'home'
  ) {
    return dreamerHomeHandler(
      request,
      response
    )
  }

  return response.status(404).json({
    error:
      'Ação do Sócio Sonhador não encontrada.',
  })
}
