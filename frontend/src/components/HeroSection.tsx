import heroPhoto from '../assets/uf-skyview.jpg'

export default function HeroSection() {
  return (
    <section className="hero-section" id="home" aria-labelledby="hero-title">
      <img
        className="hero-section__photo"
        src={heroPhoto}
        alt="Historic view of a Gainesville tourist camp with early automobiles and tents"
      />
      <div className="hero-section__content">
        <p className="eyebrow">Gainesville Business History</p>
        <h1 id="hero-title">
            Uncovering Gainesville's economic and business past.
        </h1>
        <p className="hero-section__description">
          Explore the people, places, and stories behind Gainesville's economic and business life since the 1960's.
        </p>
        <a className="hero-section__action" href="#featured-stories">
          Explore featured stories <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  )
}
