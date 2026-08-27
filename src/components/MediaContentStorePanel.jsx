import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatEventDate(value) {
  if (!value) return ''

  const raw = String(value).slice(0, 10)
  const [year, month, day] = raw.split('-')

  if (!year || !month || !day) {
    return raw
  }

  return `${day}/${month}/${year}`
}

function getRoleIcon(roleName) {
  const normalized = normalizeText(roleName)

  if (normalized.includes('story')) {
    return '🎥'
  }

  return '📸'
}

function MediaContentStorePanel() {
  const [data, setData] = useState({
    myAssignments: [],
    items: [],
    total: 0,
  })

  const [drafts, setDrafts] = useState({})
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] =
    useState('all')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')

  const loadStore = useCallback(async () => {
    try {
      setError('')

      const response = await fetch(
        '/api/volunteer?action=media-content-store'
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível carregar o Armazém.'
        )
      }

      setData({
        myAssignments:
          result.myAssignments || [],
        items:
          result.items || [],
        total:
          Number(result.total || 0),
      })

      setDrafts((current) => {
        const next = { ...current }

        for (
          const assignment
          of result.myAssignments || []
        ) {
          const key =
            String(assignment.event_role_id)

          if (next[key] === undefined) {
            next[key] =
              assignment.drive_link || ''
          }
        }

        return next
      })
    } catch (loadError) {
      setError(
        loadError?.message ||
        'Não foi possível carregar o Armazém.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStore()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadStore])

  async function saveMaterial(assignment) {
    const eventRoleId =
      assignment.event_role_id

    const driveLink =
      String(
        drafts[String(eventRoleId)] || ''
      ).trim()

    if (!driveLink) {
      window.alert(
        'Cole o link da pasta do Google Drive.'
      )
      return
    }

    try {
      setSavingId(eventRoleId)

      const response = await fetch(
        '/api/volunteer?action=media-content-store',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            eventRoleId,
            driveLink,
          }),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível salvar o material.'
        )
      }

      await loadStore()

      window.alert(
        result.message ||
        'Material salvo! 📦'
      )
    } catch (saveError) {
      window.alert(
        saveError?.message ||
        'Não foi possível salvar o material.'
      )
    } finally {
      setSavingId(null)
    }
  }

  const projects = useMemo(() => {
    const map = new Map()

    for (const item of data.items) {
      const key =
        String(item.project_id || 'global')

      const label =
        item.project_name || 'Geral'

      map.set(key, label)
    }

    return Array.from(map.entries())
  }, [data.items])

  const visibleItems = useMemo(() => {
    const normalizedSearch =
      normalizeText(search)

    return data.items.filter((item) => {
      if (
        projectFilter !== 'all' &&
        String(
          item.project_id || 'global'
        ) !== projectFilter
      ) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack =
        normalizeText(
          [
            item.event_name,
            item.project_name,
            item.role_name,
            item.user_name,
          ].join(' ')
        )

      return haystack.includes(
        normalizedSearch
      )
    })
  }, [
    data.items,
    projectFilter,
    search,
  ])

  if (loading) {
    return (
      <section
        className="section-block media-store-section"
        id="armazem-criacao"
      >
        <div className="media-store-loading">
          Abrindo o Armazém de Criação... 📦
        </div>
      </section>
    )
  }

  return (
    <section
      className="section-block media-store-section"
      id="armazem-criacao"
    >
      <div className="section-heading">
        <p className="eyebrow eyebrow-blue">
          EQUIPE DE MÍDIAS
        </p>

        <h2>
          Armazém de Criação 📦
        </h2>

        <p>
          Materiais de fotografia, vídeos e takes
          compartilhados entre toda a equipe de Mídias.
        </p>
      </div>

      {error && (
        <div className="media-store-error">
          {error}

          <button
            type="button"
            onClick={loadStore}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {data.myAssignments.length > 0 && (
        <div className="media-store-deposit">
          <div className="media-store-subheading">
            <div>
              <span>
                MEUS MATERIAIS
              </span>

              <h3>
                Depositar no Armazém
              </h3>
            </div>

            <small>
              Sem aprovação
            </small>
          </div>

          <div className="media-store-assignment-list">
            {data.myAssignments.map(
              (assignment) => {
                const eventRoleId =
                  assignment.event_role_id

                const alreadySaved =
                  Boolean(
                    assignment.delivery_id
                  )

                return (
                  <article
                    className="media-store-assignment"
                    key={eventRoleId}
                  >
                    <div className="media-store-assignment-info">
                      <span className="media-store-role-icon">
                        {getRoleIcon(
                          assignment.role_name
                        )}
                      </span>

                      <div>
                        <strong>
                          {assignment.event_name}
                        </strong>

                        <p>
                          {assignment.role_name}
                          {' · '}
                          {assignment.project_name ||
                            'Sonhar Acordado'}
                        </p>

                        {assignment.event_date && (
                          <small>
                            {formatEventDate(
                              assignment.event_date
                            )}
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="media-store-input-row">
                      <input
                        type="url"
                        value={
                          drafts[
                            String(eventRoleId)
                          ] || ''
                        }
                        onChange={(event) =>
                          setDrafts(
                            (current) => ({
                              ...current,
                              [String(
                                eventRoleId
                              )]:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="https://drive.google.com/..."
                      />

                      <button
                        type="button"
                        disabled={
                          savingId ===
                          eventRoleId
                        }
                        onClick={() =>
                          saveMaterial(
                            assignment
                          )
                        }
                      >
                        {savingId ===
                        eventRoleId
                          ? 'Salvando...'
                          : alreadySaved
                            ? 'Atualizar material'
                            : 'Depositar material'}
                      </button>
                    </div>

                    {alreadySaved && (
                      <span className="media-store-saved">
                        ✓ Material já disponível no Armazém
                      </span>
                    )}
                  </article>
                )
              }
            )}
          </div>
        </div>
      )}

      <div className="media-store-library">
        <div className="media-store-library-head">
          <div>
            <span>
              BIBLIOTECA COMPARTILHADA
            </span>

            <h3>
              Materiais da Mídias
            </h3>
          </div>

          <strong>
            {visibleItems.length}{' '}
            {visibleItems.length === 1
              ? 'material'
              : 'materiais'}
          </strong>
        </div>

        <div className="media-store-toolbar">
          <div className="media-store-project-filters">
            <button
              type="button"
              className={
                projectFilter === 'all'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setProjectFilter('all')
              }
            >
              Todos
            </button>

            {projects.map(
              ([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={
                    projectFilter === key
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setProjectFilter(key)
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>

          <input
            className="media-store-search"
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Buscar evento, pessoa ou função..."
          />
        </div>

        {visibleItems.length > 0 ? (
          <div className="media-store-grid">
            {visibleItems.map(
              (item) => (
                <article
                  className="media-store-card"
                  key={item.id}
                >
                  <div className="media-store-card-top">
                    <span className="media-store-role-icon">
                      {getRoleIcon(
                        item.role_name
                      )}
                    </span>

                    <span className="media-store-project">
                      {item.project_name ||
                        'GERAL'}
                    </span>
                  </div>

                  <h4>
                    {item.event_name}
                  </h4>

                  <p>
                    <strong>
                      {item.role_name}
                    </strong>
                    {' · '}
                    {item.user_name}
                  </p>

                  {item.event_date && (
                    <small>
                      {formatEventDate(
                        item.event_date
                      )}
                    </small>
                  )}

                  <a
                    href={item.drive_link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir material no Drive ↗
                  </a>
                </article>
              )
            )}
          </div>
        ) : (
          <div className="media-store-empty">
            <span>📦</span>

            <div>
              <strong>
                Nenhum material encontrado.
              </strong>

              <p>
                Quando Fotógrafos e Storymakers
                depositarem seus materiais,
                eles aparecerão aqui.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default MediaContentStorePanel
