import crypto from 'node:crypto'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql =
  neon(process.env.DATABASE_URL)

function createWerkzeugHash(password) {
  return new Promise(
    (resolve, reject) => {
      const salt =
        crypto
          .randomBytes(8)
          .toString('hex')

      crypto.scrypt(
        password,
        salt,
        64,
        {
          N: 32768,
          r: 8,
          p: 1,
          maxmem:
            132 * 32768 * 8,
        },
        (error, key) => {
          if (error) {
            reject(error)
            return
          }

          resolve(
            `scrypt:32768:8:1$${salt}$${key.toString('hex')}`
          )
        }
      )
    }
  )
}

function validUsername(value) {
  return /^[A-Za-zÀ-ÿ0-9._-]{3,30}$/
    .test(value)
}

export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error:
        'Método não permitido.',
    })
  }

  try {
    const {
      name,
      project,
      password,
    } = request.body ?? {}

    const cleanName =
      typeof name === 'string'
        ? name.trim()
        : ''

    if (
      !validUsername(cleanName)
    ) {
      return response.status(400).json({
        error:
          'Use um nome de usuário com 3 a 30 caracteres, sem espaços.',
      })
    }

    if (
      typeof password !== 'string' ||
      password.length < 4
    ) {
      return response.status(400).json({
        error:
          'A senha precisa ter pelo menos 4 caracteres.',
      })
    }

    if (
      !['APS', 'PPF', 'SJ']
        .includes(project)
    ) {
      return response.status(400).json({
        error:
          'Escolha um projeto válido.',
      })
    }

    const projectRows = await sql`
      SELECT id
      FROM projects
      WHERE UPPER(name) =
        UPPER(${project})
      LIMIT 1
    `

    const projectId =
      projectRows[0]?.id

    if (!projectId) {
      return response.status(400).json({
        error:
          'Projeto não encontrado.',
      })
    }

    const existing = await sql`
      SELECT id
      FROM users
      WHERE LOWER(name) =
        LOWER(${cleanName})
        AND project_id =
          ${projectId}
      LIMIT 1
    `

    if (existing[0]) {
      return response.status(409).json({
        error:
          'Esse usuário já existe nesse projeto.',
      })
    }

    const passwordHash =
      await createWerkzeugHash(
        password
      )

    const created = await sql`
      INSERT INTO users (
        name,
        project_id,
        password_hash,
        user_type,
        active
      )
      VALUES (
        ${cleanName},
        ${projectId},
        ${passwordHash},
        'external',
        1
      )
      RETURNING id
    `

    const userId =
      created[0].id

    await sql`
      INSERT INTO user_permissions (
        user_id,
        permission,
        admin_scope,
        active
      )
      VALUES (
        ${userId},
        'dreamer',
        NULL,
        1
      )
    `

    return response.status(201).json({
      success: true,
      message:
        'Conta criada! Agora você já pode entrar no Espaço Sócio Sonhador. ❤️',
    })
  } catch (error) {
    console.error(
      'External registration error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível criar sua conta agora.',
    })
  }
}
