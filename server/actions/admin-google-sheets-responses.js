import process from 'node:process'

import {
  isGlobalAdmin,
  isProjectAdmin,
  isVolunteerTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'

import {
  createUsernameBase,
  normalizeEmail,
  normalizeFullName,
} from './_people-import.js'


function canManageVolunteers(admin) {
  return (
    isGlobalAdmin(admin) ||
    isProjectAdmin(admin) ||
    isVolunteerTeamAdmin(admin)
  )
}


function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[áàãâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòõôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ª/g, '')
    .replace(/º/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}


function mapHeader(header) {
  /*
   * Projeto — suporta tanto o Forms antigo quanto
   * a planilha atual da ONG.
   */
  if (
    header.includes(
      'qual_projeto_voce_faz_parte'
    ) ||
    (
      header.includes('projeto') &&
      header.includes('faz_parte')
    ) ||
    header.includes(
      'programa_que_seria_sua_1_opcao'
    ) ||
    (
      header.includes('programa') &&
      header.includes('1_opcao')
    )
  ) {
    return 'project'
  }

  if (
    header.includes(
      'nome_completo'
    )
  ) {
    return 'full_name'
  }

  if (
    header.includes(
      'programa_que_seria_sua_1_opcao'
    ) ||
    (
      header.includes('programa') &&
      header.includes('1_opcao')
    )
  ) {
    return 'project'
  }

  if (
    header.includes(
      'endereco_de_e_mail'
    ) ||
    header === 'email'
  ) {
    return 'email'
  }

  if (
    header.includes(
      'tel_whatsapp'
    ) ||
    header === 'telefone' ||
    header === 'phone'
  ) {
    return 'phone'
  }

  if (
    header.includes(
      'data_de_nascimento'
    ) ||
    header === 'birth_date'
  ) {
    return 'birth_date'
  }

  if (
    header.includes('alergia') ||
    header.includes(
      'restricoes_alimentares'
    )
  ) {
    return 'allergies'
  }

  return header
}


function normalizeDigits(value) {
  return String(value || '')
    .replace(/\D/g, '')
}


function looksLikeEmail(value) {
  const text =
    String(value || '').trim()

  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(text)
  )
}


function looksLikePhone(value) {
  const text =
    String(value || '').trim()

  // Bloqueia datas e carimbos de data/hora,
  // por exemplo:
  // 25/07/2026
  // 25/07/2026 10:40:11
  if (
    /^\d{1,2}\/\d{1,2}\/\d{4}/
      .test(text)
  ) {
    return false
  }

  // Bloqueia horários isolados.
  if (
    /^\d{1,2}:\d{2}(?::\d{2})?$/
      .test(text)
  ) {
    return false
  }

  const digits =
    normalizeDigits(text)

  return (
    digits.length >= 9 &&
    digits.length <= 15
  )
}


function looksLikeBirthDate(value) {
  const text =
    String(value || '').trim()

  return (
    /^\d{1,2}\/\d{1,2}\/\d{4}$/
      .test(text)
  )
}


function looksLikeProject(value) {
  const text =
    String(value || '')
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim()
      .toUpperCase()

  return (
    /\bAPS\b/.test(text) ||
    /\bPPF\b/.test(text) ||
    /\bSJ\b/.test(text) ||
    text.includes('SONHANDO')
  )
}


function looksLikeFullName(value) {
  const text =
    String(value || '')
      .trim()

  if (
    !text ||
    text.includes('@') ||
    /\d/.test(text)
  ) {
    return false
  }

  const parts =
    text
      .split(/\s+/)
      .filter(Boolean)

  if (parts.length < 2) {
    return false
  }

  const meaningfulParts =
    parts.filter(
      (part) =>
        part.length >= 2
    )

  if (
    meaningfulParts.length < 2
  ) {
    return false
  }

  const capitalizedParts =
    meaningfulParts.filter(
      (part) =>
        /^[A-ZÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ]/.test(
          part
        )
    )

  /*
   * Aceita nomes como:
   * João da Silva
   * Maria Eduarda dos Santos
   *
   * Portanto não exigimos maiúscula
   * em "da", "de", "dos" etc.
   */
  return (
    capitalizedParts.length >= 2
  )
}


