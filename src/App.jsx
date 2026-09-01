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
import DreamerOlympiadPage from './pages/DreamerOlympiadPage'
import SpaceSelectorPage from './pages/SpaceSelectorPage'
import LoginWelcome from './components/LoginWelcome'

const LAST_PAGE_KEY = 'central-sonhar:last-page'

const RESTORABLE_PAGES = new Set([
  'select',
  'home',
  'admin',
  'finance',
  'dreamer',
  'dreamer-admin',
  'dreamer-olympiad',
])

function getSavedPage() {
  if (typeof window === 'undefined') {
    return 'select'
  }

  const savedPage =
    window.localStorage.getItem(
      LAST_PAGE_KEY
    )

  return RESTORABLE_PAGES.has(
    savedPage
  )
    ? savedPage
    : 'select'
}

function App() {
  const referralCode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('ref') || ''
      : ''
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
            referralCode
              ? 'dreamer-olympiad'
              : dreamerOnly
                ? 'dreamer'
                : getSavedPage()
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
  }, [referralCode])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      isCheckingSession ||
      !user
    ) {
      return
    }

    window.localStorage.setItem(
      LAST_PAGE_KEY,
      currentPage
    )
  }, [
    currentPage,
    isCheckingSession,
    user,
  ])

  async function handleLogout() {
    try {
      await fetch(
        '/api/auth?action=logout',
        {
          method: 'POST',
        }
      )
    } finally {
      if (
        typeof window !== 'undefined'
      ) {
        window.localStorage.removeItem(
          LAST_PAGE_KEY
        )
      }

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
      referralCode
        ? 'dreamer-olympiad'
        : dreamerOnly
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
        onOpenOlympiad={() =>
          setCurrentPage(
            'dreamer-olympiad'
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
      'dreamer-olympiad'
  ) {
    return (
      <DreamerOlympiadPage
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
        onBack={() =>
          setCurrentPage(
            'select'
          )
        }
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
