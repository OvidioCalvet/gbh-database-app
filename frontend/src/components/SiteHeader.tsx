import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import gbhLogo from '../assets/GNV Business History Multicolored.png'
import { useAuth } from '../features/auth/useAuth'

const navigationLinks = [
  { label: 'Home', to: '/' },
  { label: 'Oral Histories', href: 'https://gbhoralhistories.com/' },
  { label: 'Database', to: '/database' },
  { label: 'Map', to: '/map' },
] as const

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { status, user, logOut } = useAuth()
  const navigate = useNavigate()

  function closeMenu() {
    setMenuOpen(false)
  }

  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)

    try {
      await logOut()
      closeMenu()
      navigate('/')
    } catch {
      setLogoutError('Could not sign out. Please try again.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-header__brand" to="/">
          <img src={gbhLogo} alt="" />
          <span className="site-header__wordmark">
            Gainesville
            <br />
            Business History
          </span>
        </Link>

        <button
          className="site-header__menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav
          className={`site-header__navigation${menuOpen ? ' site-header__navigation--open' : ''}`}
          id="primary-navigation"
          aria-label="Primary navigation"
        >
          <ul className="site-header__links">
            {navigationLinks.map((link) => (
              <li key={link.label}>
                {'to' in link ? (
                  <NavLink
                    className="site-header__link"
                    to={link.to}
                    end={link.to === '/'}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </NavLink>
                ) : (
                  <a className="site-header__link" href={link.href} onClick={closeMenu}>
                    {link.label}
                  </a>
                )}
              </li>
            ))}
            {status === 'authenticated' && (
              <li>
                <NavLink
                  className="site-header__link site-header__data-link"
                  to="/data-entry"
                  onClick={closeMenu}
                >
                  <span aria-hidden="true">+</span> Add Data
                </NavLink>
              </li>
            )}
          </ul>
          <div className="site-header__session">
            {status === 'authenticated' && user ? (
              <>
                <span className="site-header__session-divider" aria-hidden="true">
                  |
                </span>
                <details className="site-header__account">
                  <summary className="site-header__account-trigger">
                    <span>{user.displayName || user.username}</span>
                    <span className="site-header__account-chevron" aria-hidden="true">
                      ▾
                    </span>
                  </summary>
                  <div className="site-header__account-menu">
                    <p>Signed in as {user.username}</p>
                    {logoutError && (
                      <p className="site-header__logout-error" role="alert">
                        {logoutError}
                      </p>
                    )}
                    <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
                      {isLoggingOut ? 'Signing out…' : 'Log Out'}
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <NavLink className="site-header__login" to="/login" onClick={closeMenu}>
                Log In
              </NavLink>
            )}
          </div>
        </nav>
      </div>
      <div className="site-header__rule" aria-hidden="true" />
    </header>
  )
}
