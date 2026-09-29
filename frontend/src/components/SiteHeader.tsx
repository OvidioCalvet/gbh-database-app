import { useState } from 'react'
import gbhLogo from '../assets/GNV Business History Multicolored.png'

const navigationLinks = [
  { label: 'Home', href: '/', current: true },
  { label: 'Oral Histories', href: '/oral-histories' },
  { label: 'Database', href: '/database' },
  { label: 'Map', href: '/map' },
]

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="/">
          <img src={gbhLogo} alt="" />
          <span className="site-header__wordmark">
            Gainesville
            <br />
            Business History
          </span>
        </a>

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
                <a
                  className="site-header__link"
                  href={link.href}
                  aria-current={link.current ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a className="site-header__login" href="/login" onClick={closeMenu}>
            Log In
          </a>
        </nav>
      </div>
      <div className="site-header__rule" aria-hidden="true" />
    </header>
  )
}
