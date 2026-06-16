import { useState, useEffect } from 'react'
import type { ItemCategory, CustomLineItem } from '../../types/domain.types'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { CATEGORIES, UNITS } from '../../lib/constants'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import Spinner from '../ui/Spinner'

interface QuoteAddItemDialogProps {
  onAdd: (item: CustomLineItem) => void
  onClose: () => void
}

export default function QuoteAddItemDialog({ onAdd, onClose }: QuoteAddItemDialogProps) {
  const { addToast } = useToast()
  const [category, setCategory] = useState<ItemCategory>('Safety')
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false)
  const [catalogItems, setCatalogItems] = useState<any[]>([])

  // Mode: select existing vs create new (manual)
  const [mode, setMode] = useState<'select' | 'manual'>('manual')
  
  // Selection state
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('')

  // Manual inputs
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('ea')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('0')

  // Fetch catalog items for the selected category if applicable
  useEffect(() => {
    if (['PV_Components', 'BESS', 'Inverter'].includes(category)) {
      setMode('select')
      fetchCatalogItems(category)
    } else {
      setMode('manual')
    }
  }, [category])

  async function fetchCatalogItems(cat: ItemCategory) {
    setIsLoading(true)
    try {
      const dbCategory = cat === 'PV_Components' ? 'Solar' : cat
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('category', dbCategory)
      if (error) throw error
      setCatalogItems(data || [])
      if (data && data.length > 0) setSelectedCatalogId(data[0].item_id)
    } catch (err) {
      console.error(err)
      addToast('error', 'Failed to fetch catalog items')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAdd() {
    if (mode === 'select') {
      const selectedItem = catalogItems.find(c => c.item_id === selectedCatalogId)
      if (!selectedItem) {
        addToast('error', 'Please select an item')
        return
      }
      
      // Look up its spec to get the price
      let basePrice = 0
      try {
        if (selectedItem.item_type === 'Panel') {
          const { data } = await supabase.from('panel_specs').select('wattage, cost_per_watt').eq('item_id', selectedItem.item_id).single()
          if (data) basePrice = (data.cost_per_watt || 0) * (data.wattage || 0)
        } else if (selectedItem.item_type === 'Battery') {
          const { data } = await supabase.from('battery_specs').select('battery_price_fob').eq('item_id', selectedItem.item_id).single()
          if (data) basePrice = data.battery_price_fob || 0
        }
      } catch (err) {
        console.error("Failed to fetch specs", err)
      }

      onAdd({
        id: Math.random().toString(36).slice(2),
        category,
        code: selectedItem.item_code,
        name: selectedItem.item_name,
        unit: 'ea',
        qty: parseFloat(qty) || 1,
        base_unit_price: basePrice,
        formula: null,
        modifier_type: 'none',
        modifier_value: 0,
        modifier_note: '',
        sort_order: 9999,
      })
      onClose()
    } else {
      if (!description.trim()) {
        addToast('error', 'Description is required')
        return
      }
      
      onAdd({
        id: Math.random().toString(36).slice(2),
        category,
        code: `CUST-${Date.now().toString(36).slice(-6).toUpperCase()}`,
        name: description.trim(),
        unit,
        qty: parseFloat(qty) || 1,
        base_unit_price: parseFloat(cost) || 0,
        formula: null,
        modifier_type: 'none',
        modifier_value: 0,
        modifier_note: '',
        sort_order: 9999,
      })
      onClose()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add Item"
      description="Add an item to the quote. Select from the catalog or input manually based on category."
      size="lg"
    >
      <div className="space-y-4">
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ItemCategory)}
          options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        />

        {['PV_Components', 'BESS', 'Inverter'].includes(category) && (
          <div className="flex gap-2 mb-2">
            <Button 
              variant={mode === 'select' ? 'primary' : 'ghost'} 
              onClick={() => setMode('select')}
            >
              Select from Catalog
            </Button>
            <Button 
              variant={mode === 'manual' ? 'primary' : 'ghost'} 
              onClick={() => setMode('manual')}
            >
              Manual Input
            </Button>
          </div>
        )}

        {mode === 'select' ? (
          isLoading ? (
            <div className="flex justify-center p-4"><Spinner /></div>
          ) : (
            <Select
              label="Select Catalog Item"
              value={selectedCatalogId}
              onChange={(e) => setSelectedCatalogId(e.target.value)}
              options={catalogItems.map(c => ({ value: c.item_id, label: `${c.item_code} - ${c.item_name}` }))}
            />
          )
        ) : (
          <Input
            label="Description / Item Name"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Additional scaffolding"
          />
        )}

        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            options={UNITS}
          />
          <Input
            label="Quantity"
            type="number"
            min="0"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          {mode === 'manual' && (
            <Input
              label="Base cost ($)"
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              prefix="$"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={isLoading || (mode === 'manual' && !description.trim())}
          >
            Add to Quote
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
