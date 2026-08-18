import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

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

  const { participationId } = request.body ?? {}

  if (!participationId) {
    return response.status(400).json({
      error: 'Participação inválida.',
    })
  }

  try {
    const participations = await sql`
      SELECT
        tu.id,
        tu.status,
        t.title
      FROM task_users tu
      JOIN tasks t
        ON tu.task_id = t.id
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
        error: 'Participação não encontrada.',
      })
    }

    await sql`
      UPDATE task_users
      SET status = 'left'
      WHERE id = ${participation.id}
        AND user_id = ${sessionUser.userId}
    `

    return response.status(200).json({
      success: true,
      message: 'Você saiu dessa missão.',
    })
  } catch (error) {
    console.error('Leave task error:', error)

    return response.status(500).json({
      error:
        'Não foi possível sair dessa missão.',
    })
  }
}
