import {
  useEffect,
  useMemo,
  useState,
} from 'react'

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
}

function VolunteerChecklistPanel({
  onUpdated,
}) {
  const [
    checklists,
    setChecklists,
  ] = useState([])

  const [
    selectedChecklistId,
    setSelectedChecklistId,
  ] = useState(null)

  const [
    checklist,
    setChecklist,
  ] = useState(null)

  const [
    items,
    setItems,
  ] = useState([])

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    filter,
    setFilter,
  ] = useState('all')

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)


  // =====================================================
  // LOAD MY CHECKLISTS
  // =====================================================

  useEffect(() => {
    let active = true

    fetch(
      '/api/checklist?operation=mine'
    )
      .then(async (response) => {
        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar suas checklists.'
          )
        }

        if (active) {
          setChecklists(
            result.checklists || []
          )
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error.message
          )
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])


  // =====================================================
  // LOAD CHECKLIST
  // =====================================================

  useEffect(() => {
    if (!selectedChecklistId) {
      return
    }

    let active = true

    const params =
      new URLSearchParams({
        operation: 'get',
        checklistId:
          String(
            selectedChecklistId
          ),
      })

    fetch(
      `/api/checklist?${params}`
    )
      .then(async (response) => {
        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível abrir a checklist.'
          )
        }

        if (active) {
          setChecklist(
            result.checklist
          )

          setItems(
            result.items || []
          )

          setSearch('')
          setFilter('all')
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error.message
          )
        }
      })

    return () => {
      active = false
    }
  }, [selectedChecklistId])


  // =====================================================
  // SEARCH + FILTER
  // =====================================================

  const filteredItems =
    useMemo(() => {
      const query =
        normalizeSearch(search)

      return items.filter(
        (item) => {
          const matchesSearch =
            !query ||
            normalizeSearch(
              item.user_name
            ).includes(query)

          if (!matchesSearch) {
            return false
          }

          if (
            filter === 'present'
          ) {
            return (
              Number(
                item.checked
              ) === 1
            )
          }

          if (
            filter === 'pending'
          ) {
            return (
              Number(
                item.checked
              ) !== 1
            )
          }

          return true
        }
      )
    }, [
      items,
      search,
      filter,
    ])


  const checkedCount =
    items.filter(
      (item) =>
        Number(item.checked) === 1
    ).length

  const pendingCount =
    items.length -
    checkedCount


  // =====================================================
  // TOGGLE PRESENCE
  // =====================================================

  async function toggleItem(
    item
  ) {
    const newChecked =
      Number(item.checked) === 1
        ? 0
        : 1

    // Atualização visual imediata.
    setItems(
      (current) =>
        current.map(
          (candidate) =>
            Number(candidate.id) ===
            Number(item.id)
              ? {
                  ...candidate,
                  checked:
                    newChecked,
                }
              : candidate
        )
    )

    try {
      const response =
        await fetch(
          '/api/checklist',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                operation:
                  'toggle',

                checklistId:
                  selectedChecklistId,

                itemId:
                  item.id,

                checked:
                  newChecked,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível atualizar.'
        )
      }

      if (onUpdated) {
        await onUpdated()
      }
    } catch (error) {
      // Desfaz atualização visual
      // caso o servidor rejeite.
      setItems(
        (current) =>
          current.map(
            (candidate) =>
              Number(candidate.id) ===
              Number(item.id)
                ? {
                    ...candidate,
                    checked:
                      item.checked,
                  }
                : candidate
          )
      )

      setMessage(
        error.message
      )
    }
  }


  if (isLoading) {
    return null
  }

  if (
    checklists.length === 0
  ) {
    // Se houve erro na API, não escondemos a mensagem.
    // Isso é importante principalmente para diagnosticar
    // problemas de acesso ou carregamento da checklist.
    if (message) {
      return (
        <section
          className="section-block volunteer-checklist-section"
          id="minhas-checklists"
        >
          <div className="section-heading">
            <p className="eyebrow eyebrow-blue">
              CHECK-IN
            </p>

            <h2>
              ☑️ Sua lista de check-in
            </h2>
          </div>

          <div className="empty-state">
            <p>
              ⚠️ {message}
            </p>
          </div>
        </section>
      )
    }

    return null
  }


  // =====================================================
  // CHECKLIST SELECTOR
  // =====================================================

  if (!selectedChecklistId) {
    return (
      <section
        className="section-block volunteer-checklist-section"
        id="minhas-checklists"
      >
        <div className="section-heading">
          <p className="eyebrow eyebrow-blue">
            MINHAS CHECKLISTS
          </p>

          <h2>
            Você está cuidando disso hoje ☑️
          </h2>
        </div>

        <div className="checklist-selector-grid">
          {checklists.map(
            (item) => (
              <button
                key={item.id}
                type="button"
                className="checklist-selector-card"
                onClick={() =>
                  setSelectedChecklistId(
                    item.id
                  )
                }
              >
                <strong>
                  {item.title}
                </strong>

                <span>
                  {item.event_name}
                </span>

                <small>
                  🙋 {item.activity_name}
                </small>

                {item.team_name && (
                  <small>
                    👥 {item.team_name}
                  </small>
                )}

                <div className="checklist-progress">
                  ✅ {item.checked_items}
                  {' / '}
                  {item.total_items}
                </div>
              </button>
            )
          )}
        </div>

        {message && (
          <p>{message}</p>
        )}
      </section>
    )
  }


  // =====================================================
  // CHECKLIST VIEW
  // =====================================================

  return (
    <section
      className="section-block volunteer-checklist-section"
      id="minhas-checklists"
    >
      <button
        type="button"
        className="checklist-back-button"
        onClick={() => {
          setSelectedChecklistId(
            null
          )

          setChecklist(null)
          setItems([])
        }}
      >
        ← Minhas checklists
      </button>

      <div className="section-heading">
        <p className="eyebrow eyebrow-blue">
          CHECKLIST
        </p>

        <h2>
          ☑️ {checklist?.title}
        </h2>

        <p>
          {checklist?.event_name}
          {' · '}
          {checklist?.activity_name}
        </p>
      </div>

      <div className="checklist-search-box">
        <span>🔎</span>

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Buscar pelo nome..."
          autoComplete="off"
        />
      </div>

      <div className="checklist-filter-row">
        <button
          type="button"
          className={
            filter === 'all'
              ? 'active'
              : ''
          }
          onClick={() =>
            setFilter('all')
          }
        >
          Todos {items.length}
        </button>

        <button
          type="button"
          className={
            filter === 'present'
              ? 'active'
              : ''
          }
          onClick={() =>
            setFilter('present')
          }
        >
          ✅ Presentes {checkedCount}
        </button>

        <button
          type="button"
          className={
            filter === 'pending'
              ? 'active'
              : ''
          }
          onClick={() =>
            setFilter('pending')
          }
        >
          ⏳ Pendentes {pendingCount}
        </button>
      </div>

      <div className="checklist-mobile-list">
        {filteredItems.length > 0 ? (
          filteredItems.map(
            (item) => {
              const checked =
                Number(
                  item.checked
                ) === 1

              return (
                <button
                  type="button"
                  key={item.id}
                  className={
                    checked
                      ? 'checklist-person checked'
                      : 'checklist-person'
                  }
                  onClick={() =>
                    toggleItem(item)
                  }
                >
                  <span className="checklist-person-box">
                    {checked
                      ? '✓'
                      : ''}
                  </span>

                  <span className="checklist-person-info">
                    <strong>
                      {item.user_name}
                    </strong>

                    <small>
                      {item.project_name}
                    </small>
                  </span>

                  <span className="checklist-person-status">
                    {checked
                      ? 'Presente'
                      : 'Pendente'}
                  </span>
                </button>
              )
            }
          )
        ) : (
          <div className="empty-state">
            <p>
              Nenhuma pessoa encontrada.
            </p>
          </div>
        )}
      </div>

      {message && (
        <p className="checklist-message">
          {message}
        </p>
      )}
    </section>
  )
}

export default VolunteerChecklistPanel
