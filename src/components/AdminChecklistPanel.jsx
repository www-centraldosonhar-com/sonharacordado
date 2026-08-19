import {
  useEffect,
  useState,
} from 'react'

function AdminChecklistPanel({
  activity,
  users = [],
}) {
  const [
    checklists,
    setChecklists,
  ] = useState([])

  const [
    title,
    setTitle,
  ] = useState('')

  const [
    assignedUserId,
    setAssignedUserId,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)


  async function loadChecklists() {
    try {
      const params =
        new URLSearchParams({
          operation:
            'list-activity',

          eventRoleId:
            String(activity.id),
        })

      const response =
        await fetch(
          `/api/checklist?${params}`
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível carregar as checklists.'
        )
      }

      setChecklists(
        result.checklists || []
      )
    } catch (error) {
      setMessage(
        error.message
      )
    }
  }


  useEffect(() => {
    let active = true

    const params =
      new URLSearchParams({
        operation:
          'list-activity',

        eventRoleId:
          String(activity.id),
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
            'Não foi possível carregar as checklists.'
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

    return () => {
      active = false
    }
  }, [activity.id])


  async function handleCreate(
    event
  ) {
    event.preventDefault()

    setIsLoading(true)
    setMessage('')

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
                  'create',

                eventRoleId:
                  activity.id,

                title,

                assignedUserId:
                  assignedUserId ||
                  null,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível criar a checklist.'
        )
      }

      setMessage(
        '✅ Checklist criada!'
      )

      setTitle('')
      setAssignedUserId('')

      await loadChecklists()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className="admin-checklist-panel">
      <h4>
        ☑️ Checklists da atividade
      </h4>

      {checklists.length > 0 && (
        <div className="admin-checklist-list">
          {checklists.map(
            (checklist) => (
              <div
                key={checklist.id}
                className="admin-checklist-item"
              >
                <div>
                  <strong>
                    {checklist.title}
                  </strong>

                  <span>
                    👤{' '}
                    {checklist
                      .assigned_user_name ||
                      'Sem responsável'}
                  </span>
                </div>

                <small>
                  ✅{' '}
                  {checklist.checked_items}
                  {' / '}
                  {checklist.total_items}
                </small>
              </div>
            )
          )}
        </div>
      )}

      <details className="admin-checklist-create">
        <summary>
          ➕ Criar checklist
        </summary>

        <form
          onSubmit={handleCreate}
        >
          <label>
            Nome da checklist
          </label>

          <input
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
            placeholder="Ex.: Conferência de voluntários"
            required
          />

          <label>
            Responsável
          </label>

          <select
            value={assignedUserId}
            onChange={(event) =>
              setAssignedUserId(
                event.target.value
              )
            }
          >
            <option value="">
              Definir depois
            </option>

            {users
              .filter(
                (user) =>
                  Number(user.active) === 1
              )
              .map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                  {' — '}
                  {user.project}
                </option>
              ))}
          </select>

          <p className="admin-form-help">
            A lista será preenchida
            automaticamente com os
            voluntários confirmados
            neste evento.
          </p>

          <button
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? 'Criando...'
              : 'Criar checklist'}
          </button>
        </form>
      </details>

      {message && (
        <p className="admin-form-help">
          {message}
        </p>
      )}
    </div>
  )
}

export default AdminChecklistPanel
