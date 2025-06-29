import { useEffect, useState } from 'react'
import ReelPersona from './components/ReelPersona'
import './index.css'

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initialization
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    // Force dark mode on the document
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.classList.add('gradient-background');

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <ReelPersona />
    </div>
  );
}

export default App