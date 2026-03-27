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
            <Home size={20} /> <span>ホーム</span>
          </Link>
          <Link to="/play" className={`nav-link ${isActive('/play') ? 'active' : ''}`}>
            <PlayCircle size={20} /> <span>実戦プレイ</span>
          </Link>
          <Link to="/trainer" className={`nav-link ${isActive('/trainer') ? 'active' : ''}`}>
            <GraduationCap size={20} /> <span>スポット練習</span>
          </Link>
          <Link to="/study" className={`nav-link ${isActive('/study') ? 'active' : ''}`}>
            <Lightbulb size={20} /> <span>スタディ</span>
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
