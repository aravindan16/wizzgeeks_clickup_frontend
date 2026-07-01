import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import App from './App';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { initTheme } from './services/theme';
import './index.css';

initTheme();

// NOTE: StrictMode is intentionally disabled. React 18 StrictMode double-mounts
// components in dev, which breaks react-grid-layout's drag/resize (its DraggableCore
// binds to a DOM node that becomes detached after the remount). Without StrictMode
// the dashboard grid drag/resize works; production was never affected.
ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <ToastProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  </Provider>,
);
