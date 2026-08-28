import dreamerHomeHandler from '../server/actions/dreamer-home.js'
import dreamerFrequencyHandler from '../server/actions/dreamer-frequency.js'
import dreamerTeamHandler from '../server/actions/dreamer-team.js'
import dreamerFundraisingHandler from '../server/actions/dreamer-fundraising.js'

export default async function handler(
  request,
  response
) {
  const action =
    request.query?.action

  if (action === 'team') {
    return dreamerTeamHandler(
      request,
      response
    )
  }

  if (action === 'fundraising') {
    return dreamerFundraisingHandler(
      request,
      response
    )
  }

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
