import { useState } from 'react'

function ActivityCard({
  activity,
  onUpdated,
}) {
  const [isLoading, setIsLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const confirmed =
    Number(activity.confirmed_count || 0)

  const limit =
    Number(activity.vacancy_limit || 0)

  const remaining = Math.max(
    0,
    limit - confirmed
  )

  const percent = limit
    ? Math.min(
        100,
        Math.round(
          (confirmed / limit) * 100
        )
      )
    : 0

  async function handleConfirm() {
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/confirm-activity',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            eventRoleId: activity.id,
          }),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível confirmar.'
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
    <article className="modern-card interactive-card">
      <div className="card-topline">
        <span className="card-icon">
          🙋
        </span>

        {activity.confirmation_open ? (
          remaining > 0 ? (
            <span className="status-pill status-open">
              {remaining} vaga
              {remaining !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="status-pill status-complete">
              Equipe completa
            </span>
          )
        ) : (
          <span className="status-pill status-closed">
            Prazo encerrado
          </span>
        )}
      </div>

      <h3>{activity.name}</h3>

      {activity.description && (
        <p className="body-copy">
          {activity.description}
        </p>
      )}

      <p className="muted-text">
        {confirmed} de {limit} pessoas confirmadas
      </p>

      <div className="progress-track">
        <div
          className="progress-bar"
          style={{
            width: `${percent}%`,
          }}
        />
      </div>

      {activity.confirmation_open &&
      remaining > 0 ? (
        <button
          type="button"
          className="primary-button"
          disabled={isLoading}
          onClick={handleConfirm}
        >
          {isLoading
            ? 'Confirmando...'
            : 'Quero ajudar nessa atividade ❤️'}
        </button>
      ) : (
        <p className="card-message">
          {remaining === 0
            ? '✅ Essa atividade já encontrou seu time.'
            : '🔒 As confirmações já foram encerradas.'}
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

export default ActivityCard
