import { useState } from 'react'

// =========================================================
// ADMIN PARTICIPANT ACTION
// =========================================================
// Controla a aprovação/conclusão individual de:
// - participação em atividade;
// - participação em missão.
//
// O backend define a conclusão através do campo completed_at.
// =========================================================

function AdminParticipantAction({
  type,
  participant,
  onUpdated,
}) {
  const [isLoading, setIsLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  async function handleToggle() {
    const isCompleted =
      Boolean(participant.completed_at)

    const question = isCompleted
      ? 'Deseja remover a conclusão desta participação?'
      : type === 'activity'
        ? 'Confirmar que esta atividade foi concluída?'
        : 'Aprovar a conclusão desta missão?'

    if (!window.confirm(question)) {
      return
    }

    const action =
      type === 'activity'
        ? 'toggle-activity-participant'
        : 'toggle-task-participant'

    const id =
      type === 'activity'
        ? participant.confirmation_id
        : participant.participation_id

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/admin?action=update',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            action,
            id,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Não foi possível concluir.'
        )
      }

      setMessage(result.message)

      await onUpdated()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="admin-participant-action">
      <button
        type="button"
        disabled={isLoading}
        onClick={handleToggle}
      >
        {isLoading
          ? 'Salvando...'
          : participant.completed_at
            ? '↩️ Reabrir'
            : type === 'activity'
              ? '✅ Finalizar atividade'
              : '✅ Aprovar missão'}
      </button>

      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}
    </div>
  )
}

export default AdminParticipantAction
