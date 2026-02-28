import LandingPage from '../pages/landing/LandingPage'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import '../components/layout/layout.css'

function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <LandingPage />
      </main>
      <Footer />
    </div>
  )
}

export default App
