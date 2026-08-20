import financeHandler from '../server/actions/finance.js'

export default async function handler(
  request,
  response
) {
  return financeHandler(
    request,
    response
  )
}
