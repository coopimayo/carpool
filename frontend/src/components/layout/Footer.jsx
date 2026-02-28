function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer-inner">
        <p>© {new Date().getFullYear()} routr</p>
        <p>Route optimization for shared rides</p>
      </div>
    </footer>
  )
}

export default Footer
