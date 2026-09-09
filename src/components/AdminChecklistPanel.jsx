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
    message,
    setMessage,
  ] = useState('')

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
            'Não foi possível carregar a checklist.'
          )
        }

        if (!active) {
          return
        }

        setChecklists(
          result.checklists || []
        )

        setIsLocked(
          Boolean(result.locked)
        )
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

      <div className="admin-checklist-item">
        <div>
          <strong>
            🔓 Acesso automático
          </strong>

          <span>
            Todos os voluntários confirmados nesta atividade
            podem abrir e operar a mesma checklist compartilhada.
          </span>
        </div>

        <small>
          {activityParticipants.length}
          {' '}
          confirmado{activityParticipants.length === 1 ? '' : 's'}
        </small>
      </div>

      {checklist && (
        <div className="admin-checklist-item">
          <div>
            <strong>
              ✅ Checklist preparada
            </strong>

            <span>
              Acesso liberado automaticamente aos confirmados nesta atividade.
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
