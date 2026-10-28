import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen antialiased relative overflow-x-hidden transition-colors duration-200">
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
