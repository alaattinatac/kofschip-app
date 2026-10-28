import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0B0F19] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 transition-colors duration-200 relative overflow-x-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
