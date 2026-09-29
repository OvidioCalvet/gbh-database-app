import FeaturedStories from '../components/FeaturedStories'
import HeroSection from '../components/HeroSection'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'

export default function HomePage() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content">
        <HeroSection />
        <FeaturedStories />
      </main>
      <SiteFooter />
    </div>
  )
}
