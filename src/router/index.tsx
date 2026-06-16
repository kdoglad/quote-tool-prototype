import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { isPreviewMode } from '../lib/supabase'
import AppShell from '../components/layout/AppShell'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import QuoteListPage from '../pages/quotes/QuoteListPage'
import QuoteEditorPage from '../pages/quotes/QuoteEditorPage'
import VersionListPage from '../pages/price-table/VersionListPage'
import VersionEditorPage from '../pages/price-table/VersionEditorPage'

function AuthGuard() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  if (isPreviewMode) return <Outlet />

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            path: 'quotes',
            children: [
              { index: true, element: <QuoteListPage /> },
              { path: 'new', element: <QuoteEditorPage /> },
              { path: ':id', element: <QuoteEditorPage /> },
            ],
          },
          {
            path: 'price-tables',
            children: [
              { index: true, element: <VersionListPage /> },
              { path: ':id', element: <VersionEditorPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
