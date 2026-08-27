import {
  isGlobalAdmin,
  isProjectAdmin,
  isTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'

import {
  normalizeFullName,
  normalizeProject,
  normalizePhone,
  normalizeBirthDate,
} from './_people-import.js'


// =========================================================
// ACCESS
// =========================================================
//
// Admin Geral
//   → todos os projetos
//
// Admin de Projeto
//   → próprio projeto
//
// Admin da Equipe Assistidos
//   → próprio projeto
//
// Demais Admins
//   → sem acesso
//
// =========================================================

function isAssistedTeamAdmin(admin) {
  return (
    isTeamAdmin(admin) &&
    (
      admin?.teams || []
    ).some(
      team =>
        team.code === 'assisted'
    )
  )
}


function canManageAssisted(admin) {
  return (
    isGlobalAdmin(admin) ||
    isProjectAdmin(admin) ||
    isAssistedTeamAdmin(admin)
  )
}


function canAccessProject(
  admin,
  projectId
) {
  if (isGlobalAdmin(admin)) {
    return true
  }

  return (
    Number(projectId) ===
    Number(admin.projectId)
  )
}


function validDate(value) {
  if (!value) {
    return true
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value)
  )
}


function meaningfulAnswers(...answers) {
  const ignoredAnswers = new Set([
    'nao',
    'nao informado',
    'nao se aplica',
    'nenhum',
    'nenhuma',
    'n/a',
    'na',
    'sem',
  ])

  return answers
    .map(
      answer => String(answer || '').trim()
    )
    .filter(
      answer => {
        const normalized =
          answer
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[.!?]+$/g, '')

        return (
          normalized &&
          !ignoredAnswers.has(normalized)
        )
      }
    )
    .join(' • ')
}

const OFFICIAL_DEPARTURE_HEADER =
  'no_final_do_encontro_do_aps_como_a_crianca_ira_embora_para_casa'


// =========================================================
// NORMALIZE IMPORT ROW
// =========================================================

