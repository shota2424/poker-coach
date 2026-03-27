import { Link, useLocation } from 'react-router-dom';
import { Home, Lightbulb, GraduationCap, PlayCircle } from 'lucide-react';

const Layout = ({ children }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <div className="app-container">
      <header className="header">
        <Link to="/" className="logo">
          ♠️ GTO Coach AI
        </Link>
        <nav className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            <Home size={18} /> ホーム
          </Link>
          <Link to="/play" className={`nav-link ${isActive('/play') ? 'active' : ''}`}>
            <PlayCircle size={18} /> 実戦プレイ
          </Link>
          <Link to="/trainer" className={`nav-link ${isActive('/trainer') ? 'active' : ''}`}>
            <GraduationCap size={18} /> スポット練習
          </Link>
          <Link to="/study" className={`nav-link ${isActive('/study') ? 'active' : ''}`}>
            <Lightbulb size={18} /> スタディ
          </Link>
        </nav>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
