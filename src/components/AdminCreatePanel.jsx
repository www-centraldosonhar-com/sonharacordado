import { useState } from 'react'

function AdminCreatePanel({
  projects,
  teams = [],
  access,
  onCreated,
}) {
  // =====================================================
  // ADMIN SCOPE
  // =====================================================
  //
  // Global / Project:
  // - podem escolher entre todas as equipes disponíveis.
  //
  // Team Admin:
  // - só trabalha com as equipes às quais pertence.
  //
  // A segurança definitiva continua no backend.
  // Este filtro serve para deixar a interface coerente
  // e impedir opções que o usuário não pode utilizar.
  // =====================================================

  const adminScope =
    access?.scope || null

  const adminTeamCodes =
    (access?.teams || [])
      .map(
        (team) =>
          team.code
      )

  const isGlobalAdmin =
    adminScope === 'global'

  const isProjectAdmin =
    adminScope === 'project'

  const isVolunteerAdmin =
    adminScope === 'team' &&
    adminTeamCodes.includes(
      'volunteers'
    )

  // Cadastro de pessoas segue a hierarquia:
  //
  // Global:
  // - qualquer nível.
  //
  // Projeto:
  // - voluntário;
  // - Admin de Equipe.
  //
  // Voluntários:
  // - somente voluntário.
  //
  // Outros Admins de Equipe:
  // - sem cadastro de pessoas.
  const canCreateUsers =
    isGlobalAdmin ||
    isProjectAdmin ||
    isVolunteerAdmin

  const adminTeamIds =
    new Set(
      (access?.teams || [])
        .map(
          (team) =>
            Number(team.id)
        )
    )

  const scopedTeams =
    adminScope === 'team'
      ? teams.filter(
          (team) =>
            adminTeamIds.has(
              Number(team.id)
            )
        )
      : teams

  // =====================================================
  // USER CREATION TEAMS
  // =====================================================
  //
  // O Admin da Equipe de Voluntários administra o
  // cadastro dos voluntários do projeto inteiro.
  //
  // Por isso, no cadastro de pessoas ele pode definir
  // qualquer equipe principal.
  //
  // Isso NÃO altera o escopo dele para atividades,
  // atividades ou outros conteúdos administrativos.
  // =====================================================

  const userCreationTeams =
    isVolunteerAdmin
      ? teams
      : scopedTeams

  const [message, setMessage] = useState('')

  const [isLoading, setIsLoading] = useState(false)

  const [
    userType,
    setUserType,
  ] = useState('volunteer')


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

      if (action === 'user') {
        setUserType('volunteer')
      }

      await onCreated()
    } catch (error) {
      const errorMessage =
        error.message ||
        'Não foi possível concluir.'

      setMessage(
        errorMessage
      )

      // Popup imediato para erros administrativos.
      // A mensagem continua aparecendo também no painel.
      window.alert(
        `❌ ${errorMessage}`
      )
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

              {scopedTeams.map((team) => (
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

        {canCreateUsers && (
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

              {(isGlobalAdmin ||
                isProjectAdmin) && (
                <option value="team_admin">
                  ⚙️ Admin de equipe
                </option>
              )}

              {isGlobalAdmin && (
                <option value="project_admin">
                  🏠 Admin de Projeto
                </option>
              )}

              {isGlobalAdmin && (
                <option value="admin">
                  🛡️ Admin Geral
                </option>
              )}
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
                Sem equipe principal / somente Mídias
              </option>

              {userCreationTeams
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

                      <label>Data de nascimento</label>

          <input
            type="date"
            name="birthDate"
          />

          <label>
            Alergias / restrições alimentares
          </label>

          <textarea
            name="allergies"
            rows="3"
            placeholder="Ex.: amendoim, lactose..."
          />

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
        )}

      </div>
    </section>
  )
}

export default AdminCreatePanel
