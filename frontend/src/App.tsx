import './App.css'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import DatabasePage from './pages/DatabasePage'
import HomePage from './pages/HomePage'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'

function App() {
  return (
    <BrowserRouter>
      <div className="site-shell">
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SiteHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/database" element={<DatabasePage />} />
          <Route
            path="*"
            element={
              <main className="coming-soon" id="main-content">
                <p className="eyebrow">Coming soon</p>
                <h1>This page is being prepared.</h1>
                <p>Return to the home page or browse the public database.</p>
                <div className="coming-soon__links">
                  <Link to="/">Home</Link>
                  <Link to="/database">Browse the database</Link>
                </div>
              </main>
            }
          />
        </Routes>
        <SiteFooter />
      </div>
    </BrowserRouter>
  )
}

export default App
