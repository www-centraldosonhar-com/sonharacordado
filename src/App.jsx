import { useEffect, useState } from 'react'

import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'

function App() {
  const [user, setUser] = useState(null)

  const [currentPage, setCurrentPage] =
    useState('home')

  const [
    isCheckingSession,
    setIsCheckingSession,
  ] = useState(true)

  useEffect(() => {
    let active = true

    fetch('/api/session')
      .then(async (response) => {
        if (!response.ok) {
          return null
        }

        return response.json()
      })
      .then((data) => {
        if (
          active &&
          data?.authenticated &&
          data.user
        ) {
          setUser(data.user)
        }
      })
      .catch((error) => {
        console.error(
          'Session check error:',
          error
        )
      })
      .finally(() => {
        if (active) {
          setIsCheckingSession(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/logout', {
        method: 'POST',
      })
    } finally {
      setUser(null)
      setCurrentPage('home')
    }
  }

  function handleLogin(loggedUser) {
    setUser(loggedUser)
    setCurrentPage('home')
  }

  function handleOpenAdmin() {
    if (user?.userType === 'admin') {
      setCurrentPage('admin')
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
        onLogin={handleLogin}
      />
    )
  }

  if (
    currentPage === 'admin' &&
    user.userType === 'admin'
  ) {
    return (
      <AdminPage
        user={user}
        onBack={() =>
          setCurrentPage('home')
        }
        onLogout={handleLogout}
      />
    )
  }

  return (
    <HomePage
      user={user}
      onLogout={handleLogout}
      onOpenAdmin={handleOpenAdmin}
    />
  )
}

export default App
