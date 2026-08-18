import '../styles/login.css'

function SpaceSelectorPage({
  user,
  onSelect,
  onLogout,
}) {
  const permissions =
    user.permissions || []

  const hasVolunteer =
    permissions.includes(
      'volunteer'
    )

  const hasAdmin =
    permissions.includes(
      'admin'
    )

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-card">
          <header className="login-brand">
            <div className="login-hearts">
              <span className="heart-red">
                ♥
              </span>
              <span className="heart-orange">
                ♥
              </span>
              <span className="heart-blue">
                ♥
              </span>
            </div>

            <p className="login-kicker">
              CENTRAL DO SONHAR
            </p>

            <h1>
              Onde você quer entrar? ✨
            </h1>

            <p className="login-intro">
              Oi, {user.name}! Escolha seu espaço.
            </p>
          </header>

          <div className="space-selector-grid">
            <button
              type="button"
              className="space-selector-card"
              onClick={() =>
                onSelect('dreamer')
              }
            >
              <span>
                ❤️
              </span>

              <strong>
                Espaço Sócio Sonhador
              </strong>

              <small>
                Apoie, participe e acompanhe
                como seus sonhos ajudam a
                transformar.
              </small>
            </button>

            {hasVolunteer && (
              <button
                type="button"
                className="space-selector-card"
                onClick={() =>
                  onSelect('volunteer')
                }
              >
                <span>
                  🫶
                </span>

                <strong>
                  Central do Voluntário
                </strong>

                <small>
                  Eventos, equipes,
                  atividades e missões.
                </small>
              </button>
            )}

            {hasAdmin && (
              <button
                type="button"
                className="space-selector-card"
                onClick={() =>
                  onSelect('admin')
                }
              >
                <span>
                  ⚙️
                </span>

                <strong>
                  Administração
                </strong>

                <small>
                  {user.adminScope ===
                  'global'
                    ? 'Administração Geral'
                    : user.adminScope ===
                      'project'
                      ? `Administração do ${user.project}`
                      : 'Administração da sua equipe'}
                </small>
              </button>
            )}
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onLogout}
          >
            🚪 Sair
          </button>
        </div>
      </section>
    </main>
  )
}

export default SpaceSelectorPage
