import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  createPortal,
} from 'react-dom'


// =========================================================
// CSV HELPERS
// =========================================================
//
// Parser pequeno e independente.
//
// Aceita:
// - vírgula
// - ponto e vírgula
// - campos entre aspas
//
// Assim não dependemos do importador de Voluntários.
// =========================================================

function detectSeparator(line = '') {
  const semicolons =
    (line.match(/;/g) || []).length

  const commas =
    (line.match(/,/g) || []).length

  return semicolons > commas
    ? ';'
    : ','
}


function parseCsvLine(
  line,
  separator
) {
  const result = []

  let current = ''
  let quoted = false

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character =
      line[index]

    if (character === '"') {
      const next =
        line[index + 1]

      if (
        quoted &&
        next === '"'
      ) {
        current += '"'
        index += 1
        continue
      }

      quoted = !quoted
      continue
    }

    if (
      character === separator &&
      !quoted
    ) {
      result.push(
        current.trim()
      )

      current = ''
      continue
    }

    current += character
  }

  result.push(
    current.trim()
  )

  return result
}


function normalizeHeader(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '_'
    )
    .replace(
      /^_+|_+$/g,
      ''
    )
}


function parseCsv(text = '') {
  const cleanText =
    String(text)
      .replace(
        /^\uFEFF/,
        ''
      )
      .replace(
        /\r\n/g,
        '\n'
      )
      .replace(
        /\r/g,
        '\n'
      )

  const lines =
    cleanText
      .split('\n')
      .filter(
        line =>
          line.trim()
      )

  if (lines.length < 2) {
    throw new Error(
      'O CSV precisa ter cabeçalho e pelo menos uma linha de dados.'
    )
  }

  const separator =
    detectSeparator(
      lines[0]
    )

  const headers =
    parseCsvLine(
      lines[0],
      separator
    ).map(
      normalizeHeader
    )

  return lines
    .slice(1)
    .map(
      line => {
        const values =
          parseCsvLine(
            line,
            separator
          )

        const row = {}

        headers.forEach(
          (
            header,
            index
          ) => {
            row[header] =
              values[index] ?? ''
          }
        )

        return row
      }
    )
}


// =========================================================
// DISPLAY HELPERS
// =========================================================

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date =
    String(value).slice(
      0,
      10
    )

  const [
    year,
    month,
    day,
  ] =
    date.split('-')

  if (
    !year ||
    !month ||
    !day
  ) {
    return date
  }

  return `${day}/${month}/${year}`
}


function statusLabel(status) {
  if (status === 'ready') {
    return '✅ Pronto'
  }

  if (status === 'warning') {
    return '⚠️ Atenção'
  }

  return '❌ Erro'
}


// =========================================================
// COMPONENT
// =========================================================

