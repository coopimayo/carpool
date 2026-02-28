import { useState } from 'react'
import './AuthPage.css'

function AuthPage({ onAuthSubmit, authLoading, authError, onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const success = await onAuthSubmit({ email, password, mode })
    if (success) {
      onAuthenticated()
    }
  }

  return (
    <div className="auth-page shell">
      <section className="auth-card">
        <h1>{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
        <p>{mode === 'login' ? 'Access your saved routes and continue planning.' : 'Register to save and revisit previous routes.'}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />

          <button type="submit" className="primary-btn" disabled={authLoading}>
            {authLoading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Register'}
          </button>

          <button
            type="button"
            className="text-btn"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
          </button>
        </form>

        {authError && <p className="auth-error">{authError}</p>}
      </section>
    </div>
  )
}

export default AuthPage
