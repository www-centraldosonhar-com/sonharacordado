import {
  useEffect,
  useState,
} from 'react'

function AdminChecklistPanel({
  activity,
  participants = [],
}) {
  const [
    checklists,
    setChecklists,
  ] = useState([])

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


  const activityParticipants =
    participants.filter(
      (participant) =>
        Number(
          participant.event_role_id
        ) ===
        Number(activity.id)
    )


  // =====================================================
  // INITIAL LOAD
  // =====================================================

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
            'Não foi possível carregar o check-in.'
          )
        }

        if (!active) {
          return
        }

        const loaded =
          result.checklists || []

        setChecklists(loaded)

        if (
          loaded[0]
            ?.assigned_user_id
        ) {
          setAssignedUserId(
            String(
              loaded[0]
                .assigned_user_id
            )
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


  // =====================================================
  // ASSISTIDOS
  // =====================================================

  if (
    activity.role_name ===
    'Recepção e Check-in de Assistidos'
  ) {
    return (
      <div className="admin-checklist-panel">
        <h4>
          🧒 Check-in de Assistidos
        </h4>

        <p className="admin-form-help">
          A função de check-in está habilitada,
          mas a lista será conectada ao cadastro
          de assistidos na próxima etapa.
        </p>
      </div>
    )
  }


  // =====================================================
  // VOLUNTEERS
  // =====================================================

  async function handleAssign(
    event
  ) {
    event.preventDefault()

    if (!assignedUserId) {
      setMessage(
        'Escolha o responsável pelo check-in.'
      )
      return
    }

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
                  'assign',

                eventRoleId:
                  activity.id,

                assignedUserId:
                  Number(
                    assignedUserId
                  ),
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível definir o responsável.'
        )
      }

      setChecklists(
        [result.checklist]
      )

      setMessage(
        '✅ Responsável pelo check-in definido!'
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  const checklist =
    checklists[0] || null


  return (
    <div className="admin-checklist-panel">
      <h4>
        ☑️ Check-in de Voluntários
      </h4>

      <p className="admin-form-help">
        A lista é formada automaticamente
        pelos voluntários com inscrição
        confirmada neste evento.
      </p>

      {activityParticipants.length === 0 ? (
        <div className="admin-checklist-item">
          <div>
            <strong>
              Aguardando responsável
            </strong>

            <span>
              Primeiro alguém precisa confirmar
              participação nesta atividade.
            </span>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleAssign}
          className="admin-checklist-create"
        >
          <label>
            Responsável pelo check-in
          </label>

          <select
            value={assignedUserId}
            onChange={(event) =>
              setAssignedUserId(
                event.target.value
              )
            }
            required
          >
            <option value="">
              Selecione
            </option>

            {activityParticipants.map(
              (participant) => (
                <option
                  key={
                    participant.user_id
                  }
                  value={
                    participant.user_id
                  }
                >
                  {participant.user_name}
                  {' — '}
                  {participant.project_name}
                </option>
              )
            )}
          </select>

          <button
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? 'Salvando...'
              : checklist
                ? 'Atualizar responsável'
                : 'Definir responsável'}
          </button>
        </form>
      )}

      {checklist && (
        <div className="admin-checklist-item">
          <div>
            <strong>
              ✅ Check-in preparado
            </strong>

            <span>
              Acesso liberado ao responsável.
            </span>
          </div>

          <small>
            {checklist.checked_items !== undefined
              ? `${checklist.checked_items} / ${checklist.total_items}`
              : 'Ativo'}
          </small>
        </div>
      )}

      {message && (
        <p className="admin-form-help">
          {message}
        </p>
      )}
    </div>
  )
}

export default AdminChecklistPanel
