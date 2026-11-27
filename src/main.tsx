import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import App from './App';
import { ToastProvider } from './components/Toast';
import { StoreProvider } from './lib/store';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/workout.css';
import './styles/screens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
