import process from 'node:process'

import { neon } from '@neondatabase/serverless'

import {
  requireDreamerUser,
} from './_dreamer-access.js'

const sql = neon(process.env.DATABASE_URL)

const ACTION_STATUSES = new Set([
  'draft',
  'published',
  'closed',
])

const SUPPORT_KINDS = new Set([
  'money',
  'product',
  'service',
  'mixed',
])

const PARTNER_TYPES = new Set([
  'partner',
  'sponsor',
  'supporter',
])

const STORY_STATUSES = new Set([
  'draft',
  'published',
])

function cleanText(value, maxLength = 4000) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function cleanOptionalDate(value) {
  const text = cleanText(value, 80)
  return text || null
}

function cleanBoolean(value) {
  return value === true || value === 1 || value === '1'
}

function cleanInteger(value, fallback = 0) {
  const number = Number(value)
  return Number.isInteger(number) ? number : fallback
}

async function getProjects() {
  return sql`
    SELECT id, name
    FROM projects
    WHERE UPPER(name) IN ('APS', 'PPF', 'SJ')
    ORDER BY id
  `
}

async function getPublicActions() {
  return sql`
    SELECT
      action.id,
      action.project_id,
      project.name AS project,
      action.title,
      action.summary,
      action.description,
      action.support_kind,
      action.need_label,
      action.contact_url,
      action.starts_at,
      action.ends_at,
      action.status,
      action.featured,
      action.created_at,
      action.updated_at
    FROM dreamer_support_actions action
    LEFT JOIN projects project
      ON project.id = action.project_id
    WHERE
      action.status = 'published'
      AND (
        action.starts_at IS NULL
        OR action.starts_at <= CURRENT_TIMESTAMP
      )
      AND (
        action.ends_at IS NULL
        OR action.ends_at >= CURRENT_TIMESTAMP
      )
    ORDER BY
      action.featured DESC,
      COALESCE(action.ends_at, TIMESTAMP '2999-12-31') ASC,
      action.created_at DESC
  `
}

async function getAdminActions() {
  return sql`
    SELECT
      action.id,
      action.project_id,
      project.name AS project,
      action.title,
      action.summary,
      action.description,
      action.support_kind,
      action.need_label,
      action.contact_url,
      action.starts_at,
      action.ends_at,
      action.status,
      action.featured,
      action.created_at,
      action.updated_at
    FROM dreamer_support_actions action
    LEFT JOIN projects project
      ON project.id = action.project_id
    ORDER BY
      action.featured DESC,
      action.created_at DESC,
      action.id DESC
  `
}

async function getPartners({ admin = false } = {}) {
  if (admin) {
    return sql`
      SELECT
        id,
        name,
        partner_type,
        description,
        support_summary,
        logo_url,
        website_url,
        active,
        featured,
        sort_order,
        created_at,
        updated_at
      FROM dreamer_partners
      ORDER BY
        featured DESC,
        sort_order ASC,
        name ASC
    `
  }

  return sql`
    SELECT
      id,
      name,
      partner_type,
      description,
      support_summary,
      logo_url,
      website_url,
      active,
      featured,
      sort_order
    FROM dreamer_partners
    WHERE active = 1
    ORDER BY
      featured DESC,
      sort_order ASC,
      name ASC
  `
}

async function getStories({ admin = false } = {}) {
  if (admin) {
    return sql`
      SELECT
        story.id, story.project_id, project.name AS project,
        story.title, story.summary, story.story_text, story.image_url,
        story.story_date, story.status, story.featured, story.sort_order,
        story.created_at, story.updated_at
      FROM dreamer_stories story
      LEFT JOIN projects project ON project.id = story.project_id
      ORDER BY story.featured DESC, story.sort_order ASC,
        COALESCE(story.story_date, story.created_at::date) DESC, story.id DESC
    `
  }

  return sql`
    SELECT
      story.id, story.project_id, project.name AS project,
      story.title, story.summary, story.story_text, story.image_url,
      story.story_date, story.featured, story.sort_order
    FROM dreamer_stories story
    LEFT JOIN projects project ON project.id = story.project_id
    WHERE story.status = 'published'
    ORDER BY story.featured DESC, story.sort_order ASC,
      COALESCE(story.story_date, story.created_at::date) DESC, story.id DESC
    LIMIT 12
  `
}

async function requireAdmin(currentUser, response) {
  if (!currentUser.isDreamerAdmin) {
    response.status(403).json({
      error: 'Apenas Admins do Sócio podem gerenciar ações e parceiros.',
    })
    return false
  }

  return true
}

