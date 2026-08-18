import process from 'node:process'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  response.setHeader(
    'Set-Cookie',
    [
      'central_session=',
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      'Max-Age=0',
      process.env.NODE_ENV === 'production'
        ? 'Secure'
        : '',
    ]
      .filter(Boolean)
      .join('; ')
  )

  return response.status(200).json({
    success: true,
  })
}
