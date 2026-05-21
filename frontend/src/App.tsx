import { BrowserRouter, Route, Routes } from 'react-router-dom'

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Wedding Platform
        </h1>
        <p className="text-slate-600">
          MVP in costruzione &mdash; setup base attivo.
        </p>
        <p className="text-sm text-slate-400">
          Vite + React 18 + TypeScript strict + Tailwind v4 + Supabase
        </p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
