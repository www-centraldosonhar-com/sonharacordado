import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'

function App() {
  const [user, setUser] = useState(null)

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
    />
  )
}

export default App
