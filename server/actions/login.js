import crypto from 'node:crypto'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { neon } from '@neondatabase/serverless'
import { SignJWT } from 'jose'

const sql = neon(process.env.DATABASE_URL)

function timingSafeEqualHex(a, b) {
  try {
    const bufferA = Buffer.from(a, 'hex')
    const bufferB = Buffer.from(b, 'hex')

    if (bufferA.length !== bufferB.length) {
      return false
    }

    return crypto.timingSafeEqual(bufferA, bufferB)
  } catch {
    return false
  }
}

async function verifyWerkzeugPassword(storedHash, password) {
  if (!storedHash || !password) {
    return false
  }

  const parts = storedHash.split('$')

  if (parts.length !== 3) {
    return false
  }

  const [method, salt, expectedHash] = parts
  const methodParts = method.split(':')
  const algorithm = methodParts[0]

  if (algorithm === 'scrypt') {
    const n = Number(methodParts[1] || 32768)
    const r = Number(methodParts[2] || 8)
    const p = Number(methodParts[3] || 1)

    const derivedKey = await new Promise((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        64,
        {
          N: n,
          r,
          p,
          maxmem: 132 * n * r * p,
        },
        (error, key) => {
          if (error) {
            reject(error)
            return
          }

          resolve(key)
        }
      )
    })

    return timingSafeEqualHex(
      derivedKey.toString('hex'),
      expectedHash
    )
  }

  if (algorithm === 'pbkdf2') {
    const hashAlgorithm = methodParts[1] || 'sha256'
    const iterations = Number(methodParts[2])

    if (!iterations) {
      return false
    }

    const expectedLength = Buffer.from(
      expectedHash,
      'hex'
    ).length

    const derivedKey = await new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        iterations,
        expectedLength,
        hashAlgorithm,
        (error, key) => {
          if (error) {
            reject(error)
            return
          }

          resolve(key)
        }
      )
    })

    return timingSafeEqualHex(
      derivedKey.toString('hex'),
      expectedHash
    )
  }

  return false
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  try {
    const { name, project, password } = request.body ?? {}

    if (!name || !project || !password) {
      return response.status(400).json({
        error: 'Preencha usuário, projeto e senha.',
      })
    }

    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.password_hash,
        u.user_type,
        u.active,
        p.name AS project
      FROM users u
      JOIN projects p
        ON p.id = u.project_id
      WHERE LOWER(u.name) = LOWER(${name})
        AND LOWER(p.name) = LOWER(${project})
      LIMIT 1
    `

    const user = users[0]

    if (!user || !user.active) {
      return response.status(401).json({
        error: 'Usuário, projeto ou senha inválidos.',
      })
    }

    const passwordIsValid = await verifyWerkzeugPassword(
      user.password_hash,
      password
    )

    if (!passwordIsValid) {
      return response.status(401).json({
        error: 'Usuário, projeto ou senha inválidos.',
      })
    }

    const permissions = await sql`
      SELECT
        permission,
        admin_scope
      FROM user_permissions
      WHERE user_id = ${user.id}
        AND active = 1
      ORDER BY permission
    `

    const teams = await sql`
      SELECT
        t.code,
        t.name
      FROM user_teams ut
      JOIN teams t
        ON ut.team_id = t.id
      WHERE ut.user_id = ${user.id}
        AND ut.active = 1
        AND t.active = 1
      ORDER BY t.name
    `

    const permissionNames =
      permissions.map(
        (item) =>
          item.permission
      )

    const adminPermission =
      permissions.find(
        (item) =>
          item.permission === 'admin'
      )

    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET
    )

    const token = await new SignJWT({
      userId: user.id,
      name: user.name,
      project: user.project,
      userType: user.user_type,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(secret)

    response.setHeader(
      'Set-Cookie',
      [
        `central_session=${token}`,
        'HttpOnly',
        'Path=/',
        'SameSite=Lax',
        'Max-Age=28800',
        process.env.NODE_ENV === 'production'
          ? 'Secure'
          : '',
      ]
        .filter(Boolean)
        .join('; ')
    )

    return response.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        project: user.project,
        userType: user.user_type,
        permissions:
          permissionNames,
        adminScope:
          adminPermission?.admin_scope ||
          null,
        teams,
      },
    })
  } catch (error) {
    console.error('Login error:', error)

    return response.status(500).json({
      error: 'Não foi possível entrar agora.',
    })
  }
}
