import { Link } from 'react-router-dom'
import { FileText, PlusCircle, Table, TrendingUp } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export default function DashboardPage() {
  const { profile } = useAuthStore()

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">
          Good day, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-slate-400 mt-1">Smart Commercial Energy — Quote Management System</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link
          to="/quotes/new"
          className="group flex items-start gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl
                     hover:border-brand-700 hover:bg-slate-900/80 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-brand-900/40 flex items-center justify-center shrink-0
                          group-hover:bg-brand-800/60 transition-colors">
            <PlusCircle className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="font-medium text-white">New Quote</p>
            <p className="text-sm text-slate-400 mt-0.5">Start a new commercial solar quote</p>
          </div>
        </Link>

        <Link
          to="/quotes"
          className="group flex items-start gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl
                     hover:border-slate-700 hover:bg-slate-900/80 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0
                          group-hover:bg-slate-700 transition-colors">
            <FileText className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <p className="font-medium text-white">All Quotes</p>
            <p className="text-sm text-slate-400 mt-0.5">Browse, search and manage quotes</p>
          </div>
        </Link>

        <Link
          to="/price-tables"
          className="group flex items-start gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl
                     hover:border-slate-700 hover:bg-slate-900/80 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0
                          group-hover:bg-slate-700 transition-colors">
            <Table className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <p className="font-medium text-white">Price Tables</p>
            <p className="text-sm text-slate-400 mt-0.5">Edit and publish price versions</p>
          </div>
        </Link>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-400">
        <TrendingUp className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-300 font-medium">Getting started: </span>
          Create a draft price table version under Price Tables, import your line items via CSV,
          then publish the version and start quoting.
        </div>
      </div>
    </div>
  )
}
