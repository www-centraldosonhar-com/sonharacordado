import { useState } from 'react'
import '../styles/login.css'

function LoginPage({ onLogin }) {
  const [
    showRegister,
    setShowRegister,
  ] = useState(false)

  const [
    registerData,
    setRegisterData,
  ] = useState({
    name: '',
    project: '',
    password: '',
  })
  const [formData, setFormData] = useState({
    name: '',
    project: '',
    password: '',
  })

  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }))
  }


  async function handleRegister(event) {
    event.preventDefault()

    setMessage('')
    setMessageType('')
    setIsLoading(true)

    try {
      const response = await fetch(
        '/api/auth?action=register-external',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(
              registerData
            ),
        }
      )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'Não foi possível criar sua conta.'
        )
      }

      setMessage(
        data.message
      )

      setMessageType(
        'success'
      )

      setFormData({
        name:
          registerData.name,
        project:
          registerData.project,
        password: '',
      })

      setShowRegister(false)
    } catch (error) {
      setMessage(
        error.message
      )

      setMessageType(
        'error'
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setMessage('')
    setMessageType('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth?action=login', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Não foi possível entrar.'
        )
      }

      setMessage('Login realizado com sucesso. ✅')
      setMessageType('success')

      onLogin(data.user)
    } catch (error) {
      setMessage(error.message)
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-card">
          <header className="login-brand">
            <div className="login-hearts" aria-hidden="true">
              <span className="heart-red">♥</span>
              <span className="heart-orange">♥</span>
              <span className="heart-blue">♥</span>
            </div>

            <p className="login-kicker">
              CENTRAL DO SONHAR
            </p>

            <h1>
              Que bom ter você por aqui. ✨
            </h1>

            <p className="login-intro">
              Entre para ver os próximos encontros,
              suas missões e tudo que está acontecendo
              no Sonhar.
            </p>
          </header>

          {message && (
            <div
              className={`login-message login-message-${messageType}`}
              role="status"
            >
              {message}
            </div>
          )}

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >
            <div className="login-field">
              <label htmlFor="name">
                Seu usuário
              </label>

              <div className="login-input-wrap">
                <span aria-hidden="true">
                  👤
                </span>

                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="username"
                  placeholder="Ex.: Mikio"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="project">
                Seu projeto
              </label>

              <div className="login-input-wrap login-input-wrap-select">
                <span
                  className="select-heart-white"
                  aria-hidden="true"
                >
                  ♥
                </span>

                <select
                  id="project"
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>
                    Selecione seu projeto
                  </option>

                  <option value="APS">APS</option>
                  <option value="PPF">PPF</option>
                  <option value="SJ">SJ</option>
                </select>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">
                Senha
              </label>

              <div className="login-input-wrap">
                <span aria-hidden="true">
                  🔒
                </span>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  required
                />
              </div>
            </div>

            <button
              className="login-button"
              type="submit"
              disabled={isLoading}
            >
              {isLoading
                ? 'Entrando...'
                : (
                  <>
                    Entrar na Central
                    <span
                      className="button-heart-white"
                      aria-hidden="true"
                    >
                      ♥
                    </span>
                  </>
                )}
            </button>
          </form>

          <div className="login-note">
            <span aria-hidden="true">
              🌱
            </span>

            <div>
              <p>
                Ainda não faz parte da Central?
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowRegister(
                    (current) =>
                      !current
                  )
                }
              >
                <span
                  className="create-account-heart-white"
                  aria-hidden="true"
                >
                  ♥
                </span>

                Criar minha conta
              </button>
            </div>
          </div>

          {showRegister && (
            <form
              className="login-form"
              onSubmit={
                handleRegister
              }
            >
              <h2>
                Vem sonhar com a gente ✨
              </h2>

              <p>
                Escolha seu projeto com o coração.
                Não existe resposta errada. ❤️
              </p>

              <input
                placeholder="Seu usuário"
                value={
                  registerData.name
                }
                onChange={(event) =>
                  setRegisterData(
                    (current) => ({
                      ...current,
                      name:
                        event.target
                          .value,
                    })
                  )
                }
                required
              />

              <div className="register-project-select-wrap">
                {!registerData.project && (
                  <span
                    className="register-select-heart-white"
                    aria-hidden="true"
                  >
                    ♥
                  </span>
                )}

                <select
                  value={
                    registerData.project
                  }
                  onChange={(event) =>
                    setRegisterData(
                      (current) => ({
                        ...current,
                        project:
                          event.target
                            .value,
                      })
                    )
                  }
                  required
                >
                <option value="">
                  Escolha com o coração 🤍
                </option>

                <option value="APS">
                  ❤️ APS — energia das crianças
                </option>

                <option value="PPF">
                  💙 PPF — acompanhar sonhos crescendo
                </option>

                <option value="SJ">
                  🧡 SJ — inclusão, vínculo e alegria
                </option>
                </select>
              </div>

              <input
                type="password"
                placeholder="Crie uma senha"
                value={
                  registerData.password
                }
                onChange={(event) =>
                  setRegisterData(
                    (current) => ({
                      ...current,
                      password:
                        event.target
                          .value,
                    })
                  )
                }
                minLength="4"
                required
              />

              <button
                className="login-button"
                type="submit"
                disabled={
                  isLoading
                }
              >
                Criar conta ❤️
              </button>
            </form>
          )}
        </div>

        <aside
          className="login-art"
          aria-hidden="true"
        >
          <div className="login-orb login-orb-red" />
          <div className="login-orb login-orb-orange" />
          <div className="login-orb login-orb-blue" />

          <div className="login-art-content">
            <div className="login-hearts">
              <span className="heart-red">♥</span>
              <span className="heart-orange">♥</span>
              <span className="heart-blue">♥</span>
            </div>

            <strong>
              Fazer o bem fica ainda melhor
              quando a gente faz junto.
            </strong>

            <span>
              Sonhar Acordado
            </span>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default LoginPage
