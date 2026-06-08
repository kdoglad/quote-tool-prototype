import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Save } from 'lucide-react'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import type { AcMapRow } from '../../types/domain.types'

interface AcPricingMapEditorProps {
  isDraft: boolean
  acMap: AcMapRow[]
  onSave?: (newMap: AcMapRow[]) => Promise<void>
}

export default function AcPricingMapEditor({ isDraft, acMap, onSave }: AcPricingMapEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  const [localMap, setLocalMap] = useState<AcMapRow[]>([])

  useEffect(() => {
    if (acMap) {
      setLocalMap(acMap)
    }
  }, [acMap])

  const handleUpdate = (index: number, field: keyof AcMapRow, value: string) => {
    const newMap = [...localMap]
    const parsed = value === '' ? null : parseFloat(value)
    newMap[index] = { ...newMap[index], [field]: parsed }
    setLocalMap(newMap)
  }

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(localMap)
      addToast('success', 'AC Map updated successfully.')
    } catch (err: any) {
      addToast('error', `Failed to update AC Map: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSeed = async () => {
    const defaultMap = [
      { size_mm2: 1.5, copper_single_core: null, copper_4c_e: 1.69, alu_single_core: null, alu_4c_e: null },
      { size_mm2: 2.5, copper_single_core: null, copper_4c_e: 2.91, alu_single_core: null, alu_4c_e: null },
      { size_mm2: 4, copper_single_core: null, copper_4c_e: 4.45, alu_single_core: null, alu_4c_e: null },
      { size_mm2: 6, copper_single_core: null, copper_4c_e: 6.04, alu_single_core: null, alu_4c_e: null },
      { size_mm2: 10, copper_single_core: null, copper_4c_e: 11.19, alu_single_core: null, alu_4c_e: null },
      { size_mm2: 16, copper_single_core: null, copper_4c_e: 16.94, alu_single_core: null, alu_4c_e: null },
      { size_mm2: 25, copper_single_core: 5.81, copper_4c_e: 24.99, alu_single_core: 1.83, alu_4c_e: null },
      { size_mm2: 35, copper_single_core: 7.96, copper_4c_e: 35.35, alu_single_core: 1.98, alu_4c_e: null },
      { size_mm2: 50, copper_single_core: 11.07, copper_4c_e: 47.97, alu_single_core: 3.48, alu_4c_e: 15.75 },
      { size_mm2: 70, copper_single_core: 15.17, copper_4c_e: 66.49, alu_single_core: 3.77, alu_4c_e: 16.89 },
      { size_mm2: 95, copper_single_core: 20.01, copper_4c_e: 85.84, alu_single_core: 4.40, alu_4c_e: 19.59 },
      { size_mm2: 120, copper_single_core: 25.39, copper_4c_e: 109.51, alu_single_core: 5.47, alu_4c_e: 25.36 },
      { size_mm2: 150, copper_single_core: 31.34, copper_4c_e: 136.43, alu_single_core: 6.70, alu_4c_e: 30.28 },
      { size_mm2: 185, copper_single_core: 41.90, copper_4c_e: 182.77, alu_single_core: 8.21, alu_4c_e: 36.62 },
      { size_mm2: 240, copper_single_core: 51.11, copper_4c_e: 224.45, alu_single_core: 10.91, alu_4c_e: 48.06 },
      { size_mm2: 300, copper_single_core: 64.75, copper_4c_e: 284.38, alu_single_core: 13.45, alu_4c_e: 59.27 },
      { size_mm2: 400, copper_single_core: 83.41, copper_4c_e: 359.03, alu_single_core: 17.04, alu_4c_e: 76.36 }
    ] as AcMapRow[]
    
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(defaultMap)
      setLocalMap(defaultMap)
      addToast('success', 'AC Map seeded with default data.')
    } catch (err: any) {
      addToast('error', `Failed to seed AC Map: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        <span className="font-medium text-slate-200 text-sm">AC Pricing Map (AS3008)</span>
        <span className="text-xs text-slate-600 ml-auto">Version-Specific Configuration</span>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-800 p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-slate-400">
              Prices defined here are automatically pulled by the AC Calculator in the Quote Editor. 
              {isDraft && ' When you publish this draft, a snapshot of this table will be permanently tied to the version.'}
            </p>
            <div className="flex gap-2">
              {isDraft && localMap.length === 0 && (
                <Button variant="secondary" size="sm" loading={saving} onClick={handleSeed}>
                  Seed Default Data
                </Button>
              )}
              {isDraft && localMap.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save className="w-4 h-4" />}
                  loading={saving}
                  onClick={handleSave}
                >
                  Save AC Map
                </Button>
              )}
            </div>
          </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="px-4 py-2 font-medium border-b border-r border-slate-700 row-span-2">Active Conductor Size (mm²)</th>
                    <th className="px-4 py-2 font-medium border-b border-r border-slate-700 text-center" colSpan={2}>Copper</th>
                    <th className="px-4 py-2 font-medium border-b border-slate-700 text-center" colSpan={2}>Aluminium</th>
                  </tr>
                  <tr>
                    <th className="px-4 py-2 font-medium border-b border-r border-slate-700 bg-slate-800/50">Single Core ($/m)</th>
                    <th className="px-4 py-2 font-medium border-b border-r border-slate-700 bg-slate-800/50">4C + E ($/m)</th>
                    <th className="px-4 py-2 font-medium border-b border-r border-slate-700 bg-slate-800/50">Single Core ($/m)</th>
                    <th className="px-4 py-2 font-medium border-b border-slate-700 bg-slate-800/50">4C + E ($/m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {localMap.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/20">
                      <td className="px-4 py-2 border-r border-slate-800 font-mono text-slate-300">{row.size_mm2}</td>
                      <td className="px-2 py-1 border-r border-slate-800">
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isDraft}
                          value={row.copper_single_core ?? ''}
                          onChange={(e) => handleUpdate(idx, 'copper_single_core', e.target.value)}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-slate-800">
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isDraft}
                          value={row.copper_4c_e ?? ''}
                          onChange={(e) => handleUpdate(idx, 'copper_4c_e', e.target.value)}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-slate-800">
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isDraft}
                          value={row.alu_single_core ?? ''}
                          onChange={(e) => handleUpdate(idx, 'alu_single_core', e.target.value)}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isDraft}
                          value={row.alu_4c_e ?? ''}
                          onChange={(e) => handleUpdate(idx, 'alu_4c_e', e.target.value)}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}
    </div>
  )
}