function inferColumnType(values) {
  const samples =
    values
      .map(
        (value) =>
          String(value || '').trim()
      )
      .filter(Boolean)
      .slice(0, 40)

  if (!samples.length) {
    return null
  }

  const score = (matcher) =>
    samples.filter(matcher).length /
    samples.length

  const scores = {
    email:
      score(looksLikeEmail),

    phone:
      score(looksLikePhone),

    birth_date:
      score(looksLikeBirthDate),

    project:
      score(looksLikeProject),

    full_name:
      score(looksLikeFullName),
  }

  const ordered =
    Object.entries(scores)
      .sort(
        (a, b) =>
          b[1] - a[1]
      )

  const [
    bestField,
    bestScore,
  ] =
    ordered[0] || []

  /*
   * Exigimos pelo menos 60% dos valores
   * da coluna compatíveis com o tipo.
   */
  if (
    !bestField ||
    bestScore < 0.60
  ) {
    return null
  }

  return {
    field:
      bestField,

    confidence:
      bestScore,

    scores,
  }
}


function inferHeadersFromRows(
  records,
  existingHeaders
) {
  const columnCount =
    Math.max(
      ...records.map(
        (row) =>
          row.length
      ),
      0
    )

  const inferred =
    [...existingHeaders]

  const alreadyMapped =
    new Set(
      inferred.filter(
        (header) =>
          [
            'full_name',
            'project',
            'email',
            'phone',
            'birth_date',
          ].includes(header)
      )
    )

  for (
    let columnIndex = 0;
    columnIndex < columnCount;
    columnIndex += 1
  ) {
    const currentHeader =
      inferred[columnIndex]

    if (
      [
        'full_name',
        'project',
        'email',
        'phone',
        'birth_date',
      ].includes(currentHeader)
    ) {
      continue
    }

    const columnValues =
      records
        .slice(1)
        .map(
          (row) =>
            row[columnIndex]
        )

    const detected =
      inferColumnType(
        columnValues
      )

    if (
      !detected ||
      alreadyMapped.has(
        detected.field
      )
    ) {
      continue
    }

    inferred[columnIndex] =
      detected.field

    alreadyMapped.add(
      detected.field
    )
  }

  return inferred
}



async function refreshGoogleAccessToken(
  refreshToken
) {
  const clientId =
    process.env.GOOGLE_CLIENT_ID

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      'Credenciais OAuth do Google incompletas.'
    )
  }


  const response =
    await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            refresh_token:
              refreshToken,

            grant_type:
              'refresh_token',
          }),
      }
    )


  const data =
    await response.json()


  if (!response.ok) {
    console.error(
      'GOOGLE REFRESH ERROR:',
      data
    )

    throw new Error(
      data.error_description ||
      data.error ||
      'Não foi possível renovar o acesso ao Google.'
    )
  }


  return {
    accessToken:
      data.access_token,

    expiresIn:
      Number(
        data.expires_in || 3600
      ),
  }
}


async function googleFetch(
  url,
  accessToken
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    )

  const data =
    await response.json()


  if (!response.ok) {
    console.error(
      'GOOGLE SHEETS API ERROR:',
      data
    )

    throw new Error(
      data.error?.message ||
      'Não foi possível ler a planilha.'
    )
  }


  return data
}


