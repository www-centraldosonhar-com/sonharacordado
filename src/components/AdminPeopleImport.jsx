import {
  useEffect,
  useRef,
  useState,
} from 'react'


// ============================================================
// CSV PARSER
// Suporta vírgulas dentro de campos entre aspas.
// ============================================================

function parseCsvRecords(text) {
  const source = String(text || '')
    .replace(/^\uFEFF/, '')

  const records = []

  let row = []
  let cell = ''
  let quoted = false

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const char = source[index]
    const next = source[index + 1]

    /*
     * Aspas:
     *
     * "texto"
     *
     * Duas aspas dentro de campo entre aspas:
     *
     * "João ""Joca"" Silva"
     */
    if (char === '"') {
      if (
        quoted &&
        next === '"'
      ) {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }

      continue
    }

    /*
     * Vírgula fora de aspas encerra uma coluna.
     */
    if (
      char === ',' &&
      !quoted
    ) {
      row.push(cell.trim())
      cell = ''

      continue
    }

    /*
     * Nova linha fora de aspas encerra um registro.
     *
     * Nova linha DENTRO de aspas pertence ao conteúdo
     * daquele campo e não quebra o CSV.
     */
    if (
      (char === '\n' || char === '\r') &&
      !quoted
    ) {
      if (
        char === '\r' &&
        next === '\n'
      ) {
        index += 1
      }

      row.push(cell.trim())
      cell = ''

      if (
        row.some(
          (value) =>
            String(value).trim()
        )
      ) {
        records.push(row)
      }

      row = []

      continue
    }

    cell += char
  }

  /*
   * Última linha do arquivo.
   */
  if (
    cell.length ||
    row.length
  ) {
    row.push(cell.trim())

    if (
      row.some(
        (value) =>
          String(value).trim()
      )
    ) {
      records.push(row)
    }
  }

  return records
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


function mapGoogleFormsHeader(header) {
  /*
   * Formato simplificado da Central.
   */
  const aliases = {
    nome:
      'full_name',

    nome_completo:
      'full_name',

    full_name:
      'full_name',

    projeto:
      'project',

    project:
      'project',

    email:
      'email',

    e_mail:
      'email',

    endereco_de_e_mail:
      'email',

    telefone:
      'phone',

    celular:
      'phone',

    whatsapp:
      'phone',

    phone:
      'phone',

    tel_whatsapp:
      'phone',

    nascimento:
      'birth_date',

    data_de_nascimento:
      'birth_date',

    birth_date:
      'birth_date',

    alergia:
      'allergies',

    alergias:
      'allergies',

    restricoes:
      'allergies',

    restricoes_alimentares:
      'allergies',

    allergies:
      'allergies',
  }

  if (aliases[header]) {
    return aliases[header]
  }


  /*
   * Cabeçalhos reais do Google Forms.
   *
   * A comparação é propositalmente flexível.
   * Se alguém alterar um emoji ou pontuação no Forms,
   * o importador continua funcionando.
   */

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
    )
  ) {
    return 'email'
  }

  if (
    header.includes(
      'tel_whatsapp'
    )
  ) {
    return 'phone'
  }

  if (
    header.includes(
      'data_de_nascimento'
    )
  ) {
    return 'birth_date'
  }

  return header
}


function parseCsv(text) {
  /*
   * IMPORTANTE:
   *
   * Não fazemos .split('\n').
   *
   * O Google Forms pode exportar perguntas/respostas
   * contendo quebra de linha dentro de campos entre aspas.
   */
  const records =
    parseCsvRecords(text)

  if (records.length < 2) {
    throw new Error(
      'O CSV precisa ter cabeçalho e pelo menos uma pessoa.'
    )
  }


  const rawHeaders =
    records[0]

  const normalizedHeaders =
    rawHeaders.map(
      normalizeHeader
    )

  const headers =
    normalizedHeaders.map(
      mapGoogleFormsHeader
    )


  console.log(
    '[People Import] CSV headers:',
    {
      count:
        headers.length,

      rawHeaders,

      normalizedHeaders,

      mappedHeaders:
        headers,
    }
  )


  if (
    !headers.includes(
      'full_name'
    )
  ) {
    throw new Error(
      'Não encontrei a coluna Nome Completo no CSV.'
    )
  }


  if (
    !headers.includes(
      'project'
    )
  ) {
    throw new Error(
      'Não encontrei a 1ª opção de Programa/Projeto no CSV.'
    )
  }


  /*
   * Cada registro vira um objeto:
   *
   * {
   *   full_name: "...",
   *   project: "...",
   *   email: "...",
   *   phone: "...",
   *   birth_date: "..."
   * }
   *
   * As outras respostas do Forms podem existir,
   * mas não interferem no cadastro.
   */
  return records
    .slice(1)
    .map((values) =>
      headers.reduce(
        (
          row,
          header,
          index
        ) => {
          row[header] =
            values[index] || ''

          return row
        },
        {}
      )
    )
}


