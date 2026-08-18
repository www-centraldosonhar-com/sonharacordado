function HomePage({ user }) {
  return (
    <main
      style={{
        padding: '32px',
      }}
    >
      <p>Central do Sonhar ❤️🧡💙</p>

      <h1>
        Oi, {user.name}! 👋
      </h1>

      <p>
        Projeto: {user.project}
      </p>

      <p>
        Login da Central 2.0 funcionando. 🚀
      </p>
    </main>
  )
}

export default HomePage
