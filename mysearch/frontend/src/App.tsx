import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ImagesPage from './pages/ImagesPage';
import VideosPage from './pages/VideosPage';
import NewsPage from './pages/NewsPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/web" element={<SearchPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/administrator" element={<AdminPage />} />
        </Routes>
      </main>
      
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

export default App; 