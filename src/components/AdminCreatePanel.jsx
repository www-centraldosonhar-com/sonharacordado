import { useState } from 'react'

function AdminCreatePanel({
  projects,
  events,
  roles,
  teams = [],
  onCreated,
}) {
  const [message, setMessage] = useState('')

  const [
    activityTeamId,
    setActivityTeamId,
  ] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [
    userType,
    setUserType,
  ] = useState('volunteer')

  const [
    activityRequiresDelivery,
    setActivityRequiresDelivery,
  ] = useState(false)

  async function submit(action, data, form) {
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/admin?action=create',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            action,
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
      form.reset()

      if (action === 'activity') {
        setActivityRequiresDelivery(false)
        setActivityTeamId('')
      }

      if (action === 'user') {
        setUserType('volunteer')
      }

      await onCreated()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(action) {
    return async (event) => {
      event.preventDefault()

      const form = event.currentTarget
      const formData = new FormData(form)

      const data =
        Object.fromEntries(
          formData.entries()
        )

      await submit(
        action,
        data,
        form
      )
    }
  }

  return (
    <section className="admin-section admin-create-hub">
      <p className="admin-eyebrow">
        CRIAR E ORGANIZAR
      </p>

      <h2>
        ✨ Novos itens
      </h2>

      {message && (
        <div className="admin-feedback">
          {message}
        </div>
      )}

      <div className="admin-create-grid">

        <details>
          <summary>
            📢 Novo comunicado
          </summary>

          <form
            onSubmit={handleSubmit(
              'announcement'
            )}
          >
            <label>Título</label>

            <input
              name="title"
              required
            />

            <label>Mensagem</label>

            <textarea
              name="message"
              required
            />

            <label>
              Projeto de destino
            </label>

            <select
              name="projectId"
              defaultValue=""
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

            <label>
              Equipe de destino
            </label>

            <select
              name="teamId"
              defaultValue=""
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
              defaultValue="normal"
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

            <button
              disabled={isLoading}
              type="submit"
            >
              Publicar comunicado
            </button>
          </form>
        </details>

        <details>
          <summary>
            🎟️ Criar cupom de gratuidade
          </summary>

          <form
            onSubmit={handleSubmit(
              'coupon'
            )}
          >
            <label>
              Nome do cupom
            </label>

            <input
              name="code"
              placeholder="SONHADOR2026"
              required
            />

            <label>
              Quantidade de usos
            </label>

            <input
              type="number"
              name="usageLimit"
              min="1"
              required
            />

            <button
              disabled={isLoading}
              type="submit"
            >
              Criar cupom
            </button>
          </form>
        </details>

        <details>
          <summary>
            📅 Criar evento
          </summary>

          <form
            onSubmit={handleSubmit('event')}
          >
            <label>
              Nome
            </label>

            <input
              name="name"
              required
            />

            <label>
              Projeto
            </label>

            <select
              name="projectId"
              defaultValue=""
            >
              <option value="">
                Evento geral da ONG
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

            <label>
              Tipo
            </label>

            <select
              name="eventType"
              defaultValue="specific"
            >
              <option value="specific">
                Específico
              </option>

              <option value="general">
                Geral
              </option>
            </select>

            <label>
              Data
            </label>

            <input
              type="date"
              name="eventDate"
              required
            />

            <label>
              Horário
            </label>

            <input
              type="time"
              name="eventTime"
              required
            />

            <label>
              Local
            </label>

            <input
              name="location"
              required
            />

            <label>
              Prazo de confirmação
            </label>

            <input
              type="datetime-local"
              name="confirmationDeadline"
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
              placeholder="35.00"
              required
            />

            <label>
              Prazo das inscrições
            </label>

            <input
              type="datetime-local"
              name="registrationDeadline"
              required
            />

            <label>
              Link das fotos no Google Drive
            </label>

            <input
              type="url"
              name="driveLink"
              placeholder="https://drive.google.com/..."
            />

            <button
              disabled={isLoading}
              type="submit"
            >
              Criar evento
            </button>
          </form>
        </details>

        <details>
          <summary>
            🙋 Abrir atividade
          </summary>

          <form
            onSubmit={handleSubmit(
              'activity'
            )}
          >
            <label>
              Evento
            </label>

            <select
              name="eventId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                Selecione
              </option>

              {events
                .filter(
                  (event) =>
                    Number(event.active) === 1
                )
                .map((event) => (
                  <option
                    key={event.id}
                    value={event.id}
                  >
                    {event.name}
                  </option>
                ))}
            </select>

            <label>
              Equipe responsável
            </label>

            <select
              name="teamId"
              value={activityTeamId}
              onChange={(event) =>
                setActivityTeamId(
                  event.target.value
                )
              }
              required
            >
              <option
                value=""
                disabled
              >
                Selecione a equipe
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

            <label>
              Atividade / função
            </label>

            <select
              name="roleId"
              required
              defaultValue=""
              key={activityTeamId}
              disabled={!activityTeamId}
            >
              <option
                value=""
                disabled
              >
                {activityTeamId
                  ? 'Selecione'
                  : 'Escolha a equipe primeiro'}
              </option>

              {roles
                .filter(
                  (role) =>
                    Number(role.team_id) ===
                    Number(activityTeamId)
                )
                .map((role) => (
                  <option
                    key={role.id}
                    value={role.id}
                  >
                    {role.name}
                  </option>
                ))}
            </select>

<label>
              Descrição
            </label>

            <textarea
              name="description"
            />

            <label>
              Quantidade de vagas
            </label>

            <input
              type="number"
              name="vacancyLimit"
              min="1"
              required
            />

            <label>
              Entrega após o evento
            </label>

            <select
              name="requiresDelivery"
              defaultValue="0"
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
                  required
                />
              </>
            )}

            <button
              disabled={isLoading}
              type="submit"
            >
              Abrir atividade
            </button>
          </form>
        </details>

        <details>
          <summary>
            🚀 Criar missão
          </summary>

          <form
            onSubmit={handleSubmit('task')}
          >
            <label>
              Título
            </label>

            <input
              name="title"
              required
            />

            <label>
              Descrição
            </label>

            <textarea
              name="description"
            />

            <label>
              Projeto
            </label>

            <select
              name="projectId"
              defaultValue=""
            >
              <option value="">
                🌎 Geral / definir pelo evento
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

            <label>
              Equipe
            </label>

            <select
              name="teamId"
              defaultValue=""
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

            <label>
              Evento relacionado
            </label>

            <select
              name="eventId"
              defaultValue=""
            >
              <option value="">
                Missão independente
              </option>

              {events
                .filter(
                  (event) =>
                    Number(event.active) === 1
                )
                .map((event) => (
                  <option
                    key={event.id}
                    value={event.id}
                  >
                    {event.name}
                  </option>
                ))}
            </select>

            <label>
              Prazo
            </label>

            <input
              type="datetime-local"
              name="deadline"
              required
            />

            <label>
              Projeto de destino
            </label>

            <select
              name="projectId"
              defaultValue=""
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

            <label>
              Equipe de destino
            </label>

            <select
              name="teamId"
              defaultValue=""
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

            <label>
              Prioridade
            </label>

            <select
              name="priority"
              defaultValue="normal"
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
              Pessoas necessárias
            </label>

            <input
              type="number"
              name="volunteerLimit"
              defaultValue="1"
              min="1"
              required
            />

            <button
              disabled={isLoading}
              type="submit"
            >
              Criar missão
            </button>
          </form>
        </details>

        <details>
          <summary>
            👤 Cadastrar pessoa
          </summary>

          <form
            onSubmit={handleSubmit('user')}
          >
            <label>
              Usuário
            </label>

            <input
              name="name"
              required
            />

            <label>
              Projeto
            </label>

            <select
              name="projectId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                Selecione
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

            <label>
              E-mail
            </label>

            <input
              type="email"
              name="email"
            />

            <label>
              Tipo
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
              defaultValue=""
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
              />

              <span>
                📸 Também ajuda em Mídias
              </span>
            </label>

            <p className="admin-form-help">
              Cada voluntário pode ter uma equipe principal.
              Mídias é a única equipe adicional permitida e
              atua em APS, PPF e SJ.
            </p>

              </>
            )}

            <label>
              Senha
            </label>

            <input
              type="password"
              name="password"
              minLength="4"
              required
            />

            <button
              disabled={isLoading}
              type="submit"
            >
              Cadastrar pessoa
            </button>
          </form>
        </details>

      </div>
    </section>
  )
}

export default AdminCreatePanel
