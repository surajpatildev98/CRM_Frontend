import { FormEvent, useState } from 'react'
import { login } from '../../api'
import type { LoginPageProps } from './login.types'
import './login.css'

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!loginId.trim() || !password) {
      setError('Please enter your Login ID and password.')
      return
    }

    setBusy(true)
    try {
      const result = await login(loginId.trim(), password)
      onSuccess(result.token, result.user)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-hero" aria-hidden="true" />
        <div className="login-mark">
          <img src="/branding/rajkamal-logo.png" alt="" />
        </div>

        <div className="login-content">
          <div className="login-heading">
            <h1 id="login-title">CRM</h1>
            <p>Lead Relationship Management</p>
          </div>

          <div className="login-welcome">
            <h2>Welcome Back!</h2>
            <p>Sign in to continue to your account</p>
          </div>

          {error && (
            <div className="login-alert" role="alert">
              <span className="login-alert-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={submit}>
            {/* <label className="login-environment">
              <span className="environment-icon" aria-hidden="true">⌁</span>
              <span>Environment</span>
              <select aria-label="Environment" defaultValue="DEV" disabled>
                <option value="DEV">DEV</option>
              </select>
            </label> */}

            <label className="login-input-wrap">
              <span className="login-input-icon" aria-hidden="true">♙</span>
              <span className="sr-only">Login ID</span>
              <input
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="Login ID"
                autoComplete="username"
                autoFocus
              />
            </label>

            <label className="login-input-wrap">
              <span className="login-input-icon" aria-hidden="true">▣</span>
              <span className="sr-only">Password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </label>

            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span>Remember me</span>
              </label>
              <button type="button" className="forgot-password" onClick={() => setError('Please contact your administrator to reset your password.')}>Forgot Password?</button>
            </div>

            <button className="login-submit" type="submit" disabled={busy}>
              <span aria-hidden="true">⇥</span>
              <span>{busy ? 'Signing in' : 'LOGIN'}</span>
              <span className={busy ? 'login-arrow login-arrow-loading' : 'login-arrow'} aria-hidden="true">→</span>
            </button>
          </form>

          <div className="login-security">
            <span />
            <span>Secure &amp; Trusted</span>
            <span />
          </div>

          <div className="security-badge" aria-hidden="true">♢</div>
          <div className="login-footer">
            <strong>Version 1.0.0 • DEV</strong>
            <span>© 2026 Rajkamal Barscan. All rights reserved.</span>
          </div>
        </div>
      </section>
    </main>
  )
}