export default async function handler(
  request,
  response
) {
  if (request.method !== 'GET') {
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


  if (!canManageVolunteers(admin)) {
    return response.status(403).json({
      error:
        'Você não possui permissão para consultar voluntários.',
    })
  }


  const spreadsheetId =
    process.env
      .GOOGLE_SHEETS_VOLUNTEERS_SPREADSHEET_ID



  if (!spreadsheetId) {
    return response.status(400).json({
      error:
        'Planilha de voluntários não configurada.',
    })
  }


  // ========================================================
  // INTEGRAÇÃO AUTORIZADA
  // ========================================================

  const integrations = await sql`
    SELECT
      id,
      refresh_token
    FROM external_integrations
    WHERE provider = 'google'
      AND integration_key =
        'volunteer_sheet'
      AND active = 1
    LIMIT 1
  `

  const integration =
    integrations[0]


  if (
    !integration?.refresh_token
  ) {
    return response.status(409).json({
      error:
        'Google Sheets ainda não foi autorizado.',
      requiresAuthorization: true,
    })
  }


  // ========================================================
  // RENOVA ACCESS TOKEN
  // ========================================================

  const {
    accessToken,
    expiresIn,
  } =
    await refreshGoogleAccessToken(
      integration.refresh_token
    )


  const expiresAt =
    new Date(
      Date.now() +
      expiresIn * 1000
    )


  await sql`
    UPDATE external_integrations
    SET
      access_token =
        ${accessToken},

      access_token_expires_at =
        ${expiresAt},

      updated_at =
        CURRENT_TIMESTAMP
    WHERE id =
      ${integration.id}
  `


  // ========================================================
  // DESCOBRE TODAS AS ABAS
  // ========================================================

  const metadataUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=properties.title,sheets.properties`


  const metadata =
    await googleFetch(
      metadataUrl,
      accessToken
    )


  console.log(
    'GOOGLE SHEETS SOURCE:',
    {
      title:
        metadata.properties?.title ||
        'Sem título',
      spreadsheetId,
    }
  )


  const sheets =
    metadata.sheets || []


  if (!sheets.length) {
    throw new Error(
      'Nenhuma aba foi encontrada na planilha.'
    )
  }


  // ========================================================
  // LÊ TODAS AS ABAS E IDENTIFICA AS VÁLIDAS
  //
  // Uma aba só é considerada base de voluntários se possuir:
  // - nome completo
  // - projeto
  //
  // Outras abas (resumos, gráficos, controles etc.)
  // são simplesmente ignoradas.
  // ========================================================

  const validSheets = []
  const ignoredSheets = []
  const consolidatedRows = []


  for (const sheet of sheets) {
    const sheetTitle =
      sheet.properties?.title

    if (!sheetTitle) {
      continue
    }


    const range =
      `'${String(sheetTitle).replace(
        /'/g,
        "''"
      )}'!A:ZZ`


    const valuesUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(
        range
      )}?majorDimension=ROWS`


    const valuesData =
      await googleFetch(
        valuesUrl,
        accessToken
      )


    const records =
      valuesData.values || []

    const kaioMatches =
      records
        .map((row, index) => ({
          row,
          rowNumber:
            index + 1,
        }))
        .filter(({ row }) =>
          row.some((cell) =>
            String(cell || '')
              .toLowerCase()
              .includes('kaio vinicius')
          )
        )

    if (kaioMatches.length > 0) {
      console.log(
        'KAIO VINICIUS RAW SHEET MATCH:',
        {
          sheet:
            sheetTitle,

          matches:
            kaioMatches.map(
              ({ row, rowNumber }) => ({
                rowNumber,

                row:
                  row.map(
                    (value) => {
                      const text =
                        String(value || '')
                          .trim()

                      if (
                        text.includes('@')
                      ) {
                        const [
                          local,
                          domain,
                        ] =
                          text.split('@')

                        return `${
                          local?.slice(0, 2) ||
                          '**'
                        }***@${
                          domain || '***'
                        }`
                      }

                      const digits =
                        text.replace(
                          /\D/g,
                          ''
                        )

                      if (
                        digits.length >= 9
                      ) {
                        return `***${
                          digits.slice(-4)
                        }`
                      }

                      return text
                    }
                  ),
              })
            ),
        }
      )
    }


    /*
     * Aba vazia ou só com cabeçalho.
     */
    if (records.length < 2) {
      ignoredSheets.push({
        title:
          sheetTitle,

        reason:
          'Sem respostas',
      })

      continue
    }


    const rawHeaders =
      records[0]

    const normalizedHeaders =
      rawHeaders.map(
        normalizeHeader
      )

    const mappedHeaders =
      normalizedHeaders.map(
        mapHeader
      )

    /*
     * Primeiro tentamos pelos cabeçalhos.
     * Depois completamos pelo conteúdo
     * das colunas, permitindo abas com
     * perguntas e ordens diferentes.
     */
    const headers =
      inferHeadersFromRows(
        records,
        mappedHeaders
      )

    const hasFullName =
      headers.includes(
        'full_name'
      )

    const hasProject =
      headers.includes(
        'project'
      )


    console.log(
      'GOOGLE SHEETS TAB:',
      {
        sheet:
          sheetTitle,

        rows:
          records.length - 1,

        hasFullName,
        hasProject,

        mappedHeaders:
          headers,
      }
    )


    if (
      !hasFullName ||
      !hasProject
    ) {
      ignoredSheets.push({
        title:
          sheetTitle,

        reason:
          'Não possui Nome + Projeto',
      })

      continue
    }


    const rows =
      records
        .slice(1)
        .filter(
          (values) =>
            values.some(
              (value) =>
                String(
                  value || ''
                ).trim()
            )
        )
        .map((values) => {
          const row =
            headers.reduce(
              (
                result,
                header,
                index
              ) => {
                result[header] =
                  values[index] || ''

                return result
              },
              {}
            )

          /*
           * Mantemos a origem internamente.
           * Isso ajuda a diagnosticar de qual aba
           * aquela pessoa veio.
           */
          row._sheet =
            sheetTitle

          return row
        })


    validSheets.push({
      title:
        sheetTitle,

      responses:
        rows.length,
    })


    consolidatedRows.push(
      ...rows
    )
  }


  if (!validSheets.length) {
    return response.status(200).json({
      success: true,

      source:
        'google_sheets',

      totalResponses:
        0,

      newResponses:
        0,

      alreadyImported:
        0,

      validSheets:
        [],

      ignoredSheets,

      rows:
        [],
    })
  }


  /*
   * Padroniza os nomes antes da deduplicação.
   *
   * Exemplo:
   * MARIA EDUARDA DOS SANTOS
   * →
   * Maria Eduarda dos Santos
   */
  for (const row of consolidatedRows) {
    row.full_name =
      normalizeFullName(
        row.full_name
      )
  }


  // ========================================================
  // DEDUPLICAÇÃO INTELIGENTE ENTRE TODAS AS ABAS
  //
  // Identidade forte:
  // - mesmo nome completo
  // - mesma data de nascimento
  // - mesmo telefone
  //
  // Sinais auxiliares:
  // - mesmo nome + nascimento
  // - mesmo nome + telefone
  // - mesmo e-mail
  //
  // Só a identidade forte faz mescla automática.
  // Os sinais auxiliares ficam disponíveis para diagnóstico.
  // ========================================================

  function normalizeIdentityText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }


  function normalizeIdentityPhone(value) {
    return String(value || '')
      .replace(/\D/g, '')
  }


  function normalizeIdentityBirthDate(value) {
    const raw =
      String(value || '').trim()

    if (!raw) {
      return ''
    }

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ) {
      return raw
    }

    const match =
      raw.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      )

    if (!match) {
      return raw
    }

    const [, day, month, year] =
      match

    return [
      year,
      month.padStart(2, '0'),
      day.padStart(2, '0'),
    ].join('-')
  }


  function mergeVolunteerRows(
    currentRow,
    incomingRow
  ) {
    const merged = {
      ...currentRow,
    }


    for (
      const [
        key,
        incomingValue,
      ] of Object.entries(
        incomingRow
      )
    ) {
      if (
        key === '_sheet' ||
        key === '_sheets'
      ) {
        continue
      }


      const currentValue =
        String(
          merged[key] || ''
        ).trim()

      const nextValue =
        String(
          incomingValue || ''
        ).trim()


      /*
       * Mantém o valor atual quando já existe.
       * Só completa campos vazios.
       */
      if (
        !currentValue &&
        nextValue
      ) {
        merged[key] =
          incomingValue
      }
    }


    const currentSheets =
      Array.isArray(
        currentRow._sheets
      )
        ? currentRow._sheets
        : [
            currentRow._sheet,
          ].filter(Boolean)


    const incomingSheets =
      Array.isArray(
        incomingRow._sheets
      )
        ? incomingRow._sheets
        : [
            incomingRow._sheet,
          ].filter(Boolean)


    merged._sheets = [
      ...new Set([
        ...currentSheets,
        ...incomingSheets,
      ]),
    ]


    delete merged._sheet


    return merged
  }


  const rows = []

  const possibleDuplicates = []

  let mergedDuplicates = 0


  for (
    const incomingRow
    of consolidatedRows
  ) {
    const incomingName =
      normalizeIdentityText(
        incomingRow.full_name
      )

    const incomingBirthDate =
      normalizeIdentityBirthDate(
        incomingRow.birth_date
      )

    const incomingPhone =
      normalizeIdentityPhone(
        incomingRow.phone
      )

    const incomingEmail =
      normalizeEmail(
        incomingRow.email
      )


    const strongDuplicateIndex =
      rows.findIndex(
        (currentRow) => {
          const currentName =
            normalizeIdentityText(
              currentRow.full_name
            )

          const currentBirthDate =
            normalizeIdentityBirthDate(
              currentRow.birth_date
            )

          const currentPhone =
            normalizeIdentityPhone(
              currentRow.phone
            )


          return Boolean(
            incomingName &&
            currentName &&
            incomingBirthDate &&
            currentBirthDate &&
            incomingPhone &&
            currentPhone &&
            incomingName ===
              currentName &&
            incomingBirthDate ===
              currentBirthDate &&
            incomingPhone ===
              currentPhone
          )
        }
      )


    /*
     * Mescla automática somente quando os
     * três dados fortes são iguais.
     */
    if (
      strongDuplicateIndex !== -1
    ) {
      rows[strongDuplicateIndex] =
        mergeVolunteerRows(
          rows[
            strongDuplicateIndex
          ],
          incomingRow
        )

      mergedDuplicates += 1

      continue
    }


    /*
     * Procura sinais de possível duplicidade,
     * mas sem eliminar ninguém.
     */
    const possibleDuplicate =
      rows.find(
        (currentRow) => {
          const currentName =
            normalizeIdentityText(
              currentRow.full_name
            )

          const currentBirthDate =
            normalizeIdentityBirthDate(
              currentRow.birth_date
            )

          const currentPhone =
            normalizeIdentityPhone(
              currentRow.phone
            )

          const currentEmail =
            normalizeEmail(
              currentRow.email
            )


          const sameNameAndBirth =
            Boolean(
              incomingName &&
              currentName &&
              incomingBirthDate &&
              currentBirthDate &&
              incomingName ===
                currentName &&
              incomingBirthDate ===
                currentBirthDate
            )


          const sameNameAndPhone =
            Boolean(
              incomingName &&
              currentName &&
              incomingPhone &&
              currentPhone &&
              incomingName ===
                currentName &&
              incomingPhone ===
                currentPhone
            )


          const sameEmail =
            Boolean(
              incomingEmail &&
              currentEmail &&
              incomingEmail ===
                currentEmail
            )


          return (
            sameNameAndBirth ||
            sameNameAndPhone ||
            sameEmail
          )
        }
      )


    if (possibleDuplicate) {
      possibleDuplicates.push({
        full_name:
          incomingRow.full_name,

        birth_date:
          incomingRow.birth_date,

        phone:
          incomingRow.phone,

        email:
          incomingRow.email,

        source:
          incomingRow._sheet,

        possibleMatch:
          possibleDuplicate.full_name,
      })
    }


    rows.push({
      ...incomingRow,

      _sheets: [
        incomingRow._sheet,
      ].filter(Boolean),
    })
  }


  console.log(
    'GOOGLE SHEETS DEDUPLICATION:',
    {
      rawResponses:
        consolidatedRows.length,

      uniquePeople:
        rows.length,

      mergedDuplicates,

      possibleDuplicates:
        possibleDuplicates.length,
    }
  )


  if (
    possibleDuplicates.length
  ) {
    console.log(
      'GOOGLE SHEETS POSSIBLE DUPLICATES:',
      possibleDuplicates
    )
  }


  // ========================================================
  // FILTRA QUEM JÁ ESTÁ NA CENTRAL
  // ========================================================

  const existingUsers = await sql`
    SELECT
      name,
      full_name,
      username,
      email,
      phone,
      birth_date,
      project_id
    FROM users
  `


  const kaioRows =
    rows.filter(
      (row) =>
        String(
          row.full_name || ''
        )
          .toLowerCase()
          .includes('kaio')
    )

  if (kaioRows.length) {
    console.log(
      'GOOGLE SHEETS KAIO DEBUG:',
      kaioRows
    )
  }


  // ========================================================
  // CLASSIFICA RESPOSTAS CONTRA A CENTRAL
  //
  // Regra importante:
  //
  // 1. Mesma pessoa com identidade forte
  //    → já importada.
  //
  // 2. Apenas username/e-mail em conflito
  //    → NÃO desaparece.
  //    → volta para o Admin revisar.
  // ========================================================

  const candidateRows = []
  const alreadyImportedRows = []
  const existingConflicts = []


  for (const row of rows) {
    const email =
      normalizeEmail(
        row.email
      )

    const rowName =
      normalizeIdentityText(
        row.full_name
      )

    const rowBirthDate =
      normalizeIdentityBirthDate(
        row.birth_date
      )

    const rowPhone =
      normalizeIdentityPhone(
        row.phone
      )

    const usernameBase =
      createUsernameBase(
        row.full_name
      )


    let strongExistingMatch = null

    const conflicts = []


    for (const user of existingUsers) {
      const userName =
        normalizeIdentityText(
          user.full_name ||
          user.name
        )

      const userBirthDate =
        normalizeIdentityBirthDate(
          user.birth_date
        )

      const userPhone =
        normalizeIdentityPhone(
          user.phone
        )

      const userEmail =
        normalizeEmail(
          user.email
        )


      const sameNameAndBirth =
        Boolean(
          rowName &&
          userName &&
          rowBirthDate &&
          userBirthDate &&
          rowName ===
            userName &&
          rowBirthDate ===
            userBirthDate
        )


      const sameNameAndPhone =
        Boolean(
          rowName &&
          userName &&
          rowPhone &&
          userPhone &&
          rowName ===
            userName &&
          rowPhone ===
            userPhone
        )


      const rowNameParts =
        new Set(
          rowName
            .split(' ')
            .filter(
              (part) =>
                part.length >= 2
            )
        )

      const userNameParts =
        userName
          .split(' ')
          .filter(
            (part) =>
              part.length >= 2
          )

      const matchingNameParts =
        userNameParts.filter(
          (part) =>
            rowNameParts.has(part)
        ).length


      const sameAbbreviatedNameAndBirth =
        Boolean(
          rowBirthDate &&
          userBirthDate &&
          rowBirthDate ===
            userBirthDate &&
          matchingNameParts >= 2
        )


      /*
       * Esses três sinais são suficientemente
       * fortes para considerar que a pessoa
       * já existe na Central.
       */
      if (
        sameNameAndBirth ||
        sameNameAndPhone ||
        sameAbbreviatedNameAndBirth
      ) {
        strongExistingMatch = {
          id:
            user.id,

          name:
            user.full_name ||
            user.name,

          reason:
            sameNameAndBirth
              ? 'Mesmo nome e nascimento'
              : sameNameAndPhone
                ? 'Mesmo nome e telefone'
                : 'Mesmo nascimento e nome compatível',
        }

        break
      }


      /*
       * Username ou e-mail iguais, sozinhos,
       * NÃO eliminam mais a resposta.
       *
       * Viram conflito para revisão manual.
       */
      const sameUsername =
        Boolean(
          usernameBase &&
          user.username &&
          String(
            user.username
          )
            .trim()
            .toLowerCase() ===
          usernameBase
            .trim()
            .toLowerCase()
        )


      const sameEmail =
        Boolean(
          email &&
          userEmail &&
          email ===
            userEmail
        )


      if (
        sameUsername ||
        sameEmail
      ) {
        const existing =
          conflicts.find(
            (conflict) =>
              Number(conflict.userId) ===
              Number(user.id)
          )

        const reasons = []

        if (sameUsername) {
          reasons.push(
            'username semelhante'
          )
        }

        if (sameEmail) {
          reasons.push(
            'e-mail já utilizado'
          )
        }


        if (existing) {
          existing.reasons = [
            ...new Set([
              ...existing.reasons,
              ...reasons,
            ]),
          ]
        } else {
          conflicts.push({
            userId:
              user.id,

            userName:
              user.full_name ||
              user.name,

            userEmail:
              user.email ||
              null,

            reasons,
          })
        }
      }
    }


    if (strongExistingMatch) {
      alreadyImportedRows.push({
        ...row,

        _existing_match:
          strongExistingMatch,
      })

      continue
    }


    const candidate = {
      ...row,

      _existing_conflicts:
        conflicts,
    }


    if (conflicts.length) {
      existingConflicts.push({
        full_name:
          row.full_name,

        project:
          row.project,

        source:
          row._sheet,

        conflicts,
      })
    }


    candidateRows.push(
      candidate
    )
  }


  console.log(
    'GOOGLE SHEETS EXISTING USERS:',
    {
      sourceRows:
        rows.length,

      candidates:
        candidateRows.length,

      alreadyImported:
        alreadyImportedRows.length,

      conflicts:
        existingConflicts.length,
    }
  )


  return response.status(200).json({
    success: true,

    source:
      'google_sheets',

    totalResponses:
      rows.length,

    alreadyImported:
      alreadyImportedRows.length,

    newResponses:
      candidateRows.length,

    conflictResponses:
      existingConflicts.length,

    validSheets,

    ignoredSheets,

    mergedDuplicates,

    possibleDuplicates:
      possibleDuplicates.length,

    existingConflicts,

    alreadyImportedRows,

    rows:
      candidateRows,
  })
}
