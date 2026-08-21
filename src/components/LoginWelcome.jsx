import '../styles/login.css'


function LoginWelcome({
  user,
}) {
  return (
    <main
      className="login-welcome"
      aria-label={`Bem-vindo, ${user?.name || ''}`}
    >
      <div className="login-welcome-content">

        <div
          className="login-welcome-hearts"
          aria-hidden="true"
        >
          <span>♥</span>
          <span>♥</span>
          <span>♥</span>
        </div>

        <p className="login-welcome-kicker">
          CENTRAL DO SONHAR
        </p>

        <h1>
          Oi,{' '}
          <strong>
            {String(
              user?.name || 'Sonhador'
            )
              .trim()
              .split(/\s+/)[0]}
          </strong>.
        </h1>

        <p className="login-welcome-message">
          Vamos sonhar juntos?
        </p>

        <div
          className="login-welcome-line"
          aria-hidden="true"
        />
      </div>
    </main>
  )
}


export default LoginWelcome
