import { useState } from 'react'

function AdminEventComposer({
  projects = [],
  onCreated,
}) {
  const [isOpen, setIsOpen] =
    useState(false)

  const [isSaving, setIsSaving] =
    useState(false)

  const [feedback, setFeedback] =
    useState(null)

  const [eventType, setEventType] =
    useState('specific')

  async function handleSubmit(event) {
    event.preventDefault()

    const formElement =
      event.currentTarget

    const form =
      new FormData(
        formElement
      )

    const payload = {
      name:
        String(
          form.get('name') || ''
        ).trim(),

      projectId:
        eventType === 'general'
          ? null
          : form.get('projectId')
            ? Number(
                form.get('projectId')
              )
            : null,

      eventType,

      eventDate:
        form.get('eventDate'),

      eventTime:
        form.get('eventTime'),

      location:
        String(
          form.get('location') || ''
        ).trim(),

      registrationDeadline:
        form.get(
          'registrationDeadline'
        ) || null,

      registrationFee:
        form.get(
          'registrationFee'
        ) || 0,

    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const response =
        await fetch(
          '/api/admin?action=create',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                action: 'event',
                data: payload,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível criar o evento.'
        )
      }

      setFeedback({
        type: 'success',
        message:
          result.message ||
          'Evento criado com sucesso! 📅',
      })

      formElement.reset()
      setEventType('specific')

      await onCreated?.()

      setTimeout(() => {
        setIsOpen(false)
      }, 500)
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error?.message ||
          'Não foi possível criar o evento.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="admin-event-composer">
      <button
        type="button"
        className="admin-event-new-button"
        onClick={() => {
          setIsOpen(
            (current) =>
              !current
          )

          setFeedback(null)
        }}
      >
        <span>
          +
        </span>

        Novo evento
      </button>

      {isOpen && (
        <form
          className="admin-event-composer-form"
          onSubmit={handleSubmit}
        >
          <div className="admin-event-composer-head">
            <div>
              <small>
                NOVO EVENTO
              </small>

              <strong>
                Criar encontro
              </strong>
            </div>

            <button
              type="button"
              className="admin-event-close-button"
              onClick={() =>
                setIsOpen(false)
              }
            >
              ×
            </button>
          </div>

          <div className="admin-event-form-grid">
            <label className="is-wide">
              <span>
                Nome do evento
              </span>

              <input
                name="name"
                required
                placeholder="Ex.: Dia da Bondade"
              />
            </label>

            <label>
              <span>
                Tipo
              </span>

              <select
                name="eventType"
                value={eventType}
                onChange={(event) => {
                  setEventType(
                    event.target.value
                  )
                }}
              >
                <option value="specific">
                  Evento de projeto
                </option>

                <option value="general">
                  Evento geral
                </option>
              </select>
            </label>

            <label>
              <span>
                Projeto
              </span>

              <select
                name="projectId"
                defaultValue=""
                required={
                  eventType === 'specific'
                }
                disabled={
                  eventType === 'general'
                }
              >
                <option value="">
                  {eventType === 'general'
                    ? 'Evento geral / sem projeto'
                    : 'Selecione o projeto'}
                </option>

                {projects.map(
                  (project) => (
                    <option
                      key={
                        project.id
                      }
                      value={
                        project.id
                      }
                    >
                      {
                        project.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>
                Data
              </span>

              <input
                type="date"
                name="eventDate"
                required
              />
            </label>

            <label>
              <span>
                Horário
              </span>

              <input
                type="time"
                name="eventTime"
                required
              />
            </label>

            <label className="is-wide">
              <span>
                Local
              </span>

              <input
                name="location"
                required
                placeholder="Endereço ou local do encontro"
              />
            </label>

            <label>
              <span>
                Prazo de inscrição
              </span>

              <input
                type="datetime-local"
                name="registrationDeadline"
              />
            </label>

            <label>
              <span>
                Valor da inscrição
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                name="registrationFee"
                defaultValue="0"
              />
            </label>

          </div>

          {feedback && (
            <div
              className={`admin-event-feedback is-${feedback.type}`}
            >
              {feedback.message}
            </div>
          )}

          <div className="admin-event-composer-actions">
            <button
              type="button"
              className="admin-event-cancel-button"
              onClick={() =>
                setIsOpen(false)
              }
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="admin-event-save-button"
              disabled={isSaving}
            >
              {isSaving
                ? 'Criando...'
                : 'Criar evento'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default AdminEventComposer
