import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import gbhLogo from '../assets/GNV Business History Multicolored.png'

const navigationLinks = [
  { label: 'Home', to: '/' },
  { label: 'Oral Histories', href: 'https://gbhoralhistories.com/' },
  { label: 'Database', to: '/database' },
  { label: 'Map', to: '/map' },
] as const

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
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
          </ul>
          <NavLink className="site-header__login" to="/login" onClick={closeMenu}>
            Log In
          </NavLink>
        </nav>
      </div>
      <div className="site-header__rule" aria-hidden="true" />
    </header>
  )
}