// ============================================================
// STATUS
// ============================================================

function StatusBadge({ status }) {
  const labels = {
    ready: 'Pronto',
    warning: 'Atenção',
    error: 'Erro',
  }

  return (
    <span
      className={`people-import-status is-${status}`}
    >
      {labels[status] || status}
    </span>
  )
}


// ============================================================
// COMPONENT
// ============================================================

export default function AdminPeopleImport() {
  const [
    googleForms,
    setGoogleForms,
  ] = useState({
    loading: true,
    configured: false,
    formConfigured: false,
    authorizationConfigured: false,
    status: 'loading',
    error: '',
  })


  useEffect(() => {
    let active = true

    async function loadGoogleFormsStatus() {
      try {
        const response = await fetch(
          '/api/admin?action=google-forms'
        )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível verificar o Google Forms.'
          )
        }

        if (!active) {
          return
        }

        setGoogleForms({
          loading: false,

          configured:
            Boolean(
              result.integration?.configured
            ),

          formConfigured:
            Boolean(
              result.integration?.formConfigured
            ),

          authorizationConfigured:
            Boolean(
              result.integration
                ?.authorizationConfigured
            ),

          status:
            result.integration?.status ||
            'waiting_authorization',

          error: '',
        })
      } catch (statusError) {
        if (!active) {
          return
        }

        setGoogleForms({
          loading: false,
          configured: false,
          formConfigured: false,
          authorizationConfigured: false,
          status: 'error',

          error:
            statusError?.message ||
            'Integração indisponível.',
        })
      }
    }

    loadGoogleFormsStatus()

    return () => {
      active = false
    }
  }, [])

  const inputRef = useRef(null)

  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [sourceRows, setSourceRows] = useState([])
  const [editingRow, setEditingRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [revalidating, setRevalidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [syncingGoogle, setSyncingGoogle] = useState(false)
  const [googleSyncInfo, setGoogleSyncInfo] = useState(null)
  const [previewFilter, setPreviewFilter] = useState('all')
  const [ignoredRows, setIgnoredRows] = useState([])


  async function handleFile(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setFileName(file.name)
    setPreview(null)
    setError('')
    setLoading(true)

    try {
      console.log(
        '[People Import] 1 — lendo arquivo'
      )

      const text = await file.text()

      console.log(
        '[People Import] 2 — arquivo lido',
        {
          file: file.name,
          characters: text.length,
        }
      )

      const rows = parseCsv(text)

      setSourceRows(rows)
      setEditingRow(null)
      setEditForm({})
      setPreviewFilter('all')
      setIgnoredRows([])

      console.log(
        '[People Import] 3 — CSV interpretado',
        {
          totalRows: rows.length,
          firstPerson: rows[0],
        }
      )

      const response = await fetch(
        '/api/admin?action=import-users',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            action: 'preview',
            rows,
          }),
        }
      )

      console.log(
        '[People Import] 4 — backend respondeu',
        {
          status: response.status,
          ok: response.ok,
          contentType:
            response.headers.get('content-type'),
        }
      )

      const rawResponse =
        await response.text()

      console.log(
        '[People Import] 5 — resposta bruta',
        rawResponse.slice(0, 1000)
      )

      let result

      try {
        result =
          rawResponse
            ? JSON.parse(rawResponse)
            : {}
      } catch {
        throw new Error(
          `Resposta inválida do servidor (${response.status}).`
        )
      }

      console.log(
        '[People Import] 6 — JSON recebido',
        result
      )

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Não foi possível analisar os voluntários.'
        )
      }

      setPreview(result)
    } catch (fileError) {
      console.error(
        '[People Import] ERRO:',
        fileError
      )

      console.error(
        '[People Import] STACK:',
        fileError?.stack
      )

      setError(
        fileError?.message ||
          'Não foi possível ler o CSV.'
      )
    } finally {
      setLoading(false)

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }


  function isIgnored(rowNumber) {
    return ignoredRows.includes(
      Number(rowNumber)
    )
  }


  function ignoreRow(rowNumber) {
    const normalizedRow =
      Number(rowNumber)

    setIgnoredRows((current) =>
      current.includes(normalizedRow)
        ? current
        : [
            ...current,
            normalizedRow,
          ]
    )

    if (
      editingRow ===
      normalizedRow
    ) {
      setEditingRow(null)
      setEditForm({})
    }
  }


  function restoreRow(rowNumber) {
    const normalizedRow =
      Number(rowNumber)

    setIgnoredRows((current) =>
      current.filter(
        (row) =>
          row !== normalizedRow
      )
    )
  }


  function getPreviewCounts() {
    if (!preview?.rows) {
      return {
        total: 0,
        ready: 0,
        warnings: 0,
        errors: 0,
        ignored: 0,
      }
    }

    const activeRows =
      preview.rows.filter(
        (person) =>
          !isIgnored(person.row)
      )

    return {
      total:
        preview.rows.length,

      ready:
        activeRows.filter(
          (person) =>
            person.status === 'ready'
        ).length,

      warnings:
        activeRows.filter(
          (person) =>
            person.status === 'warning'
        ).length,

      errors:
        activeRows.filter(
          (person) =>
            person.status === 'error'
        ).length,

      ignored:
        preview.rows.length -
        activeRows.length,
    }
  }


  function getFilteredPreviewRows() {
    if (!preview?.rows) {
      return []
    }

    if (
      previewFilter === 'ignored'
    ) {
      return preview.rows.filter(
        (person) =>
          isIgnored(person.row)
      )
    }

    const activeRows =
      preview.rows.filter(
        (person) =>
          !isIgnored(person.row)
      )

    if (
      previewFilter === 'all'
    ) {
      return activeRows
    }

    return activeRows.filter(
      (person) =>
        person.status ===
        previewFilter
    )
  }


  async function requestPreview(rows) {
    const response = await fetch(
      '/api/admin?action=import-users',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          action: 'preview',
          rows,
        }),
      }
    )

    const rawResponse =
      await response.text()

    let result

    try {
      result =
        rawResponse
          ? JSON.parse(rawResponse)
          : {}
    } catch {
      throw new Error(
        `Resposta inválida do servidor (${response.status}).`
      )
    }

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível revalidar os voluntários.'
      )
    }

    return result
  }


  function startCorrection(person) {
    setEditingRow(person.row)

    setEditForm({
      full_name:
        person.full_name || '',

      project:
        person.project || '',

      email:
        person.email || '',

      phone:
        person.phone || '',

      birth_date:
        person.birth_date || '',

      allergies:
        person.allergies || '',
    })

    setError('')
  }


  function cancelCorrection() {
    setEditingRow(null)
    setEditForm({})
  }


  function updateCorrection(field, value) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }))
  }


  async function saveCorrection(person) {
    /*
     * person.row começa em 2 porque:
     * linha 1 = cabeçalho do CSV.
     */
    const sourceIndex =
      Number(person.row) - 2

    if (
      sourceIndex < 0 ||
      sourceIndex >= sourceRows.length
    ) {
      setError(
        'Não consegui localizar esta linha no CSV.'
      )
      return
    }

    const updatedRows =
      sourceRows.map(
        (row, index) => {
          if (index !== sourceIndex) {
            return row
          }

          return {
            ...row,

            full_name:
              String(
                editForm.full_name || ''
              ).trim(),

            project:
              String(
                editForm.project || ''
              ).trim(),

            email:
              String(
                editForm.email || ''
              ).trim(),

            phone:
              String(
                editForm.phone || ''
              ).trim(),

            birth_date:
              String(
                editForm.birth_date || ''
              ).trim(),

            allergies:
              String(
                editForm.allergies || ''
              ).trim(),
          }
        }
      )

    setRevalidating(true)
    setError('')

    try {
      const result =
        await requestPreview(
          updatedRows
        )

      /*
       * Só substituímos sourceRows depois que
       * o servidor aceitou e revalidou o lote.
       */
      setSourceRows(updatedRows)
      setPreview(result)

      setEditingRow(null)
      setEditForm({})
    } catch (validationError) {
      setError(
        validationError?.message ||
        'Não foi possível validar a correção.'
      )
    } finally {
      setRevalidating(false)
    }
  }


  async function importVolunteers() {
    if (!sourceRows.length || !preview) {
      return
    }

    const counts =
      getPreviewCounts()

    if (counts.errors > 0) {
      setError(
        'Corrija ou ignore todos os registros com erro antes de importar.'
      )
      return
    }

    const activeSourceRows =
      sourceRows.filter(
        (_, index) =>
          !ignoredRows.includes(
            index + 2
          )
      )

    const total =
      activeSourceRows.length

    if (!total) {
      setError(
        'Nenhum registro ativo para importar.'
      )
      return
    }

    const confirmed =
      window.confirm(
        `Importar ${total} voluntários para a Central?`
      )

    if (!confirmed) {
      return
    }

    setImporting(true)
    setError('')
    setImportResult(null)

    try {
      const response = await fetch(
        '/api/admin?action=import-users',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            action: 'import',
            rows: activeSourceRows,
          }),
        }
      )

      const rawResponse =
        await response.text()

      let result

      try {
        result =
          rawResponse
            ? JSON.parse(rawResponse)
            : {}
      } catch {
        throw new Error(
          `Resposta inválida do servidor (${response.status}).`
        )
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível importar os voluntários.'
        )
      }

      setImportResult(result)

      /*
       * Após sucesso, limpamos o preview.
       * O resultado permanece visível.
       */
      setPreview(null)
      setSourceRows([])
      setEditingRow(null)
      setEditForm({})
      setFileName('')
    } catch (importError) {
      setError(
        importError?.message ||
        'Não foi possível importar.'
      )
    } finally {
      setImporting(false)
    }
  }


  async function fetchGoogleSheetsResponses() {
    setSyncingGoogle(true)
    setError('')
    setImportResult(null)

    try {
      const response = await fetch(
        '/api/admin?action=google-sheets-responses'
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível buscar as respostas.'
        )
      }

      setGoogleSyncInfo({
        totalResponses:
          result.totalResponses || 0,

        alreadyImported:
          result.alreadyImported || 0,

        newResponses:
          result.newResponses || 0,
      })


      if (!result.rows?.length) {
        setPreview(null)
        setSourceRows([])
        return
      }


      /*
       * As linhas vindas do Google passam
       * pela MESMA validação do CSV.
       */
      const previewResult =
        await requestPreview(
          result.rows
        )

      setSourceRows(
        result.rows
      )

      setPreview(
        previewResult
      )

      setPreviewFilter('all')
      setIgnoredRows([])

      setFileName('')
      setEditingRow(null)
      setEditForm({})
    } catch (syncError) {
      setError(
        syncError?.message ||
        'Não foi possível sincronizar o Google Sheets.'
      )
    } finally {
      setSyncingGoogle(false)
    }
  }


  async function authorizeGoogleSheets() {
    setError('')

    try {
      const response = await fetch(
        '/api/admin?action=google-oauth-start'
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível iniciar a autorização do Google.'
        )
      }

      if (!result.authorizationUrl) {
        throw new Error(
          'O Google não retornou uma URL de autorização.'
        )
      }

      window.open(
        result.authorizationUrl,
        '_blank',
        'noopener,noreferrer'
      )
    } catch (authorizationError) {
      setError(
        authorizationError?.message ||
        'Não foi possível conectar ao Google.'
      )
    }
  }


  function downloadTemplate() {
    const csv = [
      [
        'full_name',
        'project',
        'email',
        'phone',
        'birth_date',
        'allergies',
      ].join(','),

      [
        'Mariana de Souza Ferreira',
        'APS',
        'mariana@email.com',
        '11999999999',
        '1998-04-17',
        'Amendoim',
      ].join(','),
    ].join('\\n')

    const blob = new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8;',
      }
    )

    const url =
      URL.createObjectURL(blob)

    const link =
      document.createElement('a')

    link.href = url
    link.download =
      'modelo-voluntarios-central.csv'

    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(url)
  }


  function clearImport() {
    setFileName('')
    setPreview(null)
    setSourceRows([])
    setEditingRow(null)
    setEditForm({})
    setImportResult(null)
    setPreviewFilter('all')
    setIgnoredRows([])
    setError('')
  }


  return (
    <section className="people-import">
      <div className="people-google-card">
        <div className="people-google-ambient" />

        <div className="people-google-icon">
          <span aria-hidden="true">
            G
          </span>
        </div>

        <div className="people-google-content">
          <div className="people-google-topline">
            <span className="people-google-eyebrow">
              Integração
            </span>

            <span
              className={
                `people-google-status is-${
                  googleForms.loading
                    ? 'loading'
                    : googleForms.configured
                      ? 'connected'
                      : googleForms.status === 'error'
                        ? 'error'
                        : 'waiting'
                }`
              }
            >
              <i />

              {googleForms.loading
                ? 'Verificando'
                : googleForms.configured
                  ? 'Conectado'
                  : googleForms.status === 'error'
                    ? 'Indisponível'
                    : 'Aguardando autorização'}
            </span>
          </div>

          <h3>
            Google Forms
          </h3>

          <p>
            Receba as novas inscrições diretamente
            do formulário e revise tudo na Central
            antes de importar.
          </p>

          <div className="people-google-details">
            <div>
              <span>
                Formulário
              </span>

              <strong>
                {googleForms.formConfigured
                  ? 'Configurado'
                  : 'Aguardando link'}
              </strong>
            </div>

            <div>
              <span>
                Conta Google
              </span>

              <strong>
                {googleForms.authorizationConfigured
                  ? 'Autorizada'
                  : 'Aguardando autorização'}
              </strong>
            </div>
          </div>

          {googleForms.error && (
            <div className="people-google-error">
              {googleForms.error}
            </div>
          )}
        </div>

        <div className="people-google-action">
          <button
            type="button"
            onClick={
              googleForms.configured
                ? fetchGoogleSheetsResponses
                : authorizeGoogleSheets
            }
            disabled={
              googleForms.loading ||
              syncingGoogle
            }
            className={
              googleForms.configured
                ? 'is-connected'
                : ''
            }
            title={
              googleForms.configured
                ? 'Google Sheets conectado'
                : 'Autorizar acesso à planilha'
            }
          >
            <span>
              {syncingGoogle
                ? 'Buscando respostas...'
                : googleForms.configured
                  ? 'Buscar novas respostas'
                  : 'Autorizar Google Sheets'}
            </span>

            <span aria-hidden="true">
              {googleForms.configured
                ? '✓'
                : '→'}
            </span>
          </button>

          <small>
            {googleForms.configured
              ? 'Integração pronta para sincronização'
              : 'Nenhuma senha do Google é armazenada'}
          </small>
        </div>
      </div>

      {googleSyncInfo && (
        <div className="people-google-sync-result">
          <div>
            <strong>
              {googleSyncInfo.newResponses}
            </strong>

            <span>
              novas respostas
            </span>
          </div>

          <p>
            {googleSyncInfo.totalResponses}
            {' '}
            respostas na planilha ·
            {' '}
            {googleSyncInfo.alreadyImported}
            {' '}
            já cadastradas na Central
          </p>
        </div>
      )}

      <div className="people-import-divider">
        <span>
          ou importe manualmente
        </span>
      </div>
      <div className="people-import-heading">
        <div>
          <span className="people-import-eyebrow">
            Pessoas
          </span>

          <h3>Importar voluntários</h3>

          <p>
            Importe a base e revise os dados antes
            de criar qualquer acesso.
          </p>
        </div>

        <div className="people-import-actions">
          <button
            type="button"
            className="people-import-template"
            onClick={downloadTemplate}
          >
            Baixar modelo
          </button>

        <button
          type="button"
          className="people-import-select"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading
            ? 'Analisando...'
            : 'Selecionar CSV'}
        </button>

        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={handleFile}
        />
      </div>


      {fileName && (
        <div className="people-import-file">
          <span>
            <b>CSV</b>
            {fileName}
          </span>

          <button
            type="button"
            onClick={clearImport}
          >
            Remover
          </button>
        </div>
      )}


      {error && (
        <div className="people-import-error">
          <strong>
            Não foi possível analisar
          </strong>

          <span>{error}</span>
        </div>
      )}


      {importResult && (
        <div className="people-import-success">
          <span aria-hidden="true">
            ✓
          </span>

          <div>
            <strong>
              Importação concluída
            </strong>

            <p>
              {importResult.imported}
              {' '}
              voluntários foram adicionados à Central.
            </p>

            {importResult.skipped > 0 && (
              <p>
                {importResult.skipped}
                {' '}
                registros foram ignorados por duplicidade.
              </p>
            )}

            <small>
              Os novos voluntários já podem fazer
              o primeiro acesso e criar o próprio PIN.
            </small>
          </div>
        </div>
      )}

      {preview && (
        <div className="people-import-preview">
                    {(() => {
            const counts =
              getPreviewCounts()

            const filters = [
              {
                key: 'all',
                value:
                  counts.total -
                  counts.ignored,
                label: 'todos',
              },
              {
                key: 'ready',
                value:
                  counts.ready,
                label: 'prontos',
              },
              {
                key: 'warning',
                value:
                  counts.warnings,
                label: 'atenção',
              },
              {
                key: 'error',
                value:
                  counts.errors,
                label: 'erros',
              },
              {
                key: 'ignored',
                value:
                  counts.ignored,
                label: 'ignorados',
              },
            ]

            return (
              <div className="people-import-summary">
                {filters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={
                      `people-import-summary-card is-${filter.key} ${
                        previewFilter === filter.key
                          ? 'is-active'
                          : ''
                      }`
                    }
                    onClick={() =>
                      setPreviewFilter(
                        filter.key
                      )
                    }
                  >
                    <strong>
                      {filter.value}
                    </strong>

                    <span>
                      {filter.label}
                    </span>
                  </button>
                ))}
              </div>
            )
          })()}


          <div className="people-import-list">
            {getFilteredPreviewRows().map((person) => (
              <article
                key={person.row}
                className={
                  `people-import-person ${
                    isIgnored(person.row)
                      ? 'is-ignored'
                      : ''
                  }`
                }
              >
                <div className="people-import-person-head">
                  <div>
                    <small>
                      Linha {person.row}
                    </small>

                    <strong>
                      {person.full_name ||
                        'Nome não informado'}
                    </strong>

                    <span>
                      {person.username
                        ? `@${person.username}`
                        : person.name || '—'}
                      {' · '}
                      {person.project || 'Sem projeto'}
                    </span>
                  </div>

                  <div className="people-import-person-actions">
                    <StatusBadge
                      status={person.status}
                    />

                    {!isIgnored(person.row) &&
                      person.errors?.length > 0 && (
                        <button
                          type="button"
                          className="people-import-fix-button"
                          onClick={() =>
                            editingRow === person.row
                              ? cancelCorrection()
                              : startCorrection(person)
                          }
                        >
                          {editingRow === person.row
                            ? 'Cancelar'
                            : 'Corrigir'}
                        </button>
                      )}

                    {isIgnored(person.row) ? (
                      <button
                        type="button"
                        className="people-import-restore-button"
                        onClick={() =>
                          restoreRow(person.row)
                        }
                      >
                        Restaurar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="people-import-ignore-button"
                        onClick={() =>
                          ignoreRow(person.row)
                        }
                      >
                        Ignorar
                      </button>
                    )}
                  </div>
                </div>


                {editingRow === person.row && (
                  <div className="people-import-editor">
                    <div className="people-import-editor-heading">
                      <div>
                        <span>
                          Corrigir registro
                        </span>

                        <strong>
                          Linha {person.row}
                        </strong>
                      </div>

                      <small>
                        A Central revalidará o CSV
                        depois de salvar.
                      </small>
                    </div>


                    <div className="people-import-editor-grid">
                      <label className="people-import-editor-wide">
                        <span>
                          Nome completo
                        </span>

                        <input
                          type="text"
                          value={
                            editForm.full_name || ''
                          }
                          onChange={(event) =>
                            updateCorrection(
                              'full_name',
                              event.target.value
                            )
                          }
                        />
                      </label>


                      <label>
                        <span>
                          Projeto
                        </span>

                        <select
                          value={
                            editForm.project || ''
                          }
                          onChange={(event) =>
                            updateCorrection(
                              'project',
                              event.target.value
                            )
                          }
                        >
                          <option value="">
                            Selecione
                          </option>

                          <option value="APS">
                            APS
                          </option>

                          <option value="PPF">
                            PPF
                          </option>

                          <option value="SJ">
                            SJ
                          </option>
                        </select>
                      </label>


                      <label>
                        <span>
                          Nascimento
                        </span>

                        <input
                          type="date"
                          value={
                            editForm.birth_date || ''
                          }
                          onChange={(event) =>
                            updateCorrection(
                              'birth_date',
                              event.target.value
                            )
                          }
                        />
                      </label>


                      <label>
                        <span>
                          E-mail
                        </span>

                        <input
                          type="email"
                          value={
                            editForm.email || ''
                          }
                          onChange={(event) =>
                            updateCorrection(
                              'email',
                              event.target.value
                            )
                          }
                        />
                      </label>


                      <label>
                        <span>
                          Telefone
                        </span>

                        <input
                          type="text"
                          inputMode="tel"
                          value={
                            editForm.phone || ''
                          }
                          onChange={(event) =>
                            updateCorrection(
                              'phone',
                              event.target.value
                            )
                          }
                        />
                      </label>


                      <label className="people-import-editor-wide">
                        <span>
                          Alergias / restrições
                        </span>

                        <input
                          type="text"
                          value={
                            editForm.allergies || ''
                          }
                          onChange={(event) =>
                            updateCorrection(
                              'allergies',
                              event.target.value
                            )
                          }
                          placeholder="Opcional"
                        />
                      </label>
                    </div>


                    <div className="people-import-editor-actions">
                      <button
                        type="button"
                        className="people-import-editor-cancel"
                        onClick={cancelCorrection}
                        disabled={revalidating}
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        className="people-import-editor-save"
                        onClick={() =>
                          saveCorrection(person)
                        }
                        disabled={revalidating}
                      >
                        {revalidating
                          ? 'Revalidando...'
                          : 'Salvar correção'}
                      </button>
                    </div>
                  </div>
                )}


                {(person.email || person.phone) && (
                  <div className="people-import-contact">
                    {person.email && (
                      <span>{person.email}</span>
                    )}

                    {person.phone && (
                      <span>{person.phone}</span>
                    )}
                  </div>
                )}


                {person.errors?.length > 0 && (
                  <div className="people-import-notes is-error">
                    {person.errors.map((message) => (
                      <p key={message}>
                        {message}
                      </p>
                    ))}
                  </div>
                )}


                {person.warnings?.length > 0 && (
                  <div className="people-import-notes is-warning">
                    {person.warnings.map((message) => (
                      <p key={message}>
                        {message}
                      </p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>


          <div className="people-import-footer">
            <span>
              Preview apenas — nenhum usuário foi
              criado.
            </span>

            <button
              type="button"
              className="people-import-confirm"
              onClick={importVolunteers}
              disabled={
                importing ||
                revalidating ||
                getPreviewCounts().errors > 0
              }
            >
              {importing
                ? 'Importando...'
                : `Importar ${
                    getPreviewCounts().ready +
                    getPreviewCounts().warnings
                  } voluntários`}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
