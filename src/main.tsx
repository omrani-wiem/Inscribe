import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SubmitPage from './pages/SubmitPage';
import AuthGate from './pages/AuthGate';
import './index.css';

const isPublicForm = window.location.pathname.startsWith('/submit');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPublicForm ? <SubmitPage /> : <AuthGate><App /></AuthGate>}
  </React.StrictMode>,
);