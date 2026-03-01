import { useEffect, useState } from 'react'
import LandingPage from '../pages/landing/LandingPage'
import AuthPage from '../pages/auth/AuthPage'
import RouteBuilderPage from '../pages/route-builder/RouteBuilderPage'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import '../components/layout/layout.css'
import { apiRequest } from '../services/api'

const STORAGE_KEY = 'routr-auth'

function App() {
  const [session, setSession] = useState(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { token: '', account: null }
    }

    try {
      return JSON.parse(raw)
    } catch (_error) {
      return { token: '', account: null }
    }
  })

  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [currentView, setCurrentView] = useState('landing')
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  async function loadHistory(token) {
    if (!token) {
      setHistory([])
      return
    }

    setHistoryLoading(true)
    try {
      const payload = await apiRequest('/carpool/history', { token })
      setHistory(payload.history || [])
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHistory(session.token)
  }, [session.token])

  async function handleAuthSubmit({ email, password, mode }) {
    setAuthLoading(true)
    setAuthError('')

    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login'
      const payload = await apiRequest(endpoint, {
        method: 'POST',
        body: { email, password },
      })

      setSession({
        token: payload.token,
        account: payload.account,
      })
      return true
    } catch (error) {
      setAuthError(error.message)
      return false
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    setSession({ token: '', account: null })
    setHistory([])
    setCurrentView('landing')
  }

  async function handleCreateRoute({ drivers, passengers, destination }) {
    if (!session.token) {
      setAuthError('Please log in to calculate and save routes')
      return
    }

    setActionLoading(true)
    setAuthError('')

    try {
      await apiRequest('/carpool/optimize', {
        method: 'POST',
        token: session.token,
        body: { drivers, passengers, destination },
      })
      await loadHistory(session.token)
      setCurrentView('landing')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <Header
        account={session.account}
        onLogout={handleLogout}
        onOpenAuth={() => setCurrentView('auth')}
        onGoHome={() => setCurrentView('landing')}
        isAuthView={currentView === 'auth'}
      />
      <main className="app-main">
        {currentView === 'auth' ? (
          <AuthPage
            onAuthSubmit={handleAuthSubmit}
            authLoading={authLoading}
            authError={authError}
            onAuthenticated={() => setCurrentView('landing')}
          />
        ) : currentView === 'route-builder' ? (
          <RouteBuilderPage
            actionLoading={actionLoading}
            authError={authError}
            onSubmitRoute={handleCreateRoute}
            onCancel={() => setCurrentView('landing')}
          />
        ) : (
          <LandingPage
            account={session.account}
            history={history}
            historyLoading={historyLoading}
            onStartRouteBuilder={() => setCurrentView('route-builder')}
          />
        )}
      </main>
      <Footer />
    </div>
  )
}

export default App
