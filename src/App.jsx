import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Trainer from './pages/Trainer';
import Play from './pages/Play';
import Study from './pages/Study';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trainer" element={<Trainer />} />
          <Route path="/play" element={<Play />} />
          <Route path="/study" element={<Study />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
