import { BrowserRouter, Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Pipeline } from "./pages/Pipeline";
import { Conversations } from "./pages/Conversations";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { useEffect, useState } from "react";

export default function App() {
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    fetch('/api/seed', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.companyId) {
          localStorage.setItem('companyId', data.companyId);
          localStorage.setItem('userId', data.userId);
          setIsSeeded(true);
        }
      });
  }, []);

  if (!isSeeded) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
