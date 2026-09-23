import { useEffect, useState } from 'react';
import { api } from './api';
import PosView from './pages/PosView';
import HqView from './pages/HqView';

export default function App() {
  const [view, setView] = useState('pos');
  const [outlets, setOutlets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getOutlets().then(setOutlets).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>F&amp;B POS</h1>
        <div className="tabs">
          <button className={view === 'pos' ? 'active' : ''} onClick={() => setView('pos')}>
            Outlet POS
          </button>
          <button className={view === 'hq' ? 'active' : ''} onClick={() => setView('hq')}>
            HQ
          </button>
        </div>
      </div>

      {error && <div className="error-banner">Could not reach the API: {error}</div>}

      {outlets.length === 0 && !error ? (
        <p className="muted">Loading outlets...</p>
      ) : view === 'pos' ? (
        <PosView outlets={outlets} />
      ) : (
        <HqView outlets={outlets} />
      )}
    </div>
  );
}
