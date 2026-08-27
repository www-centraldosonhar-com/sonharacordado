import {
  useEffect,
  useMemo,
  useState,
} from 'react'


export default function AdminFoodRestrictionsPanel() {
  const [
    restrictions,
    setRestrictions,
  ] =
    useState([])

  const [
    search,
    setSearch,
  ] =
    useState('')

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')


  useEffect(
    () => {
      let cancelled = false

      async function load() {
        try {
          const response =
            await fetch(
              '/api/admin?action=food'
            )

          const result =
            await response.json()

          if (!response.ok) {
            throw new Error(
              result.error ||
              'Não foi possível carregar as restrições alimentares.'
            )
          }

          if (!cancelled) {
            setRestrictions(
              result.restrictions || []
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
            setLoading(false)
          }
        }
      }

      load()

      return () => {
        cancelled = true
      }
    },
    []
  )


  const visible =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase()

        if (!term) {
          return restrictions
        }

        return restrictions.filter(
          person =>
            [
              person.full_name,
              person.allergies,
              person.project_name,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(term)
        )
      },
      [
        restrictions,
        search,
      ]
    )


  if (loading) {
    return (
      <div className="food-restrictions-empty">
        Carregando informações de Alimentação...
      </div>
    )
  }


  if (error) {
    return (
      <div className="food-restrictions-error">
        {error}
      </div>
    )
  }


  return (
    <div className="food-restrictions-panel">
      <div className="food-restrictions-head">
        <div>
          <p className="assisted-eyebrow">
            CUIDADO E ALIMENTAÇÃO
          </p>

          <h3>
            Alergias e restrições
          </h3>

          <p>
            Consulta dos Assistidos ativos que
            possuem alguma informação alimentar
            relevante.
          </p>
        </div>

        <div className="food-restrictions-count">
          <strong>
            {restrictions.length}
          </strong>

          <span>
            atenção{
              restrictions.length === 1
                ? ''
                : 'ões'
            }
          </span>
        </div>
      </div>


      <label className="food-restrictions-search">
        <span>
          Buscar
        </span>

        <input
          type="search"
          value={search}
          placeholder="Nome ou alergia..."
          onChange={
            event =>
              setSearch(
                event.target.value
              )
          }
        />
      </label>


      {!visible.length ? (
        <div className="food-restrictions-empty">
          <strong>
            Nenhuma restrição encontrada 🎉
          </strong>

          <span>
            Não há Assistidos neste filtro com
            alergias registradas.
          </span>
        </div>
      ) : (
        <div className="food-restrictions-list">
          {visible.map(
            person => (
              <article
                key={person.id}
                className="food-restriction-card"
              >
                <div className="food-restriction-avatar">
                  {String(
                    person.full_name ||
                    '?'
                  )
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="food-restriction-main">
                  <div className="food-restriction-title">
                    <strong>
                      {person.full_name}
                    </strong>

                    <span>
                      {person.project_name}
                    </span>
                  </div>

                  <div className="food-restriction-alert">
                    <small>
                      ⚠️ ALERGIA / RESTRIÇÃO
                    </small>

                    <p>
                      {person.allergies}
                    </p>
                  </div>
                </div>
              </article>
            )
          )}
        </div>
      )}
    </div>
  )
}
