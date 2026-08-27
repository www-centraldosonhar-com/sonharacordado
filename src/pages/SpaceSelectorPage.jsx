import '../styles/login.css'

import PostEventFeedbackModal from '../components/PostEventFeedbackModal'


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

  const hasFinance =
    permissions.includes(
      'finance'
    )


  const adminDescription =
    user.adminScope === 'global'
      ? 'Administração Geral'
      : user.adminScope === 'project'
        ? `Administração do ${user.project}`
        : 'Administração da sua equipe'


  return (
    <main className="portal-page">
      <PostEventFeedbackModal
        user={user}
      />

      <section className="portal-shell">

        {/* ================================================
            BRAND
            ================================================ */}

        <header className="portal-header">
          <div className="portal-brand">
            <div
              className="portal-hearts"
              aria-hidden="true"
            >
              <span>♥</span>
              <span>♥</span>
              <span>♥</span>
            </div>

            <div>
              <p className="portal-kicker">
                CENTRAL DO SONHAR
              </p>

              <strong className="portal-brand-name">
                Sonhar Acordado
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="portal-logout"
            onClick={onLogout}
          >
            Sair
          </button>
        </header>


        {/* ================================================
            WELCOME
            ================================================ */}

        <section className="portal-welcome">
          <div>
            <p className="portal-welcome-label">
              SEU ESPAÇO
            </p>

            <h1>
              Oi, {String(user.name || '').trim().split(/\s+/)[0]}.
              <br />
              <span>
                Vamos continuar sonhando?
              </span>
            </h1>

            <p>
              Tudo o que conecta você ao
              Sonhar Acordado em um só lugar.
            </p>
          </div>

          <div
            className="portal-orbit"
            aria-hidden="true"
          >
            <span className="portal-orbit-heart">
              ♥
            </span>

            <i className="portal-orbit-dot dot-one" />
            <i className="portal-orbit-dot dot-two" />
            <i className="portal-orbit-dot dot-three" />
          </div>
        </section>


        {/* ================================================
            PRIMARY EXPERIENCE
            ================================================ */}

        <div className="portal-content">

          {hasVolunteer && (
            <button
              type="button"
              className="portal-primary-card"
              onClick={() =>
                onSelect('volunteer')
              }
            >
              <div className="portal-primary-icon">
                🫶
              </div>

              <div className="portal-primary-copy">
                <small>
                  SEU DIA A DIA NO SONHAR
                </small>

                <strong>
                  Central do Voluntário
                </strong>

                <p>
                  Eventos, atividades,
                  atividades e tudo o que está
                  acontecendo por aqui.
                </p>
              </div>

              <span className="portal-arrow">
                →
              </span>
            </button>
          )}


          {/* ==============================================
              DREAMER
              ============================================== */}

          <button
            type="button"
            className="portal-dreamer-card"
            onClick={() =>
              onSelect('dreamer')
            }
          >
            <div className="portal-dreamer-decoration">
              <span>♥</span>
              <span>♥</span>
              <span>♥</span>
            </div>

            <div className="portal-dreamer-content">
              <div className="portal-dreamer-icon">
                ✨
              </div>

              <small>
                UMA FORMA ESPECIAL DE FAZER PARTE
              </small>

              <strong>
                Sócio Sonhador
              </strong>

              <p>
                Ajude sonhos a acontecerem
                e desbloqueie uma experiência
                especial dentro da Central.
              </p>

              <span className="portal-dreamer-link">
                Conhecer o espaço
                <b>→</b>
              </span>
            </div>
          </button>


          {/* ==============================================
              PROFESSIONAL ACCESS
              ============================================== */}

          {(hasFinance || hasAdmin) && (
            <section className="portal-management">
              <div className="portal-section-heading">
                <div>
                  <small>
                    GESTÃO
                  </small>

                  <strong>
                    Seus acessos
                  </strong>
                </div>

                <span>
                  🔐
                </span>
              </div>

              <div className="portal-management-grid">

                {hasFinance && (
                  <button
                    type="button"
                    className="portal-management-card"
                    onClick={() =>
                      onSelect('finance')
                    }
                  >
                    <span className="portal-management-icon">
                      💰
                    </span>

                    <span className="portal-management-copy">
                      <strong>
                        Financeiro
                      </strong>

                      <small>
                        Balanços, receitas,
                        gastos e fechamentos
                      </small>
                    </span>

                    <b>→</b>
                  </button>
                )}


                {hasAdmin && (
                  <button
                    type="button"
                    className="portal-management-card"
                    onClick={() =>
                      onSelect('admin')
                    }
                  >
                    <span className="portal-management-icon">
                      ⚙️
                    </span>

                    <span className="portal-management-copy">
                      <strong>
                        Administração
                      </strong>

                      <small>
                        {adminDescription}
                      </small>
                    </span>

                    <b>→</b>
                  </button>
                )}

              </div>
            </section>
          )}

        </div>


        {/* ================================================
            FOOTER
            ================================================ */}

        <footer className="portal-footer">
          <span>
            ♥
          </span>

          <p>
            Pequenas atitudes.
            Grandes sonhos.
          </p>
        </footer>

      </section>
    </main>
  )
}


export default SpaceSelectorPage
