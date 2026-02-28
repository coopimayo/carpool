import './LandingPage.css'

function LandingPage() {
  return (
    <div className="landing-page shell">
      <section className="hero">
        <p className="eyebrow">Carpooling Route Calculator</p>
        <h1>Calculate the best shared route, fast.</h1>
        <p className="hero-copy">
          Optimize pickups, drop-offs, and seat assignments so every shared ride
          is efficient.
        </p>

        <div className="route-tags" aria-label="Route features">
          <span>Shortest path focus</span>
          <span>Seat-aware matching</span>
          <span>ETA-friendly assignments</span>
        </div>

        <div className="hero-actions">
          <button className="primary-btn">Calculate route</button>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