function normalizeProjectId(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const projectId = Number(value)
  return Number.isInteger(projectId) && projectId > 0
    ? projectId
    : NaN
}

export default async function handler(request, response) {
  const currentUser = await requireDreamerUser(request)

  if (!currentUser) {
    return response.status(401).json({
      error: 'Você não possui acesso ao Sócio Sonhador.',
    })
  }

  try {
    if (request.method === 'GET') {
      const scope = cleanText(request.query?.scope, 40) || 'public'

      if (scope === 'admin') {
        if (!(await requireAdmin(currentUser, response))) return

        const [projects, actions, partners, stories] = await Promise.all([
          getProjects(),
          getAdminActions(),
          getPartners({ admin: true }),
          getStories({ admin: true }),
        ])

        return response.status(200).json({
          projects,
          actions,
          partners,
          stories,
        })
      }

      const [actions, partners, stories] = await Promise.all([
        getPublicActions(),
        getPartners(),
        getStories(),
      ])

      return response.status(200).json({
        actions,
        partners,
        stories,
      })
    }

    if (request.method !== 'POST') {
      return response.status(405).json({
        error: 'Método não permitido.',
      })
    }

    if (!(await requireAdmin(currentUser, response))) return

    const operation = cleanText(request.body?.operation, 60)

    if (operation === 'saveAction') {
      const id = cleanInteger(request.body?.id, 0)
      const title = cleanText(request.body?.title, 180)
      const summary = cleanText(request.body?.summary, 360)
      const description = cleanText(request.body?.description, 5000)
      const needLabel = cleanText(request.body?.needLabel, 180)
      const contactUrl = cleanText(request.body?.contactUrl, 1000)
      const startsAt = cleanOptionalDate(request.body?.startsAt)
      const endsAt = cleanOptionalDate(request.body?.endsAt)
      const projectId = normalizeProjectId(request.body?.projectId)
      const supportKind = cleanText(request.body?.supportKind, 40) || 'mixed'
      const status = cleanText(request.body?.status, 40) || 'draft'
      const featured = cleanBoolean(request.body?.featured) ? 1 : 0

      if (!title) {
        return response.status(400).json({ error: 'Informe o nome da ação.' })
      }

      if (Number.isNaN(projectId)) {
        return response.status(400).json({ error: 'Projeto inválido.' })
      }

      if (!SUPPORT_KINDS.has(supportKind)) {
        return response.status(400).json({ error: 'Tipo de apoio inválido.' })
      }

      if (!ACTION_STATUSES.has(status)) {
        return response.status(400).json({ error: 'Status da ação inválido.' })
      }

      if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
        return response.status(400).json({
          error: 'O encerramento não pode acontecer antes do início.',
        })
      }

      let rows

      if (id > 0) {
        rows = await sql`
          UPDATE dreamer_support_actions
          SET
            project_id = ${projectId},
            title = ${title},
            summary = ${summary},
            description = ${description},
            support_kind = ${supportKind},
            need_label = ${needLabel},
            contact_url = ${contactUrl},
            starts_at = ${startsAt},
            ends_at = ${endsAt},
            status = ${status},
            featured = ${featured},
            updated_by = ${currentUser.id},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id
        `
      } else {
        rows = await sql`
          INSERT INTO dreamer_support_actions (
            project_id,
            title,
            summary,
            description,
            support_kind,
            need_label,
            contact_url,
            starts_at,
            ends_at,
            status,
            featured,
            created_by,
            updated_by
          ) VALUES (
            ${projectId},
            ${title},
            ${summary},
            ${description},
            ${supportKind},
            ${needLabel},
            ${contactUrl},
            ${startsAt},
            ${endsAt},
            ${status},
            ${featured},
            ${currentUser.id},
            ${currentUser.id}
          )
          RETURNING id
        `
      }

      if (!rows.length) {
        return response.status(404).json({ error: 'Ação não encontrada.' })
      }

      return response.status(200).json({
        message: id > 0 ? 'Ação atualizada.' : 'Ação criada.',
        id: rows[0].id,
      })
    }

    if (operation === 'savePartner') {
      const id = cleanInteger(request.body?.id, 0)
      const name = cleanText(request.body?.name, 180)
      const partnerType = cleanText(request.body?.partnerType, 40) || 'partner'
      const description = cleanText(request.body?.description, 1800)
      const supportSummary = cleanText(request.body?.supportSummary, 360)
      const logoUrl = cleanText(request.body?.logoUrl, 1000)
      const websiteUrl = cleanText(request.body?.websiteUrl, 1000)
      const active = cleanBoolean(request.body?.active) ? 1 : 0
      const featured = cleanBoolean(request.body?.featured) ? 1 : 0
      const sortOrder = Math.max(-9999, Math.min(9999, cleanInteger(request.body?.sortOrder, 0)))

      if (!name) {
        return response.status(400).json({ error: 'Informe o nome do parceiro.' })
      }

      if (!PARTNER_TYPES.has(partnerType)) {
        return response.status(400).json({ error: 'Tipo de parceiro inválido.' })
      }

      let rows

      if (id > 0) {
        rows = await sql`
          UPDATE dreamer_partners
          SET
            name = ${name},
            partner_type = ${partnerType},
            description = ${description},
            support_summary = ${supportSummary},
            logo_url = ${logoUrl},
            website_url = ${websiteUrl},
            active = ${active},
            featured = ${featured},
            sort_order = ${sortOrder},
            updated_by = ${currentUser.id},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id
        `
      } else {
        rows = await sql`
          INSERT INTO dreamer_partners (
            name,
            partner_type,
            description,
            support_summary,
            logo_url,
            website_url,
            active,
            featured,
            sort_order,
            created_by,
            updated_by
          ) VALUES (
            ${name},
            ${partnerType},
            ${description},
            ${supportSummary},
            ${logoUrl},
            ${websiteUrl},
            ${active},
            ${featured},
            ${sortOrder},
            ${currentUser.id},
            ${currentUser.id}
          )
          RETURNING id
        `
      }

      if (!rows.length) {
        return response.status(404).json({ error: 'Parceiro não encontrado.' })
      }

      return response.status(200).json({
        message: id > 0 ? 'Parceiro atualizado.' : 'Parceiro criado.',
        id: rows[0].id,
      })
    }


    if (operation === 'saveStory') {
      const id = cleanInteger(request.body?.id, 0)
      const title = cleanText(request.body?.title, 180)
      const summary = cleanText(request.body?.summary, 420)
      const storyText = cleanText(request.body?.storyText, 6000)
      const imageUrl = cleanText(request.body?.imageUrl, 1000)
      const storyDate = cleanOptionalDate(request.body?.storyDate)
      const projectId = normalizeProjectId(request.body?.projectId)
      const status = cleanText(request.body?.status, 40) || 'draft'
      const featured = cleanBoolean(request.body?.featured) ? 1 : 0
      const sortOrder = Math.max(-9999, Math.min(9999, cleanInteger(request.body?.sortOrder, 0)))

      if (!title) return response.status(400).json({ error: 'Informe o título da história.' })
      if (!summary) return response.status(400).json({ error: 'Informe um resumo curto da história.' })
      if (Number.isNaN(projectId)) return response.status(400).json({ error: 'Projeto inválido.' })
      if (!STORY_STATUSES.has(status)) return response.status(400).json({ error: 'Status da história inválido.' })

      let rows
      if (id > 0) {
        rows = await sql`
          UPDATE dreamer_stories SET
            project_id = ${projectId}, title = ${title}, summary = ${summary},
            story_text = ${storyText}, image_url = ${imageUrl}, story_date = ${storyDate},
            status = ${status}, featured = ${featured}, sort_order = ${sortOrder},
            updated_by = ${currentUser.id}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id
        `
      } else {
        rows = await sql`
          INSERT INTO dreamer_stories (
            project_id, title, summary, story_text, image_url, story_date,
            status, featured, sort_order, created_by, updated_by
          ) VALUES (
            ${projectId}, ${title}, ${summary}, ${storyText}, ${imageUrl}, ${storyDate},
            ${status}, ${featured}, ${sortOrder}, ${currentUser.id}, ${currentUser.id}
          )
          RETURNING id
        `
      }

      if (!rows.length) return response.status(404).json({ error: 'História não encontrada.' })

      return response.status(200).json({
        message: id > 0 ? 'História atualizada.' : 'História criada.',
        id: rows[0].id,
      })
    }

    return response.status(400).json({
      error: 'Operação não reconhecida.',
    })
  } catch (error) {
    console.error('Dreamer community error:', error)
    return response.status(500).json({
      error: 'Não foi possível carregar a comunidade do Sócio Sonhador.',
    })
  }
}
