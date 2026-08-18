import { useState } from 'react'

function AdminManageActions({
  type,
  item,
  projects = [],
  events = [],
  onUpdated,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [
    activityRequiresDelivery,
    setActivityRequiresDelivery,
  ] = useState(
    Number(item.requires_delivery) === 1
  )

  async function sendAction(
    action,
    data = {}
  ) {
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
            id: item.id,
            data,
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

      return true
    } catch (error) {
      setMessage(error.message)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  async function handleToggle() {
    const actionMap = {
      user: 'toggle-user',
      event: 'toggle-event',
      activity: 'toggle-activity',
      task: 'toggle-task',
      announcement: 'toggle-announcement',
    }

    const confirmed = window.confirm(
      'Tem certeza que deseja alterar o status deste item?'
    )

    if (!confirmed) {
      return
    }

    await sendAction(
      actionMap[type]
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const formData =
      new FormData(event.currentTarget)

    const data =
      Object.fromEntries(
        formData.entries()
      )

    const actionMap = {
      user: 'update-user',
      event: 'update-event',
      activity: 'update-activity',
      task: 'update-task',
      announcement: 'update-announcement',
    }

    const success =
      await sendAction(
        actionMap[type],
        data
      )

    if (success) {
      setIsEditing(false)
    }
  }

  async function handlePassword() {
    const password = window.prompt(
      'Digite a nova senha:'
    )

    if (!password) {
      return
    }

    await sendAction(
      'reset-password',
      { password }
    )
  }

  function renderEditFields() {
    if (type === 'user') {
      return (
        <>
          <label>Usuário</label>

          <input
            name="name"
            defaultValue={item.name}
            required
          />

          <label>E-mail</label>

          <input
            type="email"
            name="email"
            defaultValue={
              item.email || ''
            }
          />

          <label>Projeto</label>

          <select
            name="projectId"
            defaultValue={
              item.project_id
            }
            required
          >
            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>

          <label>Tipo</label>

          <select
            name="userType"
            defaultValue={
              item.user_type
            }
          >
            <option value="volunteer">
              Voluntário
            </option>

            <option value="admin">
              Administrador
            </option>
          </select>
        </>
      )
    }

    if (type === 'event') {
      return (
        <>
          <label>Nome</label>

          <input
            name="name"
            defaultValue={item.name}
            required
          />

          <label>Projeto</label>

          <select
            name="projectId"
            defaultValue={
              item.project_id || ''
            }
          >
            <option value="">
              Evento geral
            </option>

            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>

          <label>Tipo</label>

          <select
            name="eventType"
            defaultValue={
              item.event_type
            }
          >
            <option value="specific">
              Específico
            </option>

            <option value="general">
              Geral
            </option>
          </select>

          <label>Data</label>

          <input
            type="date"
            name="eventDate"
            defaultValue={
              String(
                item.event_date
              ).slice(0, 10)
            }
            required
          />

          <label>Horário</label>

          <input
            type="time"
            name="eventTime"
            defaultValue={
              String(
                item.event_time
              ).slice(0, 5)
            }
            required
          />

          <label>Local</label>

          <input
            name="location"
            defaultValue={
              item.location
            }
            required
          />

          <label>
            Prazo de confirmação
          </label>

          <input
            type="datetime-local"
            name="confirmationDeadline"
            defaultValue={
              item.confirmation_deadline
                ? String(
                    item.confirmation_deadline
                  ).slice(0, 16)
                : ''
            }
            required
          />

          <label>Sympla</label>

          <input
            type="url"
            name="symplaLink"
            defaultValue={
              item.sympla_link || ''
            }
          />

          <label>Fotos no Google Drive</label>

          <input
            type="url"
            name="driveLink"
            defaultValue={
              item.drive_link || ''
            }
            placeholder="https://drive.google.com/..."
          />
        </>
      )
    }

    if (type === 'activity') {
      return (
        <>
          <label>Descrição</label>

          <textarea
            name="description"
            defaultValue={
              item.description || ''
            }
          />

          <label>Vagas</label>

          <input
            type="number"
            name="vacancyLimit"
            min="1"
            defaultValue={
              item.vacancy_limit
            }
            required
          />

          <label>
            Entrega após o evento
          </label>

          <select
            name="requiresDelivery"
            value={
              activityRequiresDelivery
                ? '1'
                : '0'
            }
            onChange={(event) =>
              setActivityRequiresDelivery(
                event.target.value === '1'
              )
            }
          >
            <option value="0">
              Não exige entrega
            </option>

            <option value="1">
              Exige entrega
            </option>
          </select>

          {activityRequiresDelivery && (
            <>
              <label>
                Prazo da entrega
              </label>

              <input
                type="datetime-local"
                name="deliveryDeadline"
                defaultValue={
                  item.delivery_deadline
                    ? String(
                        item.delivery_deadline
                      ).slice(0, 16)
                    : ''
                }
                required
              />
            </>
          )}
        </>
      )
    }

    if (type === 'task') {
      return (
        <>
          <label>Título</label>

          <input
            name="title"
            defaultValue={
              item.title
            }
            required
          />

          <label>Descrição</label>

          <textarea
            name="description"
            defaultValue={
              item.description || ''
            }
          />

          <label>Evento</label>

          <select
            name="eventId"
            defaultValue={
              item.event_id || ''
            }
          >
            <option value="">
              Independente
            </option>

            {events.map((event) => (
              <option
                key={event.id}
                value={event.id}
              >
                {event.name}
              </option>
            ))}
          </select>

          <label>Prazo</label>

          <input
            type="datetime-local"
            name="deadline"
            defaultValue={
              item.deadline
                ? String(
                    item.deadline
                  ).slice(0, 16)
                : ''
            }
            required
          />

          <label>Prioridade</label>

          <select
            name="priority"
            defaultValue={
              item.priority
            }
          >
            <option value="normal">
              Normal
            </option>

            <option value="important">
              Importante
            </option>

            <option value="urgent">
              Urgente
            </option>
          </select>

          <label>
            Limite de pessoas
          </label>

          <input
            type="number"
            name="volunteerLimit"
            min="1"
            defaultValue={
              item.volunteer_limit
            }
            required
          />
        </>
      )
    }

    if (type === 'announcement') {
      return (
        <>
          <label>Título</label>

          <input
            name="title"
            defaultValue={
              item.title
            }
            required
          />

          <label>Mensagem</label>

          <textarea
            name="message"
            defaultValue={
              item.message
            }
            required
          />

          <label>Prioridade</label>

          <select
            name="priority"
            defaultValue={
              item.priority
            }
          >
            <option value="normal">
              Normal
            </option>

            <option value="important">
              Importante
            </option>

            <option value="urgent">
              Urgente
            </option>
          </select>
        </>
      )
    }

    return null
  }

  return (
    <div className="admin-manage-actions">
      {!isEditing ? (
        <>
          <button
            type="button"
            className="admin-edit-button"
            onClick={() =>
              setIsEditing(true)
            }
          >
            ✏️ Editar
          </button>

          <button
            type="button"
            className="admin-toggle-button"
            disabled={isLoading}
            onClick={handleToggle}
          >
            {type === 'task'
              ? item.status ===
                'completed'
                ? '🚀 Reabrir'
                : '✅ Concluir'
              : Number(item.active) === 1
                ? '⚪ Desativar'
                : '🟢 Ativar'}
          </button>

          {type === 'user' && (
            <button
              type="button"
              className="admin-password-button"
              disabled={isLoading}
              onClick={handlePassword}
            >
              🔑 Senha
            </button>
          )}
        </>
      ) : (
        <form
          className="admin-edit-form"
          onSubmit={handleSubmit}
        >
          {renderEditFields()}

          <div className="admin-edit-actions">
            <button
              type="button"
              onClick={() =>
                setIsEditing(false)
              }
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading}
            >
              {isLoading
                ? 'Salvando...'
                : 'Salvar alterações'}
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}
    </div>
  )
}

export default AdminManageActions
