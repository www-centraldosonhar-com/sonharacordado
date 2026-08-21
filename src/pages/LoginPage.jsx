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

  // ========================================================
  // PRIMEIRO ACESSO — CRIAÇÃO DO PIN
  // ========================================================

  const [pinSetup, setPinSetup] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isCreatingPin, setIsCreatingPin] = useState(false)


  function handlePinChange(setter) {
    return (event) => {
      const value = event.target.value
        .replace(/\D/g, '')
        .slice(0, 4)

      setter(value)
    }
  }


  function cancelPinSetup() {
    setPinSetup(null)
    setNewPin('')
    setConfirmPin('')
    setMessage('')
    setMessageType('')
  }


  async function handlePinSetup(event) {
    event.preventDefault()

    setMessage('')
    setMessageType('')

    if (!/^\d{4}$/.test(newPin)) {
      setMessage('Seu PIN precisa ter exatamente 4 números.')
      setMessageType('error')
      return
    }

    if (newPin !== confirmPin) {
      setMessage('Os PINs não são iguais.')
      setMessageType('error')
      return
    }

    setIsCreatingPin(true)

    try {
      const response = await fetch(
        '/api/auth?action=setup-pin',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            username:
              pinSetup.username,

            pin:
              newPin,

            confirmPin,
          }),
        }
      )

      const data = await response.json()

      /*
       * Conta importada ainda sem PIN.
       * O card muda para o fluxo de primeiro acesso.
       */
      if (data.requiresPinSetup) {
        setPinSetup({
          name:
            data.user?.full_name ||
            data.user?.name ||
            formData.name,

          username:
            data.user?.username ||
            formData.name,

          project:
            data.user?.project ||
            '',
        })

        setNewPin('')
        setConfirmPin('')
        setMessage('')
        setMessageType('')
        return
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          'Não foi possível criar seu PIN.'
        )
      }

      /*
       * Mantém o PIN recém-criado no formulário.
       * Assim a pessoa só precisa tocar em "Entrar".
       */
      setFormData((current) => ({
        ...current,
        password: newPin,
      }))

      setPinSetup(null)
      setNewPin('')
      setConfirmPin('')

      setMessage(
        'Tudo pronto! Seu PIN foi criado. Agora é só entrar. 💙'
      )
      setMessageType('success')
    } catch (error) {
      setMessage(error.message)
      setMessageType('error')
    } finally {
      setIsCreatingPin(false)
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

        body: JSON.stringify({
          username:
            formData.name,

          password:
            formData.password,
        }),
      })

      const data = await response.json()

      /*
       * PRIMEIRO ACESSO
       *
       * Uma conta importada pode existir sem PIN.
       * Nesse caso, NÃO autenticamos o usuário.
       * Transformamos o card na tela de criação do PIN.
       */
      if (data.requiresPinSetup) {
        setPinSetup({
          name:
            data.user?.full_name ||
            data.user?.name ||
            formData.name,

          username:
            data.user?.username ||
            formData.name,

          project:
            data.user?.project ||
            '',
        })

        setNewPin('')
        setConfirmPin('')
        setMessage('')
        setMessageType('')

        return
      }

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
    <main className="login-page login-page-v3">
      <section className="login-v3-shell">

        {/* ================================================
            AMBIENT BACKGROUND
            ================================================ */}

        <div
          className="login-v3-ambient"
          aria-hidden="true"
        >
          <span className="login-v3-float float-red">
            ♥
          </span>

          <span className="login-v3-float float-orange">
            ♥
          </span>

          <span className="login-v3-float float-blue">
            ♥
          </span>

          <i className="login-v3-orbit orbit-one" />
          <i className="login-v3-orbit orbit-two" />
        </div>


        {/* ================================================
            TOP BRAND
            ================================================ */}

        <header className="login-v3-header">
          <div className="login-v3-brand">
            <div
              className="login-v3-hearts"
              aria-hidden="true"
            >
              <span>♥</span>
              <span>♥</span>
              <span>♥</span>
            </div>

            <div>
              <p>
                CENTRAL DO SONHAR
              </p>

              <strong>
                Sonhar Acordado
              </strong>
            </div>
          </div>

          <span className="login-v3-header-note">
            Um espaço feito para quem faz acontecer.
          </span>
        </header>


        {/* ================================================
            EDITORIAL CONTENT
            ================================================ */}

        <div className="login-v3-layout">

          <section className="login-v3-story">
            <div className="login-v3-story-content">
              <p className="login-v3-eyebrow">
                BEM-VINDO
              </p>

              <h1>
                Nossa comunidade.
                <br />

                <span>
                  Nosso Sonhar.
                </span>
              </h1>

              <p className="login-v3-description">
                Entre para acompanhar eventos,
                missões e tudo o que conecta
                você ao Sonhar Acordado.
              </p>


              <div className="login-v3-signature">
                <div
                  className="login-v3-signature-line"
                  aria-hidden="true"
                />

                <p>
                  Pequenas atitudes.
                  <br />
                  <strong>
                    Grandes sonhos.
                  </strong>
                </p>
              </div>
            </div>


            <div
              className="login-v3-heart-orbit"
              aria-hidden="true"
            >
              <span className="login-v3-orbit-center">
                ♥
              </span>

              <i className="login-v3-dot dot-red" />
              <i className="login-v3-dot dot-orange" />
              <i className="login-v3-dot dot-blue" />
            </div>
          </section>


          {/* ==============================================
              LOGIN / REGISTER
              ============================================== */}

          <section className="login-v3-access">
            <div className="login-v3-access-heading">
              <small>
                {pinSetup
                  ? 'PRIMEIRO ACESSO'
                  : 'SUA CENTRAL'}
              </small>

              <h2>
                {pinSetup
                  ? 'Crie seu acesso.'
                  : 'Entre para continuar.'}
              </h2>

              <p>
                {pinSetup
                  ? 'Escolha um PIN pessoal de 4 números.'
                  : 'Use seu @usuário e seu PIN.'}
              </p>
            </div>


            {message && (
              <p
                className={
                  `login-message ${
                    messageType
                      ? `is-${messageType}`
                      : ''
                  }`
                }
              >
                {message}
              </p>
            )}


            <div className="login-v3-pin-switch">
              {pinSetup ? (
                <form
                  className="login-v3-form login-v3-pin-setup"
                  onSubmit={handlePinSetup}
                >
                  <div className="login-v3-pin-welcome">
                    <div
                      className="login-v3-pin-symbol"
                      aria-hidden="true"
                    >
                      ✦
                    </div>

                    <span>QUE BOM TER VOCÊ AQUI</span>

                    <strong>
                      {String(
                        pinSetup.name || ''
                      )
                        .trim()
                        .split(/\s+/)[0]}
                    </strong>

                    <small>
                      {pinSetup.project}
                    </small>

                    <p>
                      Falta só um passo para entrar
                      na Central. Crie seu PIN pessoal.
                    </p>
                  </div>


                  <label className="login-v3-field login-v3-pin-field">
                    <span>
                      Novo PIN
                    </span>

                    <div className="login-v3-pin-input-wrap">
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{4}"
                        autoComplete="new-password"
                        minLength={4}
                        maxLength={4}
                        value={newPin}
                        onChange={handlePinChange(setNewPin)}
                        placeholder="••••"
                        autoFocus
                        required
                      />

                      <div
                        className="login-v3-pin-dots"
                        aria-hidden="true"
                      >
                        {[0, 1, 2, 3].map((index) => (
                          <i
                            key={index}
                            className={
                              index < newPin.length
                                ? 'is-filled'
                                : ''
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </label>


                  <label className="login-v3-field login-v3-pin-field">
                    <span>
                      Confirmar PIN
                    </span>

                    <div className="login-v3-pin-input-wrap">
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{4}"
                        autoComplete="new-password"
                        minLength={4}
                        maxLength={4}
                        value={confirmPin}
                        onChange={handlePinChange(setConfirmPin)}
                        placeholder="••••"
                        required
                      />

                      <div
                        className="login-v3-pin-dots"
                        aria-hidden="true"
                      >
                        {[0, 1, 2, 3].map((index) => (
                          <i
                            key={index}
                            className={
                              index < confirmPin.length
                                ? 'is-filled'
                                : ''
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </label>


                  <div className="login-v3-pin-hint">
                    <span aria-hidden="true">
                      🔐
                    </span>

                    <p>
                      Seu PIN terá exatamente
                      <strong> 4 números</strong>.
                      Guarde-o para seus próximos acessos.
                    </p>
                  </div>


                  <button
                    type="submit"
                    className="login-v3-submit login-v3-pin-submit"
                    disabled={
                      isCreatingPin ||
                      newPin.length !== 4 ||
                      confirmPin.length !== 4
                    }
                  >
                    <span>
                      {isCreatingPin
                        ? 'Criando seu acesso...'
                        : 'Criar meu acesso'}
                    </span>

                    {!isCreatingPin && (
                      <span aria-hidden="true">
                        →
                      </span>
                    )}
                  </button>


                  <button
                    type="button"
                    className="login-v3-pin-back"
                    onClick={cancelPinSetup}
                    disabled={isCreatingPin}
                  >
                    ← Voltar para o login
                  </button>
                </form>
              ) : (
<form
              className="login-form login-v3-form"
              onSubmit={handleSubmit}
            >
              <label className="login-v3-field">
                <span>
                  Usuário
                </span>

                <div className="login-username-field">
                  <span
                    className="login-username-prefix"
                    aria-hidden="true"
                  >
                    @
                  </span>

                  <input
                    type="text"
                    placeholder="seuusuario"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData(
                        (current) => ({
                          ...current,

                          /*
                           * O @ é apenas visual.
                           * Também removemos caso a pessoa
                           * tente digitá-lo manualmente.
                           */
                          name:
                            event.target.value
                              .replace(/^@+/, '')
                              .replace(/\s+/g, ''),
                        })
                      )
                    }
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    required
                  />
                </div>
              </label>





              <label className="login-v3-field">
                <span>
                  PIN
                </span>

                <input
                  
                  inputMode="numeric"
                  type="password"
                  placeholder="PIN de 4 números"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        password:
                          event.target.value,
                      })
                    )
                  }
                  autoComplete="current-password"
                  
                  maxLength="4"
                  
                />
              </label>


              <button
                className="login-button login-v3-button"
                type="submit"
                disabled={isLoading}
              >
                <span>
                  {isLoading
                    ? 'Entrando...'
                    : 'Entrar na Central'}
                </span>

                {!isLoading && (
                  <b aria-hidden="true">
                    →
                  </b>
                )}
              </button>
            </form>
              )}
            </div>


            <div className="login-v3-divider">
              <span />
              <small>
                PRIMEIRA VEZ?
              </small>
              <span />
            </div>


            <div className="login-v3-register-callout">
              <div>
                <span
                  className="login-v3-seed"
                  aria-hidden="true"
                >
                  🌱
                </span>

                <div>
                  <strong>
                    Ainda não faz parte?
                  </strong>

                  <p>
                    Sua história na Central
                    pode começar por aqui.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="login-v3-register-toggle"
                aria-expanded={showRegister}
                onClick={() =>
                  setShowRegister(
                    (current) =>
                      !current
                  )
                }
              >
                {showRegister
                  ? 'Fechar cadastro'
                  : 'Criar minha conta'}

                <span>
                  {showRegister
                    ? '×'
                    : '→'}
                </span>
              </button>
            </div>


            {showRegister && (
              <form
                className="login-v3-register-form"
                onSubmit={handleRegister}
              >
                <div className="login-v3-register-heading">
                  <span>
                    ✨
                  </span>

                  <div>
                    <strong>
                      Vem sonhar com a gente.
                    </strong>

                    <p>
                      É rapidinho. Escolha o projeto
                      que faz parte da sua história.
                    </p>
                  </div>
                </div>


                <label className="login-v3-field">
                  <span>
                    Seu usuário
                  </span>

                  <input
                    placeholder="Como devemos chamar você?"
                    value={registerData.name}
                    onChange={(event) =>
                      setRegisterData(
                        (current) => ({
                          ...current,
                          name:
                            event.target.value,
                        })
                      )
                    }
                    required
                  />
                </label>


                <label className="login-v3-field">
                  <span>
                    Seu projeto
                  </span>

                  <select
                    value={registerData.project}
                    onChange={(event) =>
                      setRegisterData(
                        (current) => ({
                          ...current,
                          project:
                            event.target.value,
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
                </label>


                <label className="login-v3-field">
                  <span>
                    Crie sua senha
                  </span>

                  <input
                    type="password"
                    placeholder="No mínimo 4 caracteres"
                    value={registerData.password}
                    onChange={(event) =>
                      setRegisterData(
                        (current) => ({
                          ...current,
                          password:
                            event.target.value,
                        })
                      )
                    }
                    minLength="4"
                    required
                  />
                </label>


                <button
                  className="login-button login-v3-button"
                  type="submit"
                  disabled={isLoading}
                >
                  <span>
                    {isLoading
                      ? 'Criando...'
                      : 'Criar minha conta'}
                  </span>

                  {!isLoading && (
                    <b aria-hidden="true">
                      ♥
                    </b>
                  )}
                </button>
              </form>
            )}


            <footer className="login-v3-access-footer">
              <span>♥</span>

              <p>
                Feito para aproximar quem
                acredita no mesmo sonho.
              </p>
            </footer>
          </section>

        </div>
      </section>
    </main>
  )
}


export default LoginPage
