import dreamerHomeHandler from '../server/actions/dreamer-home.js'
import dreamerFrequencyHandler from '../server/actions/dreamer-frequency.js'
import dreamerTeamHandler from '../server/actions/dreamer-team.js'
import dreamerFundraisingHandler from '../server/actions/dreamer-fundraising.js'
import dreamerMissionsHandler from '../server/actions/dreamer-missions.js'
import dreamerReferralsHandler from '../server/actions/dreamer-referrals.js'
import dreamerCommunityHandler from '../server/actions/dreamer-community.js'
import dreamerContributionsHandler from '../server/actions/dreamer-contributions.js'
import dreamerClosureHandler from '../server/actions/dreamer-closure.js'
import dreamerAchievementsHandler from '../server/actions/dreamer-achievements.js'

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

  if (action === 'missions') {
    return dreamerMissionsHandler(
      request,
      response
    )
  }

  if (action === 'referrals') {
    return dreamerReferralsHandler(
      request,
      response
    )
  }

  if (action === 'contributions') {
    return dreamerContributionsHandler(
      request,
      response
    )
  }

  if (action === 'closure') {
    return dreamerClosureHandler(
      request,
      response
    )
  }

  if (action === 'achievements') {
    return dreamerAchievementsHandler(
      request,
      response
    )
  }

  if (action === 'community') {
    return dreamerCommunityHandler(
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
