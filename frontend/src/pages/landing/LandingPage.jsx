import './LandingPage.css'

function LandingPage({
  account,
  history,
  historyLoading,
  actionLoading,
  onCreateRoute,
}) {
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

        {account && (
          <div className="hero-actions">
            <button className="primary-btn" onClick={onCreateRoute} disabled={actionLoading}>
              {actionLoading ? 'Calculating...' : 'Calculate route'}
            </button>
          </div>
        )}

        {account && (
          <section className="history-section">
            <h2>Saved routes</h2>
            {historyLoading ? (
              <p className="history-empty">Loading route history…</p>
            ) : history.length === 0 ? (
              <p className="history-empty">No saved routes yet. Calculate your first route.</p>
            ) : (
              <ul className="history-list">
                {history.map((item) => (
                  <li key={item.id} className="history-item">
                    <p className="history-date">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    <p>
                      Routes: {item.routes.length} · Unassigned passengers: {item.unassignedPassengerIds.length}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </section>
    </div>
  )
}

export default LandingPage
