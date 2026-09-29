import heroPhoto from '../assets/gainesville-tourist-camp.jpg'

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
          A collection of interviews with local business owners in Gainesville, FL.
        </h1>
        <p className="hero-section__description">
          Explore the people, places, and stories behind Gainesville’s business history.
        </p>
        <a className="hero-section__action" href="#featured-stories">
          Explore featured stories <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  )
}
