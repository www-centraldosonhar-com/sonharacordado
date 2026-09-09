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
    assignedUserIds,
    setAssignedUserIds,
  ] = useState(['', ''])

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

        const loadedAssignees =
          Array.isArray(
            loaded[0]?.assigned_users
          )
            ? loaded[0].assigned_users
            : []

        if (loadedAssignees.length) {
          setAssignedUserIds([
            String(
              loadedAssignees[0]
                ?.user_id || ''
            ),
            String(
              loadedAssignees[1]
                ?.user_id || ''
            ),
          ])
        } else if (
          loaded[0]
            ?.assigned_user_id
        ) {
          // Compatibilidade durante a migração.
          setAssignedUserIds([
            String(
              loaded[0]
                .assigned_user_id
            ),
            '',
          ])
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
        ? 'Responsáveis pelo check-out'
        : 'Responsáveis pelo check-in'
      : 'Responsáveis pelo check-in'


  // =====================================================
  // VOLUNTEERS
  // =====================================================

  async function handleAssign(
    event
  ) {
    event.preventDefault()

    const selectedAssignees =
      assignedUserIds
        .filter(Boolean)
        .map(Number)

    if (selectedAssignees.length === 0) {
      setMessage(
        'Escolha pelo menos um responsável.'
      )
      return
    }

    if (
      new Set(selectedAssignees).size !==
      selectedAssignees.length
    ) {
      setMessage(
        'Escolha pessoas diferentes para os dois responsáveis.'
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

                assignedUserIds:
                  selectedAssignees,
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

      const savedAssignees =
        Array.isArray(
          result.checklist
            ?.assigned_users
        )
          ? result.checklist.assigned_users
          : []

      if (savedAssignees.length) {
        setAssignedUserIds([
          String(
            savedAssignees[0]
              ?.user_id || ''
          ),
          String(
            savedAssignees[1]
              ?.user_id || ''
          ),
        ])
      }

      setMessage(
        '✅ Responsáveis definidos!'
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

          <div className="admin-checklist-assignees">
            {[0, 1].map(
              (index) => (
                <label
                  key={index}
                  className="admin-checklist-assignee"
                >
                  <span>
                    Responsável {index + 1}
                    {index === 1
                      ? ' (opcional)'
                      : ''}
                  </span>

                  <select
                    value={
                      assignedUserIds[index]
                    }
                    disabled={isLocked}
                    onChange={(event) => {
                      const value =
                        event.target.value

                      setAssignedUserIds(
                        (current) => {
                          const next =
                            [...current]

                          next[index] = value

                          return next
                        }
                      )
                    }}
                    required={index === 0}
                  >
                    <option value="">
                      {index === 0
                        ? 'Selecione'
                        : 'Sem segundo responsável'}
                    </option>

                    {activityParticipants.map(
                      (participant) => {
                        const value =
                          String(
                            participant.user_id
                          )

                        const otherIndex =
                          index === 0 ? 1 : 0

                        return (
                          <option
                            key={
                              participant.user_id
                            }
                            value={
                              participant.user_id
                            }
                            disabled={
                              assignedUserIds[
                                otherIndex
                              ] === value
                            }
                          >
                            {participant.user_name}
                            {' — '}
                            {participant.project_name}
                          </option>
                        )
                      }
                    )}
                  </select>
                </label>
              )
            )}
          </div>

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
                ? 'Atualizar responsáveis'
                : 'Definir responsáveis'}
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
              Acesso liberado aos responsáveis da mesma checklist.
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
