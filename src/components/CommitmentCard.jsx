import { useState } from 'react'

function CommitmentCard({
  confirmation,
  onUpdated,
}) {
  const [isCancelling, setIsCancelling] =
    useState(false)

  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleCancel() {
    if (!reason.trim()) {
      setMessage(
        'Conte pra gente o motivo da desistência.'
      )
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/cancel-confirmation',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            confirmationId: confirmation.id,
            reason,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível cancelar.'
        )
      }

      await onUpdated()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <article className="modern-card commitment-card">
      <div className="card-topline">
        <span className="card-icon">🤝</span>

        <span className="status-pill status-complete">
          Confirmado
        </span>
      </div>

      <h3>{confirmation.role}</h3>

      <p className="body-copy">
        {confirmation.event_name}
      </p>

      {confirmation.cancellation_open ? (
        <>
          {!isCancelling ? (
            <button
              type="button"
              className="danger-outline-button"
              onClick={() => setIsCancelling(true)}
            >
              Preciso desistir
            </button>
          ) : (
            <div className="cancel-box">
              <label>
                Motivo da desistência
              </label>

              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Conte brevemente o que aconteceu..."
                rows="3"
              />

              <div className="action-buttons">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setIsCancelling(false)
                    setReason('')
                    setMessage('')
                  }}
                >
                  Voltar
                </button>

                <button
                  type="button"
                  className="danger-button"
                  disabled={isLoading}
                  onClick={handleCancel}
                >
                  {isLoading
                    ? 'Cancelando...'
                    : 'Confirmar desistência'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="card-message">
          🔒 O prazo para alterações já encerrou.
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

export default CommitmentCard
