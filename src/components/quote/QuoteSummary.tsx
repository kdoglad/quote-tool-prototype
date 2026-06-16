import { clsx } from 'clsx'
import type { ComputedLineItem } from '../../types/domain.types'
import { useQuoteTotals } from '../../hooks/useComputedLineItems'

interface QuoteSummaryProps {
  items: ComputedLineItem[]
  systemKw: number
  className?: string
}

export default function QuoteSummary({ items, systemKw, className }: QuoteSummaryProps) {
  const { subtotal, rebateTotal, netBeforeGST, gst, total } = useQuoteTotals(items, systemKw)
  const pricePerKw = systemKw > 0 ? netBeforeGST / systemKw : 0

  return (
    <div className={clsx('bg-slate-900 border border-slate-800 rounded-xl p-4', className)}>
      <h3 className="text-sm font-medium text-slate-300 mb-3">Quote Summary</h3>

      <div className="space-y-2 text-sm">
        <SummaryRow label="Subtotal (ex GST)" value={subtotal} />
        {rebateTotal !== 0 && (
          <SummaryRow
            label="Rebates & Incentives"
            value={rebateTotal}
            className="text-green-400"
          />
        )}
        <div className="border-t border-slate-800 pt-2 mt-2">
          <SummaryRow label="Net (ex GST)" value={netBeforeGST} bold />
          <SummaryRow label="GST (10%)" value={gst} />
        </div>
        <div className="border-t border-slate-800 pt-2 mt-2">
          <SummaryRow label="Total (inc GST)" value={total} large />
        </div>
      </div>

      {systemKw > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">System size</span>
            <span className="text-slate-300 font-mono">{systemKw} kWp</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-500">Price / kW (net ex GST)</span>
            <span className="text-slate-300 font-mono">
              ${pricePerKw.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/kW
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  large,
  className,
}: {
  label: string
  value: number
  bold?: boolean
  large?: boolean
  className?: string
}) {
  return (
    <div className={clsx('flex justify-between', large && 'pt-1')}>
      <span className={clsx('text-slate-400', bold && 'font-medium text-slate-300', large && 'text-base font-semibold text-white')}>
        {label}
      </span>
      <span
        className={clsx(
          'font-mono',
          bold && 'font-medium text-slate-200',
          large && 'text-base font-semibold text-white',
          value < 0 && 'text-green-400',
          className
        )}
      >
        {value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}
