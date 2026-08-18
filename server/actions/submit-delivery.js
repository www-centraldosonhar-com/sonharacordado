import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

function isValidHttpUrl(value) {
  try {
    const url = new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const sessionUser = await getSessionUser(request)

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error: 'Sessão inválida ou expirada.',
    })
  }

  const {
    participationId,
    deliveryLink,
  } = request.body ?? {}

  const cleanLink = deliveryLink?.trim()

  if (!participationId || !cleanLink) {
    return response.status(400).json({
      error: 'Informe o link da sua entrega.',
    })
  }

  if (!isValidHttpUrl(cleanLink)) {
    return response.status(400).json({
      error:
        'Informe um link válido começando com http:// ou https://.',
    })
  }

  try {
    const participations = await sql`
      SELECT
        tu.id,
        tu.status
      FROM task_users tu
      WHERE tu.id = ${participationId}
        AND tu.user_id = ${sessionUser.userId}
      LIMIT 1
    `

    const participation = participations[0]

    if (
      !participation ||
      participation.status !== 'active'
    ) {
      return response.status(404).json({
        error: 'Missão não encontrada.',
      })
    }

    await sql`
      UPDATE task_users
      SET
        delivery_link = ${cleanLink},
        submitted_at = CURRENT_TIMESTAMP
      WHERE id = ${participation.id}
        AND user_id = ${sessionUser.userId}
    `

    return response.status(200).json({
      success: true,
      message: 'Entrega salva! Obrigado por somar ❤️',
    })
  } catch (error) {
    console.error('Submit delivery error:', error)

    return response.status(500).json({
      error: 'Não foi possível salvar sua entrega.',
    })
  }
}
