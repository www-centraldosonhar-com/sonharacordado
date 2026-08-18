import process from 'node:process'
import { jwtVerify } from 'jose'

function getCookie(request, cookieName) {
  const cookieHeader = request.headers.cookie || ''

  const cookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())

  const targetCookie = cookies.find((cookie) =>
    cookie.startsWith(`${cookieName}=`)
  )

  if (!targetCookie) {
    return null
  }

  return targetCookie.substring(
    cookieName.length + 1
  )
}

export async function getSessionUser(request) {
  const token = getCookie(
    request,
    'central_session'
  )

  if (!token) {
    return null
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET
    )

    const { payload } = await jwtVerify(
      token,
      secret
    )

    return payload
  } catch {
    return null
  }
}
