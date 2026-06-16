import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Search, ChevronRight, FileText } from 'lucide-react'
import { useQuotes } from '../../hooks/useQuotes'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import type { Quote } from '../../types/domain.types'

const statusVariant: Record<Quote['status'], 'draft' | 'info' | 'success' | 'danger' | 'warning'> = {
  draft:    'draft',
  sent:     'info',
  accepted: 'success',
  declined: 'danger',
  expired:  'warning',
}

export default function QuoteListPage() {
  const { data: quotes = [], isLoading } = useQuotes()
  const [search, setSearch] = useState('')

  const filtered = quotes.filter((q) => {
    const s = search.toLowerCase()
    return (
      q.quote_number?.toLowerCase().includes(s) ||
      q.customer_name.toLowerCase().includes(s) ||
      q.project_name.toLowerCase().includes(s) ||
      q.site_suburb.toLowerCase().includes(s)
    )
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Quotes</h1>
          <p className="text-sm text-slate-400 mt-0.5">{quotes.length} quote{quotes.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/quotes/new">
          <Button variant="primary" icon={<PlusCircle className="w-4 h-4" />}>
            New Quote
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by quote number, customer, project, suburb…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white
                     placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'No quotes match your search.' : 'No quotes yet. Create your first quote above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((quote) => (
            <Link
              key={quote.id}
              to={`/quotes/${quote.id}`}
              className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl
                         hover:border-slate-700 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-400">{quote.quote_number}</span>
                  <span className="font-medium text-white text-sm">{quote.project_name}</span>
                  <Badge variant={statusVariant[quote.status]} className="capitalize">
                    {quote.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {quote.customer_name}
                  {quote.customer_company ? ` — ${quote.customer_company}` : ''}
                  {' · '}
                  {quote.site_suburb}, {quote.site_state}
                  {quote.system_kw ? ` · ${quote.system_kw} kWp` : ''}
                </p>
              </div>
              <div className="text-xs text-slate-600 shrink-0 text-right">
                <div>{new Date(quote.updated_at).toLocaleDateString('en-AU')}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