function normalizeRow(row) {
  return {
    fullName:
      normalizeFullName(
        row.full_name ||
        row.fullName ||
        row.nome_completo ||
        row.name
      ),

    birthDate:
      normalizeBirthDate(
        row.birth_date ||
        row.birthDate ||
        row.data_nascimento ||
        ''
      ),

    allergies:
      meaningfulAnswers(
        row.allergies,
        row.allergy,
        row.a_crianca_tem_alergia,
        row.a_crianca_tem_alergia_a_algum_medicamento,
        row.possui_alguma_restricao_alimentar_ou_alergia_a_alimentos
      ),

    notes:
      meaningfulAnswers(
        row.notes,
        row.observations,
        row.observacoes,
        row.possui_alguma_condicao_de_saude_necessidade_especial_restricao_ou_laudo_medico,
        row.a_equipe_precisa_prestar_atencao_especial_em_mais_algum_ponto
      ),

    departureMethod:
      String(
        row[OFFICIAL_DEPARTURE_HEADER] ||
        row.departure_method ||
        row.departureMethod ||
        row.forma_saida ||
        row.forma_de_saida ||
        row.forma_de_saida_para_casa ||
        row.saida_para_casa ||
        row.como_a_crianca_ira_embora_para_casa ||
        row.how_child_goes_home ||
        ''
      ).trim(),

    guardianName:
      normalizeFullName(
        row.guardian_name ||
        row.guardianName ||
        row.responsible_name ||
        row.nome_completo_responsavel ||
        row.responsavel ||
        ''
      ),

    guardianPhone:
      normalizePhone(
        row.guardian_phone ||
        row.guardianPhone ||
        row.responsible_phone ||
        row.telefone ||
        row.telefone_responsavel ||
        ''
      ),

    projectName:
      normalizeProject(
        row.project ||
        row.projeto ||
        ''
      ),
  }
}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  request,
  response
) {
  const admin =
    await requireAdmin(request)

  if (
    !admin ||
    !canManageAssisted(admin)
  ) {
    return response.status(403).json({
      error:
        'Você não possui permissão para gerenciar Assistidos.',
    })
  }


  // =======================================================
  // LIST
  // =======================================================

  if (request.method === 'GET') {
    const rows =
      await sql`
        SELECT
          assisted.id,

          assisted.full_name,
          assisted.birth_date,
          assisted.allergies,
          assisted.notes,
          assisted.departure_method,

          assisted.guardian_name,
          assisted.guardian_phone,

          assisted.project_id,

          project.name
            AS project_name,

          assisted.active,

          assisted.created_at,
          assisted.updated_at

        FROM assisted_people assisted

        JOIN projects project
          ON project.id =
            assisted.project_id

        WHERE
          (
            ${isGlobalAdmin(admin)}
            OR assisted.project_id =
              ${admin.projectId}
          )

        ORDER BY
          assisted.active DESC,
          assisted.full_name
      `

    return response.status(200).json({
      assisted: rows,
    })
  }


  if (request.method !== 'POST') {
    return response.status(405).json({
      error:
        'Method not allowed.',
    })
  }


  const {
    operation,
    rows = [],
    projectId,
  } = request.body ?? {}


  // =======================================================
  // UPDATE ASSISTED PERSON
  // =======================================================

  if (operation === 'update') {
    const body =
      request.body ?? {}

    const personId =
      Number(body.personId)

    if (
      !Number.isInteger(personId) ||
      personId <= 0
    ) {
      return response.status(400).json({
        error:
          'Assistido inválido.',
      })
    }

    const currentRows =
      await sql`
        SELECT
          id,
          project_id

        FROM assisted_people

        WHERE id =
          ${personId}

        LIMIT 1
      `

    const current =
      currentRows[0]

    if (!current) {
      return response.status(404).json({
        error:
          'Assistido não encontrado.',
      })
    }

    if (
      !canAccessProject(
        admin,
        current.project_id
      )
    ) {
      return response.status(403).json({
        error:
          'Você não possui acesso a este Assistido.',
      })
    }

    const fullName =
      normalizeFullName(
        body.fullName ||
        ''
      )

    const birthDate =
      normalizeBirthDate(
        body.birthDate ||
        ''
      )

    const allergies =
      String(
        body.allergies ||
        ''
      ).trim()

    const notes =
      String(
        body.notes ||
        ''
      ).trim()

    const guardianName =
      normalizeFullName(
        body.guardianName ||
        ''
      )

    const guardianPhone =
      normalizePhone(
        body.guardianPhone ||
        ''
      )

    const departureMethod =
      String(
        body.departureMethod ||
        ''
      ).trim()

    let targetProjectId =
      Number(
        body.projectId ||
        current.project_id
      )

    if (
      !fullName ||
      fullName
        .split(' ')
        .filter(Boolean)
        .length < 2
    ) {
      return response.status(400).json({
        error:
          'Informe nome e sobrenome do Assistido.',
      })
    }

    if (
      birthDate &&
      !validDate(birthDate)
    ) {
      return response.status(400).json({
        error:
          'Data de nascimento inválida.',
      })
    }

    if (!guardianName) {
      return response.status(400).json({
        error:
          'Nome do responsável obrigatório.',
      })
    }

    if (!guardianPhone) {
      return response.status(400).json({
        error:
          'Telefone do responsável obrigatório.',
      })
    }

    if (
      !Number.isInteger(
        targetProjectId
      ) ||
      targetProjectId <= 0
    ) {
      return response.status(400).json({
        error:
          'Projeto inválido.',
      })
    }

    if (!isGlobalAdmin(admin)) {
      if (
        Number(targetProjectId) !==
        Number(current.project_id)
      ) {
        return response.status(403).json({
          error:
            'Você não pode mover este Assistido para outro projeto.',
        })
      }

      targetProjectId =
        Number(
          current.project_id
        )
    }

    if (
      !canAccessProject(
        admin,
        targetProjectId
      )
    ) {
      return response.status(403).json({
        error:
          'Você não pode vincular este Assistido a este projeto.',
      })
    }

    const projectRows =
      await sql`
        SELECT id
        FROM projects
        WHERE id =
          ${targetProjectId}
        LIMIT 1
      `

    if (!projectRows.length) {
      return response.status(400).json({
        error:
          'Projeto não encontrado.',
      })
    }

    await sql`
      UPDATE assisted_people

      SET
        full_name =
          ${fullName},

        birth_date =
          ${birthDate || null},

        allergies =
          ${allergies},

        notes =
          ${notes},

        guardian_name =
          ${guardianName},

        guardian_phone =
          ${guardianPhone},

        departure_method =
          ${departureMethod},

        project_id =
          ${targetProjectId},

        updated_at =
          CURRENT_TIMESTAMP

      WHERE id =
        ${personId}
    `

    return response.status(200).json({
      success: true,
      message:
        'Cadastro atualizado com sucesso.',
    })
  }


  // =======================================================
  // ACTIVATE / DEACTIVATE
  // =======================================================

  if (operation === 'set-active') {
    const body =
      request.body ?? {}

    const personId =
      Number(body.personId)

    const active =
      Number(body.active) === 1
        ? 1
        : 0

    if (
      !Number.isInteger(personId) ||
      personId <= 0
    ) {
      return response.status(400).json({
        error:
          'Assistido inválido.',
      })
    }

    const currentRows =
      await sql`
        SELECT
          id,
          project_id,
          active

        FROM assisted_people

        WHERE id =
          ${personId}

        LIMIT 1
      `

    const current =
      currentRows[0]

    if (!current) {
      return response.status(404).json({
        error:
          'Assistido não encontrado.',
      })
    }

    if (
      !canAccessProject(
        admin,
        current.project_id
      )
    ) {
      return response.status(403).json({
        error:
          'Você não possui acesso a este Assistido.',
      })
    }

    await sql`
      UPDATE assisted_people

      SET
        active =
          ${active},

        updated_at =
          CURRENT_TIMESTAMP

      WHERE id =
        ${personId}
    `

    return response.status(200).json({
      success: true,

      active,

      message:
        active
          ? 'Assistido reativado com sucesso.'
          : 'Assistido inativado com sucesso.',
    })
  }


  if (
    operation !== 'preview-import' &&
    operation !== 'import'
  ) {
    return response.status(400).json({
      error:
        'Operação de Assistidos inválida.',
    })
  }


  if (!Array.isArray(rows)) {
    return response.status(400).json({
      error:
        'Formato de CSV inválido.',
    })
  }


  if (!rows.length) {
    return response.status(400).json({
      error:
        'O CSV não possui Assistidos.',
    })
  }


  if (rows.length > 2000) {
    return response.status(400).json({
      error:
        'O limite é de 2000 Assistidos por importação.',
    })
  }


  // =======================================================
  // PROJECTS
  // =======================================================

  const projects =
    await sql`
      SELECT
        id,
        name

      FROM projects

      ORDER BY name
    `

  const selectedProject =
    projects.find(
      project =>
        Number(project.id) ===
        Number(projectId)
    )

  if (!selectedProject) {
    return response.status(400).json({
      error:
        'Selecione um projeto válido antes de importar Assistidos.',
    })
  }

  if (
    !canAccessProject(
      admin,
      selectedProject.id
    )
  ) {
    return response.status(403).json({
      error:
        'Você não pode importar Assistidos para este projeto.',
    })
  }


  // =======================================================
  // EXISTING PEOPLE
  // =======================================================

  const existing =
    await sql`
      SELECT
        id,
        full_name,
        birth_date,
        departure_method,
        project_id

      FROM assisted_people
    `


  const preview = []

  const importedRows =
    new Set()


  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const normalized =
      normalizeRow(
        rows[index] || {}
      )

    const errors = []
    const warnings = []

    const project =
      selectedProject


    // -----------------------------------------------------
    // NAME
    // -----------------------------------------------------

    if (!normalized.fullName) {
      errors.push(
        'Nome completo obrigatório.'
      )
    } else if (
      normalized.fullName
        .split(' ')
        .filter(Boolean)
        .length < 2
    ) {
      errors.push(
        'Informe nome e sobrenome.'
      )
    }


    // -----------------------------------------------------
    // BIRTH DATE
    // -----------------------------------------------------

    if (
      normalized.birthDate &&
      !validDate(
        normalized.birthDate
      )
    ) {
      errors.push(
        'Data de nascimento inválida.'
      )
    }


    // -----------------------------------------------------
    // GUARDIAN
    // -----------------------------------------------------

    if (!normalized.guardianName) {
      errors.push(
        'Nome do responsável obrigatório.'
      )
    }


    if (!normalized.guardianPhone) {
      errors.push(
        'Telefone do responsável obrigatório.'
      )
    }


    // -----------------------------------------------------
    // POSSIBLE DUPLICATE
    // -----------------------------------------------------

    let existingPerson =
      null

    if (
      project &&
      normalized.fullName
    ) {
      existingPerson =
        existing.find(
          person =>
            Number(
              person.project_id
            ) ===
              Number(
                project.id
              ) &&
            normalizeFullName(
              person.full_name
            ).toLowerCase() ===
              normalized.fullName
                .toLowerCase() &&
            (
              !normalized.birthDate ||
              !person.birth_date ||
              new Date(
                person.birth_date
              )
                .toISOString()
                .slice(
                  0,
                  10
                ) ===
                normalized.birthDate
            )
        )
    }


    const duplicateKey = [
      project.id,
      normalized.fullName.toLowerCase(),
      normalized.birthDate,
    ].join(':')

    const duplicateInImport =
      importedRows.has(duplicateKey)

    importedRows.add(duplicateKey)

    if (existingPerson) {
      warnings.push(
        normalized.departureMethod &&
        normalized.departureMethod !==
          String(existingPerson.departure_method || '').trim()
          ? 'Cadastro existente será enriquecido com a forma de saída; os demais dados serão preservados.'
          : 'Cadastro já existente; nenhum outro dado será sobrescrito.'
      )
    }

    if (duplicateInImport) {
      warnings.push(
        'Registro duplicado neste CSV.'
      )
    }


    const status =
      errors.length
        ? 'error'
        : warnings.length
          ? 'warning'
          : 'ready'


    preview.push({
      row:
        index + 2,

      status,

      errors,

      warnings,

      existingId:
        existingPerson
          ?.id || null,

      duplicate:
        duplicateInImport,

      full_name:
        normalized.fullName,

      birth_date:
        normalized.birthDate,

      allergies:
        normalized.allergies,

      notes:
        normalized.notes,

      guardian_name:
        normalized.guardianName,

      guardian_phone:
        normalized.guardianPhone,

      departure_method:
        normalized.departureMethod,

      updateDepartureMethod:
        Boolean(
          existingPerson &&
          normalized.departureMethod &&
          normalized.departureMethod !==
            String(existingPerson.departure_method || '').trim()
        ),

      project:
        project?.name ||
        '',

      project_id:
        project?.id || null,
    })
  }


  // =======================================================
  // PREVIEW ONLY
  // =======================================================

  if (
    operation ===
    'preview-import'
  ) {
    return response.status(200).json({
      rows: preview,

      totals: {
        total:
          preview.length,

        ready:
          preview.filter(
            row =>
              row.status ===
                'ready'
          ).length,

        warnings:
          preview.filter(
            row =>
              row.status ===
                'warning'
          ).length,

        errors:
          preview.filter(
            row =>
              row.status ===
                'error'
          ).length,
      },
    })
  }


  // =======================================================
  // IMPORT
  // =======================================================

  const importable =
    preview.filter(
      person =>
        person.status !==
          'error' &&
        !person.duplicate
    )


  let imported = 0
  let updated = 0


  for (
    const person
    of importable
  ) {
    if (person.existingId) {
      if (person.updateDepartureMethod) {
        await sql`
          UPDATE assisted_people
          SET
            departure_method = ${person.departure_method},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${person.existingId}
        `
        updated += 1
      }
      continue
    }

    await sql`
      INSERT INTO assisted_people (
        full_name,
        birth_date,
        departure_method,
        allergies,
        notes,

        guardian_name,
        guardian_phone,

        project_id,

        active,

        created_by,

        created_at,
        updated_at
      )

      VALUES (
        ${person.full_name},

        ${
          person.birth_date ||
          null
        },

        ${person.departure_method},

        ${person.allergies},

        ${person.notes},

        ${person.guardian_name},

        ${person.guardian_phone},

        ${person.project_id},

        1,

        ${admin.id},

        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `

    imported += 1
  }


  return response.status(200).json({
    success: true,

    imported,

    updated,

    skipped:
      preview.length -
      imported -
      updated,

    message:
      `${imported} novo(s) Assistido(s) importado(s) e ${updated} cadastro(s) enriquecido(s) com sucesso.`,
  })
}
