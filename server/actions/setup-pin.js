import process from 'node:process'
import { neon } from '@neondatabase/serverless'

import {
  isValidPin,
  normalizePin,
} from './_pin.js'

import {
  createWerkzeugHash,
} from './_password.js'

const sql = neon(process.env.DATABASE_URL)


export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  try {
    const {
      username: rawUsername,
      pin,
      confirmPin,
    } = request.body ?? {}

    const cleanUsername =
      String(
        rawUsername || ''
      )
        .trim()
        .replace(/^@+/, '')
        .toLowerCase()

    const cleanPin =
      normalizePin(pin)

    const cleanConfirmPin =
      normalizePin(confirmPin)


    if (!cleanUsername) {
      return response.status(400).json({
        error:
          'Informe seu usuário.',
      })
    }


    if (!isValidPin(cleanPin)) {
      return response.status(400).json({
        error:
          'O PIN deve ter exatamente 4 números.',
      })
    }


    if (cleanPin !== cleanConfirmPin) {
      return response.status(400).json({
        error:
          'Os PINs não são iguais.',
      })
    }


    /*
     * Localiza a pessoa usando a identidade
     * principal da Central:
     *
     * username
     */
    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.full_name,
        u.username,
        u.password_hash,
        p.name AS project
      FROM users u
      JOIN projects p
        ON p.id = u.project_id
      WHERE
        LOWER(u.username) =
          LOWER(${cleanUsername})
      LIMIT 1
    `

    const user = users[0]


    if (!user) {
      return response.status(404).json({
        error:
          'Usuário não encontrado.',
      })
    }


    /*
     * Proteção fundamental:
     *
     * setup-pin NÃO funciona para contas
     * que já possuem PIN.
     */
    if (user.password_hash) {
      return response.status(409).json({
        error:
          'Este acesso já possui um PIN.',
      })
    }


    const passwordHash =
      await createWerkzeugHash(
        cleanPin
      )


    /*
     * A condição password_hash IS NULL também
     * protege contra duas ativações simultâneas.
     */
    const updated = await sql`
      UPDATE users
      SET
        password_hash =
          ${passwordHash}
      WHERE id = ${user.id}
        AND password_hash IS NULL
      RETURNING id
    `


    if (!updated.length) {
      return response.status(409).json({
        error:
          'Este acesso já foi ativado.',
      })
    }


    return response.status(200).json({
      success: true,
      message:
        'PIN criado com sucesso.',
    })
  } catch (error) {
    console.error(
      'SETUP PIN ERROR:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível criar seu PIN.',
    })
  }
}
