function DreamerPage({
  user,
  onBack,
  onLogout,
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 20px',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      <p>
        ❤️ ESPAÇO SÓCIO SONHADOR
      </p>

      <h1>
        Oi, {user.name}! ✨
      </h1>

      <p>
        Este será o espaço de apoio,
        caixinhas, experiências e
        impacto da Central do Sonhar.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginTop: '24px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
        >
          ← Escolher outro espaço
        </button>

        <button
          type="button"
          onClick={onLogout}
        >
          Sair
        </button>
      </div>
    </main>
  )
}

export default DreamerPage
