import {
  useEffect,
  useState,
} from 'react'

import '../styles/dreamer.css'

function DreamerPage({
  user,
  onBack,
  onLogout,
  onOpenAdmin,
}) {
  const [homeData, setHomeData] =
    useState(null)
  const [loading, setLoading] =
    useState(true)
  const [error, setError] =
    useState('')

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=home')
      .then(async response => {
        const payload =
          await response.json()

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível abrir o Sócio Sonhador.'
          )
        }

        return payload
      })
      .then(payload => {
        if (active) {
          setHomeData(payload)
        }
      })
      .catch(fetchError => {
        if (active) {
          setError(fetchError.message)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const firstName = String(
    homeData?.currentUser?.name ||
      user.name ||
      ''
  )
    .trim()
    .split(/\s+/)[0]

  const isDreamerAdmin = Boolean(
    homeData?.currentUser
      ?.isDreamerAdmin
  )

  return (
    <main className="dreamer-page">
      <div className="dreamer-page__shell">
        <header className="dreamer-page__hero">
          <div>
            <span className="dreamer-eyebrow">
              ❤️ ESPAÇO SÓCIO SONHADOR
            </span>
            <h1>Oi, {firstName}! ✨</h1>
            <p>
              Entrar por identificação. Ficar pelo pertencimento. Ajudar quando o coração pedir.
            </p>
          </div>

          <div className="dreamer-page__actions">
            {isDreamerAdmin ? (
              <button
                type="button"
                className="dreamer-admin-entry"
                onClick={onOpenAdmin}
              >
                ⚙️ Admin Sócio
              </button>
            ) : null}

            <button
              type="button"
              onClick={onBack}
            >
              ← Espaços
            </button>
            <button
              type="button"
              onClick={onLogout}
            >
              Sair
            </button>
          </div>
        </header>

        {loading ? (
          <section className="dreamer-admin-card">
            <p className="dreamer-admin-loading">
              Abrindo o Sócio Sonhador… ✨
            </p>
          </section>
        ) : error ? (
          <section className="dreamer-admin-card">
            <div className="dreamer-admin-message dreamer-admin-message--error">
              {error}
            </div>
          </section>
        ) : (
          <section className="dreamer-member-preview">
            <span className="dreamer-eyebrow">
              EM CONSTRUÇÃO
            </span>
            <h2>
              Seu espaço de impacto está nascendo.
            </h2>
            <p>
              Em breve: campanhas, conquistas, missões, Olimpíada Sonhadora e formas divertidas de apoiar o Sonhar.
            </p>

            <div className="dreamer-member-preview__grid">
              <article>
                <span>🏆</span>
                <strong>Olimpíada</strong>
                <small>Torça, participe e acompanhe seu time.</small>
              </article>
              <article>
                <span>✨</span>
                <strong>Conquistas</strong>
                <small>Seu apoio também vira história dentro da Central.</small>
              </article>
              <article>
                <span>❤️</span>
                <strong>Impacto</strong>
                <small>Apoie quando fizer sentido para você.</small>
              </article>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default DreamerPage
