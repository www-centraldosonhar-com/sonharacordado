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

  const [
    isLocked,
    setIsLocked,
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

        setIsLocked(
          Boolean(
            result.locked
          )
        )

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

  const isAssistedChecklist =
    activity.role_name ===
      'Recepção / Check-in de Assistidos' ||
    activity.role_name ===
      'Despedida / Check-out de Assistidos'

  const isCheckout =
    activity.role_name ===
    'Despedida / Check-out de Assistidos'

  const checklistTitle =
    isAssistedChecklist
      ? isCheckout
        ? '👋 Check-out de Assistidos'
        : '🧒 Check-in de Assistidos'
      : '☑️ Recepção / Check-in de Voluntários'

  const checklistDescription =
    isAssistedChecklist
      ? 'A lista é formada automaticamente pelos Assistidos ativos do projeto deste evento.'
      : 'A lista é formada automaticamente pelos voluntários com inscrição confirmada neste evento.'

  const responsibleLabel =
    isAssistedChecklist
      ? isCheckout
        ? 'Responsável pelo check-out'
        : 'Responsável pelo check-in'
      : 'Responsável pelo check-in'


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
        {checklistTitle}
      </h4>

      <p className="admin-form-help">
        {checklistDescription}
      </p>

      {isLocked && (
        <div className="admin-checklist-item">
          <div>
            <strong>
              🔒 Checklist encerrada
            </strong>

            <span>
              O evento entrou em Pós-Evento.
              A lista permanece disponível
              somente como histórico.
            </span>
          </div>
        </div>
      )}

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
            {responsibleLabel}
          </label>

          <select
            value={assignedUserId}
            disabled={isLocked}
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
            disabled={
              isLoading ||
              isLocked
            }
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
              ✅ Checklist preparada
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
