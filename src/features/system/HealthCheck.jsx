import { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';

/**
 * Module 1 connectivity check: calls the backend /health endpoint and shows
 * whether the React app can reach FastAPI. Replaced by real dashboards later.
 */
export default function HealthCheck() {
  const [state, setState] = useState({ loading: true, ok: false, data: null, error: null });

  useEffect(() => {
    apiClient
      .get('/health')
      .then((res) => setState({ loading: false, ok: true, data: res.data, error: null }))
      .catch((err) =>
        setState({ loading: false, ok: false, data: null, error: err.message }),
      );
  }, []);

  return (
    <div className="card">
      <h2>System Health</h2>
      {state.loading && <p>Checking backend connection…</p>}
      {!state.loading && state.ok && (
        <>
          <p>
            Backend status: <span className="badge badge-ok">Connected</span>
          </p>
          <pre>{JSON.stringify(state.data, null, 2)}</pre>
        </>
      )}
      {!state.loading && !state.ok && (
        <>
          <p>
            Backend status: <span className="badge badge-err">Unreachable</span>
          </p>
          <p>{state.error}</p>
          <p>Ensure the backend is running at the configured VITE_API_BASE_URL.</p>
        </>
      )}
    </div>
  );
}
