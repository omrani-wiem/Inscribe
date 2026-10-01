import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SubmitPage from './pages/SubmitPage';
import './index.css';

const isPublicForm = window.location.pathname.startsWith('/submit');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPublicForm ? <SubmitPage /> : <App />}
  </React.StrictMode>,
);