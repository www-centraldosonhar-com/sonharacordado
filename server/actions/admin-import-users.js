import {
  isGlobalAdmin,
  isProjectAdmin,
  isVolunteerTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'

import {
  normalizeFullName,
  createCentralName,
  createAlternativeCentralName,
  createUniqueUsername,
  normalizeProject,
  normalizeEmail,
  normalizePhone,
  normalizeBirthDate,
} from './_people-import.js'


function forbidden(response) {
  return response.status(403).json({
    error:
      'Você não possui permissão para importar voluntários.',
  })
}


/*
 * Importação de voluntários:
 *
 * Global Admin
 *   → qualquer projeto
 *
 * Project Admin
 *   → somente seu projeto
 *
 * Volunteer Team Admin
 *   → somente seu projeto
 *
 * Outros admins
 *   → sem acesso
 */
function canImportVolunteers(admin) {
  return (
    isGlobalAdmin(admin) ||
    isProjectAdmin(admin) ||
    isVolunteerTeamAdmin(admin)
  )
}


function validDate(value) {
  if (!value) {
    return true
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value).trim()
  )
}


export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const admin =
    await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error:
        'Acesso administrativo não autorizado.',
    })
  }

  if (!canImportVolunteers(admin)) {
    return forbidden(response)
  }

  const {
    action = 'preview',
    rows = [],
  } = request.body ?? {}

  if (
    action !== 'preview' &&
    action !== 'import'
  ) {
    return response.status(400).json({
      error:
        'Ação de importação inválida.',
    })
  }

  if (!Array.isArray(rows)) {
    return response.status(400).json({
      error:
        'Formato de importação inválido.',
    })
  }

  if (rows.length === 0) {
    return response.status(400).json({
      error:
        'O arquivo não possui voluntários.',
    })
  }

  if (rows.length > 1000) {
    return response.status(400).json({
      error:
        'O limite é de 1000 voluntários por importação.',
    })
  }


  // ========================================================
  // PROJETOS REAIS
  // ========================================================

  const projects = await sql`
    SELECT
      id,
      name
    FROM projects
    ORDER BY name
  `

  const projectMap =
    new Map(
      projects.map((project) => [
        normalizeProject(project.name),
        project,
      ])
    )


  // ========================================================
  // USUÁRIOS EXISTENTES
  // ========================================================

  const existingUsers = await sql`
    SELECT
      id,
      name,
      username,
      full_name,
      email,
      phone,
      project_id
    FROM users
  `


  const usedUsernames =
    existingUsers
      .map(
        (user) =>
          String(
            user.username || ''
          ).trim()
      )
      .filter(Boolean)


  const preview = []

  /*
   * Também rastreamos o próprio arquivo.
   * Assim duas linhas do mesmo CSV não conseguem passar
   * silenciosamente com o mesmo login/e-mail/telefone.
   */
  const csvNames = new Map()
  const csvEmails = new Map()
  const csvPhones = new Map()


  // ========================================================
  // ANALISA CADA LINHA
  // ========================================================

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index] ?? {}

    const fullName =
      normalizeFullName(
        row.full_name ||
        row.fullName ||
        row.name
      )

    const projectName =
      normalizeProject(
        row.project
      )

    const email =
      normalizeEmail(
        row.email
      )

    const phone =
      normalizePhone(
        row.phone
      )

    const birthDate =
      normalizeBirthDate(
        row.birth_date ||
        row.birthDate ||
        ''
      )

    const allergies =
      String(
        row.allergies || ''
      ).trim()


    const errors = []
    const warnings = []


    // ------------------------------------------------------
    // NOME COMPLETO
    // ------------------------------------------------------

    const nameParts =
      fullName
        .split(' ')
        .filter(Boolean)

    if (!fullName) {
      errors.push(
        'Nome completo obrigatório.'
      )
    } else if (nameParts.length < 2) {
      errors.push(
        'Informe nome e sobrenome.'
      )
    }


    // ------------------------------------------------------
    // PROJETO
    // ------------------------------------------------------

    const project =
      projectMap.get(projectName)

    if (!projectName) {
      errors.push(
        'Projeto obrigatório.'
      )
    } else if (!project) {
      errors.push(
        `Projeto "${projectName}" não existe.`
      )
    }


    /*
     * Admin de Projeto e Admin de Voluntários
     * só podem importar para o próprio projeto.
     */
    if (
      project &&
      !isGlobalAdmin(admin) &&
      Number(project.id) !==
        Number(admin.projectId)
    ) {
      errors.push(
        'Você não pode importar voluntários para este projeto.'
      )
    }



    // ------------------------------------------------------
    // NASCIMENTO
    // ------------------------------------------------------

    if (!validDate(birthDate)) {
      errors.push(
        'Nascimento deve estar no formato AAAA-MM-DD.'
      )
    }


    // ------------------------------------------------------
    // NOME DA CENTRAL
    // ------------------------------------------------------

    let centralName =
      createCentralName(fullName)

    const username =
      createUniqueUsername(
        fullName,
        usedUsernames
      )

    usedUsernames.push(
      username
    )

    if (project) {
      const collision =
        existingUsers.find(
          (user) =>
            Number(user.project_id) ===
              Number(project.id) &&
            String(user.name)
              .trim()
              .toLowerCase() ===
            centralName
              .trim()
              .toLowerCase()
        )

      if (collision) {
        const alternative =
          createAlternativeCentralName(
            fullName
          )

        warnings.push(
          `O nome "${centralName}" já existe neste projeto. Sugestão: "${alternative}".`
        )

        centralName = alternative
      }
    }


    // ------------------------------------------------------
    // E-MAIL
    // ------------------------------------------------------

    if (email) {
      const duplicateEmail =
        existingUsers.find(
          (user) =>
            normalizeEmail(
              user.email
            ) === email
        )

      if (duplicateEmail) {
        errors.push(
          'E-mail já pertence a outro usuário.'
        )
      }
    }


    // ------------------------------------------------------
    // TELEFONE
    // ------------------------------------------------------

    if (phone) {
      const duplicatePhone =
        existingUsers.find(
          (user) =>
            normalizePhone(
              user.phone
            ) === phone
        )

      if (duplicatePhone) {
        warnings.push(
          'Telefone já aparece em outro cadastro.'
        )
      }
    }


    // ------------------------------------------------------
    // DUPLICIDADES DENTRO DO PRÓPRIO CSV
    // ------------------------------------------------------

    if (project && centralName) {
      const nameKey =
        `${project.id}:${centralName.toLowerCase()}`

      if (csvNames.has(nameKey)) {
        errors.push(
          `Nome de acesso também aparece na linha ${csvNames.get(nameKey)} deste CSV.`
        )
      } else {
        csvNames.set(
          nameKey,
          index + 2
        )
      }
    }

    if (email) {
      if (csvEmails.has(email)) {
        errors.push(
          `E-mail repetido na linha ${csvEmails.get(email)} deste CSV.`
        )
      } else {
        csvEmails.set(
          email,
          index + 2
        )
      }
    }

    if (phone) {
      if (csvPhones.has(phone)) {
        warnings.push(
          `Telefone também aparece na linha ${csvPhones.get(phone)} deste CSV.`
        )
      } else {
        csvPhones.set(
          phone,
          index + 2
        )
      }
    }


    preview.push({
      row:
        index + 2,

      full_name:
        fullName,

      name:
        centralName,

      username,

      project:
        project?.name || projectName,

      project_id:
        project?.id || null,

      email:
        email || null,

      phone:
        phone || null,

      birth_date:
        birthDate || null,

      allergies:
        allergies || null,

      status:
        errors.length
          ? 'error'
          : warnings.length
            ? 'warning'
            : 'ready',

      errors,
      warnings,
    })
  }


  const summary = {
    total:
      preview.length,

    ready:
      preview.filter(
        (item) =>
          item.status === 'ready'
      ).length,

    warnings:
      preview.filter(
        (item) =>
          item.status === 'warning'
      ).length,

    errors:
      preview.filter(
        (item) =>
          item.status === 'error'
      ).length,
  }


  if (action === 'preview') {
    return response.status(200).json({
      success: true,
      summary,
      rows: preview,
    })
  }


  // ========================================================
  // IMPORTAÇÃO REAL
  //
  // Só entra quem não possui erro.
  // Warnings são permitidos.
  // password_hash fica NULL para o fluxo de primeiro acesso.
  // ========================================================

  const validRows =
    preview.filter(
      (person) =>
        person.status !== 'error'
    )


  if (!validRows.length) {
    return response.status(400).json({
      error:
        'Nenhum voluntário válido para importar.',
      summary,
      rows: preview,
    })
  }


  const importedUsers = []
  const skippedUsers = []


  for (const person of validRows) {
    /*
     * Revalidação final de duplicidade antes do INSERT.
     */
    const duplicates = await sql`
      SELECT
        id,
        name,
        email
      FROM users
      WHERE project_id =
        ${person.project_id}
        AND (
          LOWER(name) =
            LOWER(${person.name})
          OR (
            email IS NOT NULL
            AND ${person.email || null}::text IS NOT NULL
            AND LOWER(email) =
              LOWER(${person.email || null}::text)
          )
        )
      LIMIT 1
    `


    if (duplicates.length) {
      skippedUsers.push({
        row:
          person.row,

        full_name:
          person.full_name,

        name:
          person.name,

        project:
          person.project,

        reason:
          'Usuário já existe ou possui e-mail duplicado.',
      })

      continue
    }


    const created = await sql`
      INSERT INTO users (
        name,
        username,
        full_name,
        project_id,
        email,
        phone,
        birth_date,
        allergies,
        password_hash,
        user_type,
        active
      )
      VALUES (
        ${person.name},
        ${person.username},
        ${person.full_name},
        ${person.project_id},
        ${person.email || null},
        ${person.phone || null},
        ${person.birth_date || null},
        ${person.allergies || null},
        NULL,
        'volunteer',
        1
      )
      RETURNING
        id,
        name,
        username,
        full_name,
        project_id
    `


    importedUsers.push({
      ...created[0],

      row:
        person.row,

      project:
        person.project,
    })
  }


  return response.status(200).json({
    success: true,

    message:
      `${importedUsers.length} voluntários importados com sucesso.`,

    imported:
      importedUsers.length,

    skipped:
      skippedUsers.length,

    importedUsers,
    skippedUsers,
  })
}
