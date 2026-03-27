import { Link, useLocation } from 'react-router-dom';
import { Home, Lightbulb, GraduationCap, PlayCircle } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'ホーム', icon: Home },
  { to: '/play', label: '実戦', icon: PlayCircle },
  { to: '/trainer', label: 'スポット', icon: GraduationCap },
  { to: '/study', label: 'スタディ', icon: Lightbulb },
];

const Layout = ({ children }) => {
  const location = useLocation();
  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="app-container">
      <header className="header">
        <Link to="/" className="logo">
          ♠ GTO Coach
        </Link>
        <nav className="nav-links">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
