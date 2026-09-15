import { logAdminAction } from './_admin-audit.js'
import crypto from 'node:crypto'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { neon } from '@neondatabase/serverless'
import { SignJWT } from 'jose'
import { isValidPin, normalizePin } from './_pin.js'

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
    const {
      username: rawUsername,
      name,
      password,
    } = request.body ?? {}

    const username =
      String(
        rawUsername ||
        name ||
        ''
      )
        .trim()
        .replace(/^@+/, '')
        .toLowerCase()

    const pin =
      normalizePin(password)

    if (!username) {
      return response.status(400).json({
        error:
          'Preencha seu usuário.',
      })
    }

    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.full_name,
        u.username,
        u.password_hash,
        u.user_type,
        u.active,
        p.name AS project
      FROM users u
      JOIN projects p
        ON p.id = u.project_id
      WHERE
        LOWER(u.username) =
          LOWER(${username})
      LIMIT 1
    `

    const user = users[0]

    if (!user || !user.active) {
      return response.status(401).json({
        error: 'Usuário ou PIN inválidos.',
      })
    }

    if (!user.password_hash) {
      return response.status(200).json({
        success: false,
        requiresPinSetup: true,
        user: {
          id:
            user.id,

          name:
            user.full_name ||
            user.name,

          full_name:
            user.full_name ||
            user.name,

          username:
            user.username,

          project:
            user.project,
        },
      })
    }

    /*
     * A partir daqui a conta já possui acesso.
     * Portanto, o PIN passa a ser obrigatório.
     */
    if (!pin) {
      return response.status(400).json({
        error: 'Informe seu PIN de acesso.',
      })
    }

    if (!isValidPin(pin)) {
      return response.status(400).json({
        error: 'O PIN deve ter exatamente 4 números.',
      })
    }

    const passwordIsValid = await verifyWerkzeugPassword(
      user.password_hash,
      pin
    )

    if (!passwordIsValid) {
      return response.status(401).json({
        error: 'Usuário ou PIN inválidos.',
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

    await logAdminAction({
      admin: user,
      action: 'user_login',
      entityType: 'session',
      entityId: user.id,
      projectId:
        user.project_id || null,
      details: {
        username:
          user.username || null,
        project:
          user.project || null,
        userType:
          user.user_type || null,
        teams:
          teams.map(
            (team) => team.code
          ),
      },
    })

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
