function Header({ account, onLogout, onOpenAuth, onGoHome, isAuthView }) {

  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <div className="site-brand">routr</div>
        {account ? (
          <div className="site-user">
            <span>{account.email}</span>
            <button type="button" className="site-logout" onClick={onLogout}>Log out</button>
          </div>
        ) : (
          <button
            type="button"
            className="site-auth-entry"
            onClick={isAuthView ? onGoHome : onOpenAuth}
          >
            {isAuthView ? 'Back to Home' : 'Log in / Register'}
          </button>
        )}
      </div>
    </header>
  )
}

export default Header
