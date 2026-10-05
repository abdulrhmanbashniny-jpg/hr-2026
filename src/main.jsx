import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { ToastProvider } from './lib.jsx';
import { Home, JobPage, Apply, TestPage, BookPage } from './public/Public.jsx';
import { AuthProvider, Login, AdminLayout } from './admin/Auth.jsx';
import Overview from './admin/Overview.jsx';
import { JobsList, JobEditor } from './admin/Jobs.jsx';
import ImportJob from './admin/ImportJob.jsx';
import { Candidates, CandidateView } from './admin/Candidates.jsx';
import Ranking from './admin/Ranking.jsx';
import Scheduler from './admin/Scheduler.jsx';
import Messages from './admin/Messages.jsx';
import { Users, Settings, Account } from './admin/Settings.jsx';

function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs/:id" element={<JobPage />} />
          <Route path="/apply/:id" element={<Apply />} />
          <Route path="/test/:token" element={<TestPage />} />
          <Route path="/book/:token" element={<BookPage />} />
          <Route path="/admin/login" element={<AuthProvider><Login /></AuthProvider>} />
          <Route path="/admin" element={<AuthProvider><AdminLayout /></AuthProvider>}>
            <Route index element={<Overview />} />
            <Route path="jobs" element={<JobsList />} />
            <Route path="jobs/:id" element={<JobEditor />} />
            <Route path="import" element={<ImportJob />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="candidates/:id" element={<CandidateView />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="schedule" element={<Scheduler />} />
            <Route path="messages" element={<Messages />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
