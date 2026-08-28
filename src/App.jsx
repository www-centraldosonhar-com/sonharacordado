import {
  useEffect,
  useState,
} from 'react'

import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import FinancePage from './pages/FinancePage'
import DreamerPage from './pages/DreamerPage'
import DreamerAdminPage from './pages/DreamerAdminPage'
import SpaceSelectorPage from './pages/SpaceSelectorPage'
import LoginWelcome from './components/LoginWelcome'

function App() {
  const [user, setUser] =
    useState(null)

  const [showLoginWelcome, setShowLoginWelcome] = useState(false)

  const [
    currentPage,
    setCurrentPage,
  ] = useState('select')

  const [
    isCheckingSession,
    setIsCheckingSession,
  ] = useState(true)

  useEffect(() => {
    let active = true

    fetch(
      '/api/auth?action=session'
    )
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

          const permissions =
            data.user.permissions || []

          const dreamerOnly =
            permissions.includes('dreamer') &&
            !permissions.includes('volunteer') &&
            !permissions.includes('admin') &&
            !permissions.includes('finance')

          setCurrentPage(
            dreamerOnly
              ? 'dreamer'
              : 'select'
          )
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
      await fetch(
        '/api/auth?action=logout',
        {
          method: 'POST',
        }
      )
    } finally {
      setUser(null)
      setCurrentPage('select')
    }
  }

  function handleLogin(
    loggedUser
  ) {
    setUser(loggedUser)

    const permissions =
      loggedUser?.permissions || []

    const dreamerOnly =
      permissions.includes('dreamer') &&
      !permissions.includes('volunteer') &&
      !permissions.includes('admin') &&
      !permissions.includes('finance')

    setCurrentPage(
      dreamerOnly
        ? 'dreamer'
        : 'select'
    )

    setShowLoginWelcome(true)

    window.setTimeout(
      () => {
        setShowLoginWelcome(false)
      },
      1550
    )
  }

  function hasPermission(
    permission
  ) {
    return (
      user?.permissions ||
      []
    ).includes(
      permission
    )
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
    showLoginWelcome &&
    user
  ) {
    return (
      <LoginWelcome
        user={user}
      />
    )
  }

  if (
    currentPage === 'select'
  ) {
    return (
      <SpaceSelectorPage
        user={user}
        onSelect={
          setCurrentPage
        }
        onLogout={
          handleLogout
        }
      />
    )
  }

  if (
    currentPage === 'dreamer'
  ) {
    return (
      <DreamerPage
        user={user}
        onBack={() =>
          setCurrentPage('select')
        }
        onOpenAdmin={() =>
          setCurrentPage(
            'dreamer-admin'
          )
        }
        onLogout={
          handleLogout
        }
      />
    )
  }

  if (
    currentPage ===
      'dreamer-admin'
  ) {
    return (
      <DreamerAdminPage
        user={user}
        onBack={() =>
          setCurrentPage(
            'dreamer'
          )
        }
        onLogout={
          handleLogout
        }
      />
    )
  }

  if (
    currentPage ===
      'volunteer' &&
    hasPermission(
      'volunteer'
    )
  ) {
    return (
      <HomePage
        user={user}
        onLogout={
          handleLogout
        }
        onOpenAdmin={() =>
          setCurrentPage(
            'admin'
          )
        }
      />
    )
  }

  if (
    currentPage === 'finance' &&
    hasPermission('finance')
  ) {
    return (
      <FinancePage
        user={user}
        onBack={() =>
          setCurrentPage('select')
        }
        onLogout={handleLogout}
      />
    )
  }

  if (
    currentPage === 'admin' &&
    hasPermission('admin')
  ) {
    return (
      <AdminPage
        user={user}
        onBack={() =>
          setCurrentPage(
            'select'
          )
        }
        onLogout={
          handleLogout
        }
      />
    )
  }

  return (
    <SpaceSelectorPage
      user={user}
      onSelect={
        setCurrentPage
      }
      onLogout={
        handleLogout
      }
    />
  )
}

export default App
