import { useState } from 'react'

function AdminManageActions({
  type,
  item,
  projects = [],
  teams = [],
  onUpdated,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const initialUserType =
    type === 'user'
      ? (
          item.permissions?.includes('admin')
            ? item.admin_scope === 'global'
              ? 'admin'
              : item.admin_scope === 'project'
                ? 'project_admin'
                : 'team_admin'
            : 'volunteer'
        )
      : 'volunteer'

  const [
    userType,
    setUserType,
  ] = useState(initialUserType)

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
          <label>Nome completo</label>

          <input
            name="fullName"
            defaultValue={
              item.full_name ||
              item.name ||
              ''
            }
            required
          />

          <label>Usuário</label>

          <div className="admin-username-field">
            <span aria-hidden="true">
              @
            </span>

            <input
              name="username"
              defaultValue={
                item.username || ''
              }
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              required
            />
          </div>

          <label>E-mail</label>

          <input
            type="email"
            name="email"
            defaultValue={
              item.email || ''
            }
          />

                    <label>Data de nascimento</label>

          <input
            type="date"
            name="birthDate"
            defaultValue={
              item.birth_date
                ? String(item.birth_date).slice(0, 10)
                : ''
            }
          />

          <label>
            Alergias / restrições alimentares
          </label>

          <textarea
            name="allergies"
            rows="3"
            defaultValue={item.allergies || ''}
            placeholder="Ex.: amendoim, lactose..."
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

          <label>
            Acesso
          </label>

          <select
            name="userType"
            value={userType}
            onChange={(event) =>
              setUserType(
                event.target.value
              )
            }
          >
            <option value="volunteer">
              🫶 Voluntário
            </option>

            <option value="team_admin">
              ⚙️ Admin de equipe
            </option>

            <option value="project_admin">
              🏠 Admin de Projeto
            </option>

            <option value="admin">
              🛡️ Admin Geral
            </option>
          </select>

          {[
            'volunteer',
            'team_admin',
          ].includes(userType) && (
            <>
          <label>
            Equipe principal
          </label>

          <select
            name="primaryTeamId"
            defaultValue={
              item.team_ids?.find(
                (teamId) => {
                  const team =
                    teams.find(
                      (candidate) =>
                        Number(candidate.id) ===
                        Number(teamId)
                    )

                  return (
                    team &&
                    team.code !== 'media'
                  )
                }
              ) || ''
            }
          >
            <option value="">
              Somente Mídias / sem equipe principal
            </option>

            {teams
              .filter(
                (team) =>
                  team.code !== 'media'
              )
              .map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                >
                  {team.name}
                </option>
              ))}
          </select>

          <label className="admin-checkbox-field">
            <input
              type="checkbox"
              name="mediaSupport"
              value="1"
              defaultChecked={
                Boolean(
                  teams.find(
                    (team) =>
                      team.code === 'media' &&
                      item.team_ids?.some(
                        (teamId) =>
                          Number(teamId) ===
                          Number(team.id)
                      )
                  )
                )
              }
            />

            <span>
              📸 Também ajuda em Mídias
            </span>
          </label>

            </>
          )}
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
            Prazo de inscrição
          </label>

          <input
            type="datetime-local"
            name="registrationDeadline"
            defaultValue={
              item.registration_deadline ||
              item.confirmation_deadline
                ? String(
                    item.registration_deadline ||
                    item.confirmation_deadline
                  ).slice(0, 16)
                : ''
            }
            required
          />

          <label>
            Valor da inscrição
          </label>

          <input
            type="number"
            name="registrationFee"
            min="0"
            step="0.01"
            defaultValue={
              item.registration_fee ??
              0
            }
          />

          <label>
            Fotos no Google Drive
          </label>

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
          <label>Equipe responsável</label>

          <select
            name="teamId"
            defaultValue={
              item.team_id || ''
            }
          >
            <option value="">
              Sem equipe específica
            </option>

            {teams.map((team) => (
              <option
                key={team.id}
                value={team.id}
              >
                {team.name}
              </option>
            ))}
          </select>

          {(() => {
            const selectedTeam = teams.find(
              (team) =>
                Number(team.id) ===
                Number(item.team_id)
            )

            const teamCode = String(
              selectedTeam?.code ||
              selectedTeam?.name ||
              ''
            )
              .trim()
              .toLowerCase()

            const isMediaTeam =
              teamCode.includes('media') ||
              teamCode.includes('midia') ||
              teamCode.includes('mídia')

            if (!isMediaTeam) {
              return null
            }

            return (
              <label className="admin-community-option">
                <input
                  type="checkbox"
                  name="communityVisible"
                  value="1"
                  defaultChecked={
                    item.community_visible === true ||
                    item.community_visible === 1
                  }
                />

                <span>
                  <strong>
                    Disponibilizar na Comunidade
                  </strong>

                  <small>
                    Voluntários de qualquer projeto,
                    inscritos neste evento, poderão
                    escolher esta atividade.
                  </small>
                </span>
              </label>
            )
          })()}

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

          <label>Projeto de destino</label>

          <select
            name="projectId"
            defaultValue={
              item.project_id || ''
            }
          >
            <option value="">
              🌎 Toda a ONG / transversal
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

          <label>Equipe de destino</label>

          <select
            name="teamId"
            defaultValue={
              item.team_id || ''
            }
          >
            <option value="">
              Todas as equipes
            </option>

            {teams.map((team) => (
              <option
                key={team.id}
                value={team.id}
              >
                {team.name}
              </option>
            ))}
          </select>

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
            {Number(item.active) === 1
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