export default function AdminAssistedPanel({
  onUpdated,
  projects = [],
  access,
}) {
  const fileInputRef =
    useRef(null)

  const [
    assisted,
    setAssisted,
  ] =
    useState([])

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    success,
    setSuccess,
  ] =
    useState('')

  const [
    search,
    setSearch,
  ] =
    useState('')

  const [
    projectFilter,
    setProjectFilter,
  ] =
    useState('all')

  const [
    importProjectId,
    setImportProjectId,
  ] =
    useState(
      access?.scope === 'global'
        ? ''
        : String(access?.project?.id || '')
    )

  const [
    importRows,
    setImportRows,
  ] =
    useState([])

  const [
    preview,
    setPreview,
  ] =
    useState(null)

  const [
    importFileName,
    setImportFileName,
  ] =
    useState('')

  const [
    isPreviewing,
    setIsPreviewing,
  ] =
    useState(false)

  const [
    isImporting,
    setIsImporting,
  ] =
    useState(false)


  const [
    editingPerson,
    setEditingPerson,
  ] =
    useState(null)

  const [
    editForm,
    setEditForm,
  ] =
    useState(null)

  const [
    isSavingEdit,
    setIsSavingEdit,
  ] =
    useState(false)

  const [
    changingActiveId,
    setChangingActiveId,
  ] =
    useState(null)



  // =======================================================
  // LOAD
  // =======================================================

  async function loadAssisted() {
    setIsLoading(true)
    setError('')

    try {
      const response =
        await fetch(
          '/api/admin?action=assisted'
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível carregar os Assistidos.'
        )
      }

      setAssisted(
        result.assisted || []
      )
    } catch (loadError) {
      setError(
        loadError.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  useEffect(
    () => {
      let cancelled = false

      async function loadInitialAssisted() {
        try {
          const response =
            await fetch(
              '/api/admin?action=assisted'
            )

          const result =
            await response.json()

          if (!response.ok) {
            throw new Error(
              result.error ||
              'Não foi possível carregar os Assistidos.'
            )
          }

          if (!cancelled) {
            setAssisted(
              result.assisted || []
            )
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(
              loadError.message
            )
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false)
          }
        }
      }

      loadInitialAssisted()

      return () => {
        cancelled = true
      }
    },
    []
  )


  // =======================================================
  // PROJECT OPTIONS
  // =======================================================

  const projectOptions =
    useMemo(
      () => {
        const projects =
          new Map()

        assisted.forEach(
          person => {
            if (
              person.project_id &&
              person.project_name
            ) {
              projects.set(
                String(
                  person.project_id
                ),
                person.project_name
              )
            }
          }
        )

        return Array
          .from(
            projects.entries()
          )
          .map(
            (
              [
                id,
                name,
              ]
            ) => ({
              id,
              name,
            })
          )
          .sort(
            (
              first,
              second
            ) =>
              first.name.localeCompare(
                second.name,
                'pt-BR'
              )
          )
      },
      [assisted]
    )


  // =======================================================
  // FILTER
  // =======================================================

  const assistedSummary =
    useMemo(
      () => {
        const active =
          assisted.filter(
            person =>
              Number(
                person.active
              ) === 1
          ).length

        const inactive =
          assisted.length -
          active

        return {
          active,
          inactive,
        }
      },
      [assisted]
    )


  const filteredAssisted =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase()

        return assisted.filter(
          person => {
            if (
              projectFilter !== 'all' &&
              String(
                person.project_id
              ) !==
                projectFilter
            ) {
              return false
            }

            if (!term) {
              return true
            }

            const haystack = [
              person.full_name,
              person.guardian_name,
              person.guardian_phone,
              person.allergies,
              person.departure_method,
              person.project_name,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

            return haystack.includes(
              term
            )
          }
        )
      },
      [
        assisted,
        search,
        projectFilter,
      ]
    )


  // =======================================================
  // FILE
  // =======================================================

  async function handleFile(
    event
  ) {
    if (!importProjectId) {
      setError(
        'Selecione o projeto antes de importar o CSV.'
      )

      return
    }

    const file =
      event.target
        .files?.[0]

    if (!file) {
      return
    }

    setError('')
    setSuccess('')
    setPreview(null)

    try {
      const text =
        await file.text()

      const parsedRows =
        parseCsv(text)

      setImportRows(
        parsedRows
      )

      setImportFileName(
        file.name
      )

      await previewImport(
        parsedRows,
        importProjectId
      )
    } catch (fileError) {
      setImportRows([])
      setImportFileName('')

      setError(
        fileError.message ||
        'Não foi possível ler o CSV.'
      )
    } finally {
      event.target.value = ''
    }
  }


  async function previewImport(
    rows,
    projectId
  ) {
    setIsPreviewing(true)
    setError('')

    try {
      const response =
        await fetch(
          '/api/admin?action=assisted',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation:
                'preview-import',

              rows,

              projectId,
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível validar o CSV.'
        )
      }

      setPreview(result)
    } catch (previewError) {
      setPreview(null)

      setError(
        previewError.message
      )
    } finally {
      setIsPreviewing(false)
    }
  }


  // =======================================================
  // IMPORT
  // =======================================================

  async function confirmImport() {
    if (
      !importRows.length ||
      !preview ||
      !importProjectId
    ) {
      if (!importProjectId) {
        setError(
          'Selecione o projeto antes de importar o CSV.'
        )
      }

      return
    }

    const importable =
      (
        preview.rows || []
      ).filter(
        row =>
          row.status !==
            'error' &&
          !row.duplicate
      ).length

    if (!importable) {
      setError(
        'Não há novos Assistidos válidos para importar.'
      )

      return
    }

      const confirmed =
        window.confirm(
        `Processar ${importable} linha(s), incluindo novos cadastros e enriquecimentos?`
      )

    if (!confirmed) {
      return
    }

    setIsImporting(true)
    setError('')
    setSuccess('')

    try {
      const response =
        await fetch(
          '/api/admin?action=assisted',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation:
                'import',

              rows:
                importRows,

              projectId:
                importProjectId,
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível importar os Assistidos.'
        )
      }

      setSuccess(
        result.message ||
        'Importação concluída.'
      )

      setPreview(null)
      setImportRows([])
      setImportFileName('')

      await loadAssisted()

      if (onUpdated) {
        await onUpdated()
      }
    } catch (importError) {
      setError(
        importError.message
      )
    } finally {
      setIsImporting(false)
    }
  }


  function openEdit(
    person
  ) {
    setEditingPerson(
      person
    )

    setEditForm({
      fullName:
        person.full_name || '',

      birthDate:
        person.birth_date
          ? String(
              person.birth_date
            ).slice(
              0,
              10
            )
          : '',

      allergies:
        person.allergies || '',

      notes:
        person.notes || '',

      guardianName:
        person.guardian_name || '',

      guardianPhone:
        person.guardian_phone || '',

      departureMethod:
        person.departure_method || '',

      projectId:
        String(
          person.project_id || ''
        ),
    })

    setError('')
    setSuccess('')
  }


  function closeEdit() {
    if (isSavingEdit) {
      return
    }

    setEditingPerson(null)
    setEditForm(null)
  }


  function updateEditField(
    field,
    value
  ) {
    setEditForm(
      current => ({
        ...current,
        [field]: value,
      })
    )
  }


  async function saveEdit(
    event
  ) {
    event.preventDefault()

    if (
      !editingPerson ||
      !editForm
    ) {
      return
    }

    setIsSavingEdit(true)
    setError('')
    setSuccess('')

    try {
      const response =
        await fetch(
          '/api/admin?action=assisted',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation:
                'update',

              personId:
                editingPerson.id,

              ...editForm,
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível atualizar o Assistido.'
        )
      }

      setSuccess(
        result.message ||
        'Cadastro atualizado.'
      )

      setEditingPerson(null)
      setEditForm(null)

      await loadAssisted()

      if (onUpdated) {
        await onUpdated()
      }
    } catch (saveError) {
      setError(
        saveError.message
      )
    } finally {
      setIsSavingEdit(false)
    }
  }


  async function setPersonActive(
    person
  ) {
    const nextActive =
      Number(
        person.active
      ) === 1
        ? 0
        : 1

    if (
      nextActive === 0
    ) {
      const confirmed =
        window.confirm(
          `Inativar ${person.full_name}? Ele não entrará em novas checklists, mas o histórico será preservado.`
        )

      if (!confirmed) {
        return
      }
    }

    setChangingActiveId(
      person.id
    )

    setError('')
    setSuccess('')

    try {
      const response =
        await fetch(
          '/api/admin?action=assisted',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation:
                'set-active',

              personId:
                person.id,

              active:
                nextActive,
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível alterar o status do Assistido.'
        )
      }

      setSuccess(
        result.message
      )

      await loadAssisted()

      if (onUpdated) {
        await onUpdated()
      }
    } catch (statusError) {
      setError(
        statusError.message
      )
    } finally {
      setChangingActiveId(null)
    }
  }


  function cancelImport() {
    setPreview(null)
    setImportRows([])
    setImportFileName('')
    setError('')
  }


  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="assisted-admin">
      <div className="assisted-toolbar">
        <div>
          <p className="assisted-eyebrow">
            BASE PERMANENTE
          </p>

          <h3>
            Cadastro de Assistidos
          </h3>

          <p className="assisted-description">
            Consulte e importe os
            Assistidos vinculados aos
            projetos.
          </p>
        </div>

        <div className="assisted-toolbar-actions">
          <label className="assisted-import-project">
            <span>
              Projeto para importação
            </span>

            <select
              value={
                importProjectId
              }
              onChange={
                event => {
                  setImportProjectId(
                    event.target.value
                  )
                  setPreview(null)
                  setImportRows([])
                  setImportFileName('')
                }
              }
              disabled={
                isPreviewing ||
                isImporting ||
                access?.scope !== 'global'
              }
            >
              <option value="">
                Selecione o projeto
              </option>

              {projects.map(
                project => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                )
              )}
            </select>

            {!importProjectId && (
              <small>
                Selecione um projeto para liberar a importação.
              </small>
            )}
          </label>

          <button
            type="button"
            className="assisted-import-button"
            onClick={
              () =>
                fileInputRef
                  .current
                  ?.click()
            }
            disabled={
              isPreviewing ||
              isImporting ||
              !importProjectId
            }
          >
            {isPreviewing
              ? 'Validando...'
              : '＋ Importar CSV'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={
              handleFile
            }
          />
        </div>
      </div>

      <div className="assisted-csv-hint">
        <strong>
          CSV oficial do Google Forms:
        </strong>

        <span>
          use diretamente os campos de
          nome, nascimento, responsável,
          telefone, alergias e observações.
          O projeto é escolhido acima e
          não precisa existir no arquivo.
        </span>
      </div>

      {error && (
        <div className="assisted-message assisted-message-error">
          {error}
        </div>
      )}

      {success && (
        <div className="assisted-message assisted-message-success">
          {success}
        </div>
      )}

      {preview && (
        <div className="assisted-import-preview">
          <div className="assisted-preview-header">
            <div>
              <p className="assisted-eyebrow">
                PRÉVIA DA IMPORTAÇÃO
              </p>

              <h4>
                {importFileName}
              </h4>
            </div>

            <div className="assisted-preview-totals">
              <span>
                {
                  preview.totals
                    ?.total || 0
                } linhas
              </span>

              <span className="is-ready">
                ✅ {
                  preview.totals
                    ?.ready || 0
                }
              </span>

              <span className="is-warning">
                ⚠️ {
                  preview.totals
                    ?.warnings || 0
                }
              </span>

              <span className="is-error">
                ❌ {
                  preview.totals
                    ?.errors || 0
                }
              </span>
            </div>
          </div>

          <div className="assisted-preview-list">
            {(preview.rows || [])
              .map(
                row => (
                  <div
                    key={
                      row.row
                    }
                    className={
                      `assisted-preview-row status-${row.status}`
                    }
                  >
                    <div className="assisted-preview-status">
                      {
                        statusLabel(
                          row.status
                        )
                      }
                    </div>

                    <div className="assisted-preview-person">
                      <strong>
                        {
                          row.full_name ||
                          'Sem nome'
                        }
                      </strong>

                      <span>
                        {
                          row.project ||
                          'Sem projeto'
                        }
                        {' · '}
                        {
                          formatDate(
                            row.birth_date
                          )
                        }
                      </span>

                      {!!row.existingId && (
                        <small>
                          Cadastro existente
                          #{row.existingId}
                        </small>
                      )}
                    </div>

                    <div className="assisted-preview-notes">
                      {(
                        row.errors || []
                      ).map(
                        item => (
                          <small
                            key={
                              `error-${item}`
                            }
                          >
                            {item}
                          </small>
                        )
                      )}

                      {(
                        row.warnings || []
                      ).map(
                        item => (
                          <small
                            key={
                              `warning-${item}`
                            }
                          >
                            {item}
                          </small>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
          </div>

          <div className="assisted-preview-actions">
            <button
              type="button"
              className="assisted-secondary-button"
              onClick={
                cancelImport
              }
              disabled={
                isImporting
              }
            >
              Cancelar
            </button>

            <button
              type="button"
              className="assisted-primary-button"
              onClick={
                confirmImport
              }
              disabled={
                isImporting ||
                (
                  preview.totals
                    ?.ready === 0 &&
                  preview.totals
                    ?.warnings === 0
                )
              }
            >
              {isImporting
                ? 'Importando...'
                : 'Confirmar importação'}
            </button>
          </div>
        </div>
      )}

      <div className="assisted-filters">
        <label className="assisted-search">
          <span>
            Buscar
          </span>

          <input
            type="search"
            value={search}
            placeholder="Nome, responsável, telefone..."
            onChange={
              event =>
                setSearch(
                  event.target.value
                )
            }
          />
        </label>

        {projectOptions.length > 1 && (
          <label className="assisted-project-filter">
            <span>
              Projeto
            </span>

            <select
              value={
                projectFilter
              }
              onChange={
                event =>
                  setProjectFilter(
                    event.target.value
                  )
              }
            >
              <option value="all">
                Todos
              </option>

              {projectOptions.map(
                project => (
                  <option
                    key={
                      project.id
                    }
                    value={
                      project.id
                    }
                  >
                    {project.name}
                  </option>
                )
              )}
            </select>
          </label>
        )}
      </div>

      <div className="assisted-summary-cards">
        <div>
          <strong>
            {assistedSummary.active}
          </strong>

          <span>
            Ativos
          </span>
        </div>

        <div>
          <strong>
            {assistedSummary.inactive}
          </strong>

          <span>
            Inativos
          </span>
        </div>

        <div>
          <strong>
            {filteredAssisted.length}
          </strong>

          <span>
            Visíveis
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="assisted-empty">
          Carregando Assistidos...
        </div>
      ) : !filteredAssisted.length ? (
        <div className="assisted-empty">
          <span>
            👤
          </span>

          <strong>
            Nenhum Assistido encontrado
          </strong>

          <p>
            Importe um CSV para começar
            a construir a base permanente.
          </p>
        </div>
      ) : (
        <div className="assisted-list">
          {filteredAssisted.map(
            person => (
              <article
                key={
                  person.id
                }
                className="assisted-card"
              >
                <div className="assisted-card-avatar">
                  {String(
                    person.full_name ||
                    '?'
                  )
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="assisted-card-main">
                  <div className="assisted-card-title">
                    <div>
                      <strong>
                        {
                          person.full_name
                        }
                      </strong>

                      <span>
                        {
                          person.project_name
                        }
                      </span>
                    </div>

                    <div className="assisted-card-actions">
                      {!person.active && (
                        <small className="assisted-inactive">
                          Inativo
                        </small>
                      )}

                      <button
                        type="button"
                        className="assisted-card-action"
                        onClick={
                          () =>
                            openEdit(
                              person
                            )
                        }
                      >
                        ✏️ Editar
                      </button>

                      <button
                        type="button"
                        className={
                          `assisted-card-action ${
                            Number(
                              person.active
                            ) === 1
                              ? 'is-danger'
                              : 'is-success'
                          }`
                        }
                        onClick={
                          () =>
                            setPersonActive(
                              person
                            )
                        }
                        disabled={
                          changingActiveId ===
                          person.id
                        }
                      >
                        {
                          changingActiveId ===
                          person.id
                            ? 'Salvando...'
                            : Number(
                                person.active
                              ) === 1
                              ? 'Inativar'
                              : 'Reativar'
                        }
                      </button>
                    </div>
                  </div>

                  <div className="assisted-card-grid">
                    <div>
                      <small>
                        Nascimento
                      </small>

                      <span>
                        {
                          formatDate(
                            person.birth_date
                          )
                        }
                      </span>
                    </div>

                    <div>
                      <small>
                        Responsável
                      </small>

                      <span>
                        {
                          person.guardian_name ||
                          '—'
                        }
                      </span>
                    </div>

                    <div>
                      <small>
                        Telefone
                      </small>

                      <span>
                        {
                          person.guardian_phone ||
                          '—'
                        }
                      </span>
                    </div>

                    <div>
                      <small>
                        Alergias
                      </small>

                      <span>
                        {
                          person.allergies ||
                          'Nenhuma informada'
                        }
                      </span>
                    </div>
                  </div>

                  {person.notes && (
                    <div className="assisted-card-notes">
                      <small>
                        Observações
                      </small>

                      <p>
                        {person.notes}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            )
          )}
        </div>
      )}

      {editingPerson &&
        editForm &&
        createPortal(
          <div
            className="assisted-edit-backdrop"
          role="presentation"
          onMouseDown={
            event => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeEdit()
              }
            }
          }
        >
          <form
            className="assisted-edit-modal"
            onSubmit={
              saveEdit
            }
          >
            <div className="assisted-edit-header">
              <div>
                <p className="assisted-eyebrow">
                  EDIÇÃO DE CADASTRO
                </p>

                <h3>
                  {editingPerson.full_name}
                </h3>
              </div>

              <button
                type="button"
                className="assisted-edit-close"
                onClick={
                  closeEdit
                }
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="assisted-edit-grid">
              <label>
                <span>
                  Nome completo
                </span>

                <input
                  value={
                    editForm.fullName
                  }
                  onChange={
                    event =>
                      updateEditField(
                        'fullName',
                        event.target.value
                      )
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Data de nascimento
                </span>

                <input
                  type="date"
                  value={
                    editForm.birthDate
                  }
                  onChange={
                    event =>
                      updateEditField(
                        'birthDate',
                        event.target.value
                      )
                  }
                />
              </label>

              <label>
                <span>
                  Responsável
                </span>

                <input
                  value={
                    editForm.guardianName
                  }
                  onChange={
                    event =>
                      updateEditField(
                        'guardianName',
                        event.target.value
                      )
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Telefone do responsável
                </span>

                <input
                  value={
                    editForm.guardianPhone
                  }
                  onChange={
                    event =>
                      updateEditField(
                        'guardianPhone',
                        event.target.value
                      )
                  }
                  required
                />
              </label>

              <label className="assisted-edit-wide">
                <span>
                  Forma de saída
                </span>

                <textarea
                  value={
                    editForm.departureMethod
                  }
                  onChange={
                    event =>
                      updateEditField(
                        'departureMethod',
                        event.target.value
                      )
                  }
                  rows="2"
                />
              </label>

              <label className="assisted-edit-wide">
                <span>
                  Alergias
                </span>

                <textarea
                  value={
                    editForm.allergies
                  }
                  onChange={
                    event =>
                      updateEditField(
                        'allergies',
                        event.target.value
                      )
                  }
                  rows="2"
                />
              </label>

              <label className="assisted-edit-wide">
                <span>
                  Observações
                </span>

                <textarea
                  value={
                    editForm.notes
                  }
                  onChange={
                    event =>
                      updateEditField(
                        'notes',
                        event.target.value
                      )
                  }
                  rows="3"
                />
              </label>

              {access?.scope === 'global' && (
                <label>
                  <span>
                    Projeto
                  </span>

                  <select
                    value={
                      editForm.projectId
                    }
                    onChange={
                      event =>
                        updateEditField(
                          'projectId',
                          event.target.value
                        )
                    }
                  >
                    {projects.map(
                      project => (
                        <option
                          key={
                            project.id
                          }
                          value={
                            project.id
                          }
                        >
                          {project.name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}
            </div>

            <div className="assisted-edit-actions">
              <button
                type="button"
                className="assisted-secondary-button"
                onClick={
                  closeEdit
                }
                disabled={
                  isSavingEdit
                }
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="assisted-primary-button"
                disabled={
                  isSavingEdit
                }
              >
                {isSavingEdit
                  ? 'Salvando...'
                  : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  )
}
