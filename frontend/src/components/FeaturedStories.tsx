import { useRef } from 'react'
import { featuredStories } from '../data/homeContent'

export default function FeaturedStories() {
  const trackRef = useRef<HTMLUListElement>(null)

  function scrollStories(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return

    const firstCard = track.querySelector<HTMLElement>('.story-card')
    const cardWidth = firstCard?.getBoundingClientRect().width ?? 320
    const gap = 20
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'

    track.scrollBy({ left: direction * (cardWidth + gap), behavior })
  }

  return (
    <section className="featured-stories" id="featured-stories" aria-labelledby="featured-title">
      <div className="featured-stories__heading">
        <div>
          <p className="eyebrow">Stories from Gainesville</p>
          <h2 id="featured-title">Featured Stories</h2>
          <p className="featured-stories__intro">
            Meet the people and businesses behind the local history.
          </p>
        </div>
        <div className="story-carousel__controls" role="group" aria-label="Featured story controls">
          <button type="button" aria-label="Scroll stories left" onClick={() => scrollStories(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" aria-label="Scroll stories right" onClick={() => scrollStories(1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <div className="featured-stories__rule" aria-hidden="true" />

      <ul
        className="story-carousel__track"
        ref={trackRef}
        aria-label="Featured business stories"
        tabIndex={0}
      >
        {featuredStories.map((story) => (
          <li key={story.id}>
            <article className="story-card">
              <div
                className={`story-card__photo story-card__photo--${story.accent}`}
                role="img"
                aria-label={`Placeholder for a photograph of ${story.title}`}
              >
                <span className="story-card__photo-label">Story photo coming soon</span>
              </div>
              <div className="story-card__body">
                <p className="story-card__category">{story.category}</p>
                <h3>{story.title}</h3>
                <p className="story-card__description">Interview highlights coming soon.</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <p className="story-carousel__hint">Scroll horizontally to explore all five stories.</p>
    </section>
  )
}
