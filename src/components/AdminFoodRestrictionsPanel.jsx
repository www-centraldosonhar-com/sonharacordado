import {
  useEffect,
  useMemo,
  useState,
} from 'react'


export default function AdminFoodRestrictionsPanel() {
  const [
    assisted,
    setAssisted,
  ] =
    useState([])

  const [
    volunteers,
    setVolunteers,
  ] =
    useState([])

  const [
    group,
    setGroup,
  ] =
    useState('assisted')

  const [
    answerFilter,
    setAnswerFilter,
  ] =
    useState('all')

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
              'Não foi possível carregar as informações de Alimentação.'
            )
          }

          if (!cancelled) {
            setAssisted(
              result.assisted || []
            )

            setVolunteers(
              result.volunteers || []
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


  const currentRows =
    group === 'assisted'
      ? assisted
      : volunteers


  const visible =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase()

        return currentRows.filter(
          person => {
            const allergies =
              String(
                person.allergies || ''
              ).toLowerCase()

            if (
              answerFilter === 'yes' &&
              !allergies.includes('sim')
            ) {
              return false
            }

            if (
              answerFilter === 'no' &&
              !(
                allergies.includes('não') ||
                allergies.includes('nao')
              )
            ) {
              return false
            }

            if (!term) {
              return true
            }

            return [
              person.full_name,
              person.allergies,
              person.project_name,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(term)
          }
        )
      },
      [
        currentRows,
        search,
        answerFilter,
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
            Consulta rápida de informações
            registradas para Assistidos e
            Voluntários.
          </p>
        </div>
      </div>


      <div className="food-group-tabs">
        <button
          type="button"
          className={
            group === 'assisted'
              ? 'is-active'
              : ''
          }
          onClick={
            () =>
              setGroup(
                'assisted'
              )
          }
        >
          Assistidos
          <span>
            {assisted.length}
          </span>
        </button>

        <button
          type="button"
          className={
            group === 'volunteers'
              ? 'is-active'
              : ''
          }
          onClick={
            () =>
              setGroup(
                'volunteers'
              )
          }
        >
          Voluntários
          <span>
            {volunteers.length}
          </span>
        </button>
      </div>


      <div className="food-answer-filters">
        {[
          ['all', 'Todos'],
          ['yes', 'Sim'],
          ['no', 'Não'],
        ].map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                answerFilter === value
                  ? 'is-active'
                  : ''
              }
              onClick={
                () =>
                  setAnswerFilter(
                    value
                  )
              }
            >
              {label}
            </button>
          )
        )}
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


      <div className="food-visible-summary">
        <strong>
          {visible.length}
        </strong>

        <span>
          registro{
            visible.length === 1
              ? ''
              : 's'
          } neste filtro
        </span>
      </div>


      {!visible.length ? (
        <div className="food-restrictions-empty">
          <strong>
            Nenhum registro encontrado
          </strong>

          <span>
            Ajuste a busca ou o filtro.
          </span>
        </div>
      ) : (
        <div className="food-restrictions-list">
          {visible.map(
            person => (
              <article
                key={`${group}-${person.id}`}
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

                  <div className="food-restriction-alert">
                    <small>
                      ⚠️ ALERGIA / RESTRIÇÃO
                    </small>

                    <p>
                      {
                        person.allergies
                      }
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
