import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'

function App() {
  const [user, setUser] = useState(null)

  const [isCheckingSession, setIsCheckingSession] =
    useState(true)

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(
          '/api/session'
        )

        if (!response.ok) {
          return
        }

        const data = await response.json()

        if (
          data.authenticated &&
          data.user
        ) {
          setUser(data.user)
        }
      } catch (error) {
        console.error(
          'Session check error:',
          error
        )
      } finally {
        setIsCheckingSession(false)
      }
    }

    checkSession()
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/logout', {
        method: 'POST',
      })
    } finally {
      setUser(null)
    }
  }

  if (isCheckingSession) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <p>
          Abrindo a Central... ✨
        </p>
      </main>
    )
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={setUser}
      />
    )
  }

  return (
    <HomePage
      user={user}
      onLogout={handleLogout}
    />
  )
}

export default App
