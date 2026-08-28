import process from 'node:process'
import { neon } from '@neondatabase/serverless'

import {
  requireDreamerUser,
} from './_dreamer-access.js'

const sql = neon(process.env.DATABASE_URL)

const ALLOWED_PROJECTS = ['APS', 'PPF', 'SJ']

export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Método não permitido.',
    })
  }

  const currentUser = await requireDreamerUser(request)

  if (!currentUser) {
    return response.status(401).json({
      error: 'Você não possui acesso ao Sócio Sonhador.',
    })
  }

  // Voluntários internos já pertencem ao projeto da Central.
  // O time do Sócio não deve alterar esse vínculo operacional.
  if (currentUser.permissions.includes('volunteer')) {
    return response.status(403).json({
      error: 'Seu time no Sócio acompanha o seu projeto da Central.',
    })
  }

  if (currentUser.dreamerProfile?.preferred_project_id) {
    return response.status(409).json({
      error: 'Seu time de apoio já foi escolhido.',
    })
  }

  const projectCode = String(
    request.body?.project || ''
  ).toUpperCase()

  if (!ALLOWED_PROJECTS.includes(projectCode)) {
    return response.status(400).json({
      error: 'Escolha APS, PPF ou SJ.',
    })
  }

  try {
    const projects = await sql`
      SELECT id, name
      FROM projects
      WHERE UPPER(name) = UPPER(${projectCode})
      LIMIT 1
    `

    const project = projects[0]

    if (!project) {
      return response.status(404).json({
        error: 'Projeto não encontrado.',
      })
    }

    const profiles = await sql`
      INSERT INTO dreamer_profiles (
        user_id,
        preferred_project_id,
        active,
        updated_at
      )
      VALUES (
        ${currentUser.id},
        ${project.id},
        1,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        preferred_project_id = EXCLUDED.preferred_project_id,
        active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE dreamer_profiles.preferred_project_id IS NULL
      RETURNING
        id,
        preferred_project_id,
        joined_at
    `

    const profile = profiles[0]

    if (!profile) {
      return response.status(409).json({
        error: 'Seu time de apoio já foi escolhido.',
      })
    }

    return response.status(200).json({
      success: true,
      message: `${project.name} agora é o seu time no Sócio Sonhador. ❤️`,
      dreamerProfile: {
        ...profile,
        preferred_project: project.name,
      },
    })
  } catch (error) {
    console.error('Dreamer team error:', error)

    return response.status(500).json({
      error: 'Não foi possível salvar seu time agora.',
    })
  }
}
