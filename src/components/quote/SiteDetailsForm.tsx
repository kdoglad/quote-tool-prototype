import { useEffect } from 'react'
import { MapPin, User, Zap } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { AUSTRALIAN_STATES, INSTALL_TYPES, TRENCH_TYPES } from '../../lib/constants'
import { useQuoteEditorStore } from '../../stores/quoteEditorStore'
import { useDNSPRules } from '../../hooks/useDNSPRules'
import { extractNMIPrefix, resolveDNSP, buildDNSPScope, inferStateFromDNSP } from '../../lib/dnspResolver'
import { STC_ZONE_FACTORS } from '../../lib/constants'

export default function SiteDetailsForm() {
  const { siteDetails, scope, setSiteDetails, setScope, setSystemKw, setInstallType, setTrenchType } = useQuoteEditorStore()
  const { data: dnspRules = [] } = useDNSPRules()

  // Auto-detect DNSP from NMI
  useEffect(() => {
    if (!siteDetails.nmi || siteDetails.nmi.length < 2) return
    const prefix = extractNMIPrefix(siteDetails.nmi)
    const dnsp = resolveDNSP(prefix, dnspRules)
    if (dnsp) {
      const inferredState = inferStateFromDNSP(dnsp)
      setSiteDetails({
        dnsp: dnsp.dnsp_name,
        site_state: inferredState || siteDetails.site_state,
      })
      const dnspScope = buildDNSPScope(dnsp, scope.system_kw ?? 0)
      const stcFactor = STC_ZONE_FACTORS[inferredState] ?? 1.382
      setScope({
        ...dnspScope,
        site_state: inferredState,
        nmi_prefix: prefix,
        stc_zone_factor: stcFactor,
      })
    }
  }, [siteDetails.nmi, dnspRules])

  // Update STC zone factor when state changes manually
  useEffect(() => {
    if (!siteDetails.site_state) return
    const factor = STC_ZONE_FACTORS[siteDetails.site_state] ?? 1.382
    setScope({ site_state: siteDetails.site_state, stc_zone_factor: factor })
  }, [siteDetails.site_state])

  return (
    <div className="space-y-6">
      {/* Customer information */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-medium text-slate-300">Customer Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Primary contact"
            value={siteDetails.primary_contact || siteDetails.customer_name}
            onChange={(e) => setSiteDetails({ primary_contact: e.target.value, customer_name: e.target.value })}
            placeholder="Contact name"
          />
          <Input
            label="Direct phone"
            type="tel"
            value={siteDetails.direct_ph || siteDetails.customer_phone}
            onChange={(e) => setSiteDetails({ direct_ph: e.target.value, customer_phone: e.target.value })}
            placeholder="Phone number"
          />
          <Input
            label="Email address"
            type="email"
            value={siteDetails.email_address || siteDetails.customer_email}
            onChange={(e) => setSiteDetails({ email_address: e.target.value, customer_email: e.target.value })}
            placeholder="email@example.com"
          />
          <Input
            label="Project name"
            value={siteDetails.project_name}
            onChange={(e) => setSiteDetails({ project_name: e.target.value })}
            placeholder="Project name"
          />
          <Input
            label="ABN (optional)"
            value={siteDetails.abn || siteDetails.customer_abn}
            onChange={(e) => setSiteDetails({ abn: e.target.value, customer_abn: e.target.value })}
            placeholder="XX XXX XXX XXX"
          />
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="is_off_grid"
              checked={siteDetails.is_off_grid || false}
              onChange={(e) => setSiteDetails({ is_off_grid: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <label htmlFor="is_off_grid" className="text-sm text-slate-300">
              Off-grid installation
            </label>
          </div>
        </div>
      </section>

      {/* Site details */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-medium text-slate-300">Site Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label="Street address"
              value={siteDetails.site_address}
              onChange={(e) => setSiteDetails({ site_address: e.target.value })}
            />
          </div>
          <Input
            label="Suburb"
            value={siteDetails.site_suburb}
            onChange={(e) => setSiteDetails({ site_suburb: e.target.value })}
          />
          <Select
            label="State"
            value={siteDetails.site_state}
            onChange={(e) => setSiteDetails({ site_state: e.target.value })}
            options={AUSTRALIAN_STATES}
            placeholder="Select state"
          />
          <Input
            label="Postcode"
            value={siteDetails.site_postcode}
            onChange={(e) => {
              setSiteDetails({ site_postcode: e.target.value })
              setScope({ postcode: e.target.value })
            }}
            maxLength={4}
          />
          <div>
            <Input
              label="NMI"
              value={siteDetails.nmi}
              onChange={(e) => setSiteDetails({ nmi: e.target.value.toUpperCase() })}
              placeholder="e.g. 6123456789"
              hint={siteDetails.dnsp ? `DNSP: ${siteDetails.dnsp}` : 'Auto-detects DNSP from NMI prefix'}
            />
          </div>
        </div>
      </section>

      {/* System configuration */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-medium text-slate-300">System Configuration</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="System size (kWp)"
            type="number"
            min="0"
            step="0.5"
            value={scope.system_kw ?? ''}
            onChange={(e) => setSystemKw(parseFloat(e.target.value) || 0)}
            suffix="kWp"
            hint={scope.system_kva ? `≈ ${scope.system_kva} kVA` : undefined}
          />
          <Input
            label="Existing solar on site (kWp)"
            type="number"
            min="0"
            step="0.5"
            value={scope.existing_solar_kw ?? ''}
            onChange={(e) => setScope({ existing_solar_kw: parseFloat(e.target.value) || 0 })}
            suffix="kWp"
          />
          <Select
            label="Install type"
            value={scope.install_type ?? 'rooftop'}
            onChange={(e) => setInstallType(e.target.value as any)}
            options={INSTALL_TYPES}
          />
          <div className="flex items-center gap-6 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scope.has_bess ?? false}
                onChange={(e) => setScope({ has_bess: e.target.checked })}
                className="rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-slate-900"
              />
              <span className="text-sm text-slate-300">Include BESS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scope.has_ev ?? false}
                onChange={(e) => setScope({ has_ev: e.target.checked })}
                className="rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-slate-900"
              />
              <span className="text-sm text-slate-300">Include EV Charging</span>
            </label>
          </div>
        </div>

        {/* Cabling & trenching */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input
            label="AC cable run (m)"
            type="number"
            min="0"
            value={scope.ac_cable_m ?? ''}
            onChange={(e) => setScope({ ac_cable_m: parseFloat(e.target.value) || 0 })}
            suffix="m"
          />
          <Input
            label="DC cable run (m)"
            type="number"
            min="0"
            value={scope.dc_cable_m ?? ''}
            onChange={(e) => setScope({ dc_cable_m: parseFloat(e.target.value) || 0 })}
            suffix="m"
          />
          <Select
            label="Trenching"
            value={scope.trench_type ?? 'none'}
            onChange={(e) => setTrenchType(e.target.value as any)}
            options={TRENCH_TYPES}
          />
          {scope.trench_type !== 'none' && (
            <Input
              label="Trench length (m)"
              type="number"
              min="0"
              value={scope.trench_m ?? ''}
              onChange={(e) => setScope({ trench_m: parseFloat(e.target.value) || 0 })}
              suffix="m"
            />
          )}
        </div>

        {/* Roof perimeter (for safety) */}
        {scope.install_type === 'rooftop' && (
          <div className="mt-4 max-w-xs">
            <Input
              label="Roof perimeter (m)"
              type="number"
              min="0"
              value={scope.roof_perimeter_m ?? ''}
              onChange={(e) => setScope({ roof_perimeter_m: parseFloat(e.target.value) || 0 })}
              suffix="m"
              hint="Used to calculate handrail / height safety requirements"
            />
          </div>
        )}

        {/* BESS size */}
        {scope.has_bess && (
          <div className="mt-4 max-w-xs">
            <Input
              label="Battery capacity (kWh)"
              type="number"
              min="0"
              step="0.5"
              value={scope.bess_kwh ?? ''}
              onChange={(e) => setScope({ bess_kwh: parseFloat(e.target.value) || 0 })}
              suffix="kWh"
            />
          </div>
        )}
      </section>

      {/* STC / Rebate inputs */}
      <section>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Rebate Parameters</h3>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="STC price ($/certificate)"
            type="number"
            step="0.50"
            value={scope.stc_price ?? ''}
            onChange={(e) => setScope({ stc_price: parseFloat(e.target.value) || 0 })}
            prefix="$"
            hint="Update with current spot price"
          />
          <Input
            label="STC zone factor"
            type="number"
            step="0.001"
            value={scope.stc_zone_factor ?? ''}
            onChange={(e) => setScope({ stc_zone_factor: parseFloat(e.target.value) || 0 })}
            hint="Auto-set from state; verify with CER zone map"
          />
          <Input
            label="STC deeming years"
            type="number"
            min="1"
            max="10"
            value={scope.stc_years ?? ''}
            onChange={(e) => setScope({ stc_years: parseInt(e.target.value) || 10 })}
            hint="Usually 10 for current installs"
          />
        </div>
        {scope.has_bess && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input
              label="VEEC count (VIC only)"
              type="number"
              min="0"
              value={scope.veec_count ?? ''}
              onChange={(e) => setScope({ veec_count: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="VEEC price ($/certificate)"
              type="number"
              step="0.50"
              value={scope.veec_price ?? ''}
              onChange={(e) => setScope({ veec_price: parseFloat(e.target.value) || 0 })}
              prefix="$"
            />
          </div>
        )}
      </section>

      {/* Notes */}
      <section>
        <h3 className="text-sm font-medium text-slate-300 mb-3">Internal Notes</h3>
        <textarea
          value={siteDetails.internal_notes}
          onChange={(e) => setSiteDetails({ internal_notes: e.target.value })}
          rows={3}
          placeholder="Internal notes — not shown on customer PDF"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white
                     placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500
                     px-3 py-2 resize-none"
        />
      </section>
    </div>
  )
}
