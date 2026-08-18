import { useState } from 'react'
import { formatDateTimeBr } from '../utils/formatters'

function MissionCard({
  mission,
  mine = false,
  onUpdated,
}) {
  const [isLoading, setIsLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [deliveryLink, setDeliveryLink] =
    useState(mission.delivery_link || '')

  const priorityLabel = {
    urgent: 'Urgente',
    important: 'Importante',
    normal: 'Normal',
  }

  async function handleJoin() {
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/join-task',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            taskId: mission.id,
          }),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível entrar na missão.'
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


  async function handleLeave() {
    if (!window.confirm(
      'Tem certeza que deseja sair dessa missão?'
    )) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/leave-task',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            participationId:
              mission.participation_id,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível sair da missão.'
        )
      }

      await onUpdated()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelivery() {
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/submit-delivery',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            participationId:
              mission.participation_id,
            deliveryLink,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível salvar a entrega.'
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

  const isFull =
    !mine &&
    Number(mission.volunteer_count || 0) >=
      Number(mission.volunteer_limit || 0)

  return (
    <article className="modern-card interactive-card">
      <div className="card-topline">
        <span className="card-icon">
          {mine ? '📝' : '💡'}
        </span>

        <span
          className={`priority-pill priority-${mission.priority}`}
        >
          {priorityLabel[
            mission.priority
          ] || 'Normal'}
        </span>
      </div>

      <h3>{mission.title}</h3>

      {mission.description && (
        <p className="body-copy">
          {mission.description}
        </p>
      )}

      <div className="mini-meta">
        {mission.deadline && (
          <span>
            ⏰ {formatDateTimeBr(mission.deadline)}
          </span>
        )}

        {!mine && (
          <span>
            👥 {mission.volunteer_count || 0}
            {' de '}
            {mission.volunteer_limit || 0}
          </span>
        )}
      </div>

      {mine && (
        <div className="delivery-box">
          <p className="delivery-title">
            📁 Minha entrega
          </p>

          <input
            className="delivery-input"
            type="url"
            value={deliveryLink}
            onChange={(event) =>
              setDeliveryLink(event.target.value)
            }
            placeholder="https://drive.google.com/..."
          />

          <button
            type="button"
            className="secondary-button"
            disabled={isLoading}
            onClick={handleDelivery}
          >
            {mission.delivery_link
              ? 'Atualizar entrega'
              : 'Enviar entrega'}
          </button>

          <button
            type="button"
            className="danger-outline-button"
            disabled={isLoading}
            onClick={handleLeave}
          >
            Sair da missão
          </button>
        </div>
      )}

      {!mine && !mission.overdue && !isFull && (
        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={handleJoin}
        >
          {isLoading
            ? 'Entrando...'
            : 'Quero entrar nessa missão ✨'}
        </button>
      )}

      {!mine && mission.overdue && (
        <p className="card-message">
          🔒 O prazo dessa missão já encerrou.
        </p>
      )}

      {!mine && isFull && (
        <p className="card-message">
          ✅ Essa missão já encontrou seu time.
        </p>
      )}

      {message && (
        <p className="action-message">
          {message}
        </p>
      )}
    </article>
  )
}

export default MissionCard
