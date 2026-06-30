import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface IntroProps {
  onComplete: () => void;
}

export function Intro({ onComplete }: IntroProps) {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Auto-close after 3.5 seconds
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        setShow(false);
        onComplete();
      }, 500);
    }, 3500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background elements */}
      <div className="absolute top-10 left-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-60 h-60 bg-cyan-300 opacity-10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 text-center max-w-md px-6">
        {/* Logo Icon with animation */}
        <div className="mb-8 inline-block">
          <div className="relative w-28 h-28 flex items-center justify-center animate-bounce">
            <div className="absolute inset-0 bg-white rounded-full opacity-20 animate-ping"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-white to-blue-100 rounded-full flex items-center justify-center shadow-2xl">
              <AlertTriangle className="w-12 h-12 text-blue-600 animate-pulse" />
            </div>
          </div>
        </div>

        {/* App Name with staggered animation */}
        <div className="mb-2 overflow-hidden">
          <h1 className="text-5xl font-bold text-white animate-slideUp">
            Safe Roads
          </h1>
        </div>

        {/* Tagline with fadeIn animation */}
        <div className="overflow-hidden">
          <p
            className="text-xl text-blue-100 font-light tracking-wide animate-slideUp"
            style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
          >
            AI for Safer Streets
          </p>
        </div>

        {/* Loading dots */}
        <div className="mt-12 flex justify-center gap-2">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>

        {/* Subtitle */}
        <p className="mt-8 text-sm text-blue-100 opacity-75">Initializing...</p>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
