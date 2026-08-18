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

  const sessionUser = await getSessionUser(
    request
  )

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error: 'Sessão inválida ou expirada.',
    })
  }

  const {
    taskId,
  } = request.body ?? {}

  if (!taskId) {
    return response.status(400).json({
      error: 'Missão inválida.',
    })
  }

  try {
    const tasks = await sql`
      SELECT
        id,
        title,
        deadline,
        volunteer_limit,
        active,
        status
      FROM tasks
      WHERE id = ${taskId}
      LIMIT 1
    `

    const task = tasks[0]

    if (
      !task ||
      !task.active ||
      task.status === 'completed'
    ) {
      return response.status(400).json({
        error: 'Essa missão não está disponível.',
      })
    }

    if (
      new Date(task.deadline) <
      new Date()
    ) {
      return response.status(400).json({
        error: 'O prazo dessa missão já encerrou.',
      })
    }

    const existing = await sql`
      SELECT
        id,
        status
      FROM task_users
      WHERE task_id = ${taskId}
        AND user_id = ${sessionUser.userId}
      LIMIT 1
    `

    if (
      existing[0]?.status === 'active'
    ) {
      return response.status(409).json({
        error: 'Você já está nessa missão.',
      })
    }

    const counts = await sql`
      SELECT COUNT(*)::int AS total
      FROM task_users
      WHERE task_id = ${taskId}
        AND status = 'active'
    `

    const participantCount =
      Number(counts[0]?.total || 0)

    if (
      participantCount >=
      Number(task.volunteer_limit)
    ) {
      return response.status(409).json({
        error: 'Essa missão já encontrou seu time.',
      })
    }

    if (existing[0]) {
      await sql`
        UPDATE task_users
        SET
          status = 'active',
          delivery_link = NULL,
          submitted_at = NULL
        WHERE id = ${existing[0].id}
      `
    } else {
      await sql`
        INSERT INTO task_users (
          task_id,
          user_id,
          status
        )
        VALUES (
          ${taskId},
          ${sessionUser.userId},
          'active'
        )
      `
    }

    return response.status(200).json({
      success: true,
      message: `Você entrou na missão "${task.title}"! ✨`,
    })
  } catch (error) {
    console.error(
      'Join task error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível entrar nessa missão.',
    })
  }
}
