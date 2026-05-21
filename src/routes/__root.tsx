import { Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import '../styles.css'

export default function RootLayout() {
  useEffect(() => {
    // Inject Tailwind and custom styles only on client
    const style = document.createElement('style')
    style.innerHTML = `
      @tailwind base;
      @tailwind components;
      @tailwind utilities;

      :root {
        --green-dark: #1a5c2a;
        --green-mid: #2d7a3a;
        --navy: #1a3060;
        --gold: #c8a000;
        --gold-light: #e6b800;
      }

      body {
        margin: 0;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, "Roboto", sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .bg-jkuat-fixed {
        background-image: url('/queue-bg.jpeg');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center top;
        background-attachment: fixed;
        background-color: #ffffff;
      }

      @keyframes pulse-ring {
        0% { box-shadow: 0 0 0 0 rgba(200, 160, 0, 0.6); }
        70% { box-shadow: 0 0 0 20px rgba(200, 160, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(200, 160, 0, 0); }
      }

      @keyframes slide-in {
        from { transform: translateY(-16px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      @keyframes bounce-in {
        0% { transform: scale(0.85); opacity: 0; }
        70% { transform: scale(1.04); }
        100% { transform: scale(1); opacity: 1; }
      }

      @keyframes glow {
        0%, 100% { box-shadow: 0 0 8px rgba(200, 160, 0, 0.4); }
        50% { box-shadow: 0 0 24px rgba(200, 160, 0, 0.8); }
      }

      .animate-pulse-ring { animation: pulse-ring 2s infinite; }
      .animate-slide-in { animation: slide-in 0.4s ease-out; }
      .animate-bounce-in { animation: bounce-in 0.5s ease-out; }
      .animate-glow { animation: glow 2s ease-in-out infinite; }

      .glass {
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.6);
      }

      .glass-dark {
        background: rgba(26, 48, 96, 0.90);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }

      .glass-green {
        background: rgba(26, 92, 42, 0.90);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }

      code {
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 0.9em;
      }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <div className="min-h-screen bg-jkuat-fixed">
      <Outlet />
    </div>
  )
}