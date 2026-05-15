import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Save, Zap } from 'lucide-react';
import { calculateQuote, validateQuoteInputs, formatCurrency, type QuoteInputs, type QuoteResult, type CatalogDatabase, type ItemStatus } from '../../lib/quoteEngine';
import { saveQuoteData } from '../../lib/quoteDbService';

// ============================================================================
// TYPES
// ============================================================================

interface CatalogItem {
    id: string;
    code: string;
    description: string;
    unit: string;
    rate: number;
    category: string;
    subcategory?: string;
}

interface ItemState {
    status: ItemStatus;
    quantity: number;
    adjustment: number;
}

interface CollapsibleState {
    [key: string]: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QuoteFormNew() {
    // Client Details State (matching client_info table)
    const [primaryContact, setPrimaryContact] = useState('');
    const [directPh, setDirectPh] = useState('');
    const [emailAddress, setEmailAddress] = useState('');
    const [abn, setAbn] = useState('');
    const [nmi, setNmi] = useState('');
    const [isOffGrid, setIsOffGrid] = useState(false);
    const [billingAddress, setBillingAddress] = useState('');
    const [suburb, setSuburb] = useState('');
    const [postcode, setPostcode] = useState('');
    const [state, setState] = useState('NSW');
    const [sceAgent, setSceAgent] = useState('');
    const [directPhSce, setDirectPhSce] = useState('');
    const [emailAddressSce, setEmailAddressSce] = useState('');

    // Quote specific fields
    const [projectName, setProjectName] = useState('');

    // System Configuration State
    const [systemSizeKw, setSystemSizeKw] = useState(0);
    const [existingSolarKw, setExistingSolarKw] = useState(0);
    const [installType, setInstallType] = useState('Rooftop');
    const [includeBess, setIncludeBess] = useState(false);
    const [includeEv, setIncludeEv] = useState(false);

    // Item Selection State
    const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
    const [collapsibleStates, setCollapsibleStates] = useState<CollapsibleState>({});

    // Calculation State
    const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Mock catalog data (in production, fetch from Supabase)
    const catalogItems: CatalogItem[] = useMemo(() => [
        // Preliminary
        { id: '1', code: 'PRL-001', description: 'Council Permission', unit: 'ea', rate: 4106.00, category: 'Preliminary', subcategory: 'Permissions' },
        { id: '2', code: 'GRD-001', description: 'GRD-001', unit: 'ea', rate: 50788.00, category: 'Preliminary', subcategory: 'Grid Connection' },
        { id: '3', code: 'WIT-001', description: 'WIT-001', unit: 'ea', rate: 2000.00, category: 'Preliminary', subcategory: 'Testing' },
        { id: '4', code: 'GPU-001', description: 'GPU Threshold: SAPN', unit: 'ea', rate: 0.00, category: 'Preliminary', subcategory: 'GPU Threshold' },

        // PV Components
        { id: '5', code: 'PNL-001', description: '520W Aiko Neostar 2P N-Type ABC Monofacial', unit: 'ea', rate: 111.80, category: 'PV Components', subcategory: 'Panels' },
        { id: '6', code: 'INV-001', description: 'Sungrow INV-001', unit: 'ea', rate: 6500000.00, category: 'PV Components', subcategory: 'Inverters' },
        { id: '7', code: 'OPT-001', description: 'OPT-001', unit: 'ea', rate: 62.00, category: 'PV Components', subcategory: 'Optimizers' },
        { id: '8', code: 'RCK-001', description: 'RCK-001', unit: 'ea', rate: 0.00, category: 'PV Components', subcategory: 'Racking' },
        { id: '9', code: 'ADR-001', description: 'Flush Mounted - Sunlock', unit: 'Per Panel', rate: 4.00, category: 'PV Components', subcategory: 'Additional Racking' },
        { id: '10', code: 'IST-001', description: 'IST-001', unit: 'ea', rate: 300.00, category: 'PV Components', subcategory: 'Inverter Station' },
        { id: '11', code: 'PVD-001', description: 'PVD-001', unit: 'ea', rate: 5500.00, category: 'PV Components', subcategory: 'PVDB' },
        { id: '12', code: 'PFC-001', description: 'PFC-001', unit: 'ea', rate: 5000.00, category: 'PV Components', subcategory: 'PFC' },
        { id: '13', code: 'HRM-001', description: 'HRM-001', unit: 'ea', rate: 1500.00, category: 'PV Components', subcategory: 'Harmonic Filtering' },

        // Battery Energy Storage
        { id: '14', code: 'BAT-001', description: '5 kWh - 1x iHome-B5-HD02', unit: 'ea', rate: 2000.00, category: 'Battery Energy Storage', subcategory: 'Batteries' },
        { id: '15', code: 'PCS-001', description: '5 kVA - 1x iHome-INV5KHD01H01 Single Phase', unit: 'ea', rate: 1000.00, category: 'Battery Energy Storage', subcategory: 'PCS' },
    ], []);

    // Group items by category and subcategory
    const groupedItems = useMemo(() => {
        const groups: Record<string, Record<string, CatalogItem[]>> = {};

        catalogItems.forEach(item => {
            if (!groups[item.category]) {
                groups[item.category] = {};
            }
            const subcat = item.subcategory || 'Other';
            if (!groups[item.category][subcat]) {
                groups[item.category][subcat] = [];
            }
            groups[item.category][subcat].push(item);
        });

        return groups;
    }, [catalogItems]);

    // Initialize item states
    useEffect(() => {
        const initialStates: Record<string, ItemState> = {};
        catalogItems.forEach(item => {
            initialStates[item.id] = {
                status: 'Not Required',
                quantity: 1,
                adjustment: 0,
            };
        });
        setItemStates(initialStates);
    }, [catalogItems]);

    // Toggle collapsible
    const toggleCollapsible = (key: string) => {
        setCollapsibleStates(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    // Update item state
    const updateItemState = (itemId: string, updates: Partial<ItemState>) => {
        setItemStates(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                ...updates,
            },
        }));
    };

    // Calculate quote on input changes
    useEffect(() => {
        const timer = setTimeout(() => {
            handleCalculate();
        }, 500); // Debounce

        return () => clearTimeout(timer);
    }, [
        customerName, email, phone, projectName, streetAddress, suburb, state, postcode,
        systemSizeKw, existingSolarKw, includeBess, includeEv, itemStates
    ]);

    // Handle calculation
    const handleCalculate = async () => {
        if (!customerName || !projectName || systemSizeKw <= 0) {
            return; // Skip if required fields are missing
        }

        setIsCalculating(true);
        setErrors([]);

        try {
            // Build inputs
            const inputs: QuoteInputs = {
                client: {
                    projectName,
                    contactName: customerName,
                    email,
                    phone,
                    nmi,
                    isOffGrid: false,
                    state,
                    postcode,
                    suburb,
                    billingAddress: streetAddress,
                    abn,
                },
                system: {
                    totalSystemSizeKw: systemSizeKw,
                    panelWattage: 520, // Default from catalog
                    panelQuantity: Math.ceil((systemSizeKw * 1000) / 520),
                    inverterSizeKw: systemSizeKw * 1.2,
                    inverterQuantity: 1,
                    hasBess: includeBess,
                    bessCapacityKwh: includeBess ? 5 : undefined,
                    hasEv: includeEv,
                    evChargerQuantity: includeEv ? 1 : undefined,
                    isHvCustomer: false,
                    hasExistingPv: existingSolarKw > 0,
                    existingPvSizeKw: existingSolarKw,
                },
                installation: {
                    installYear: new Date().getFullYear(),
                    installMonth: new Date().getMonth() + 1,
                    siteInspectionConfirmed: false,
                    hvCustomer: false,
                    dnsp: state === 'NSW' ? 'Ausgrid' : 'Other',
                    isPpaOrCapex: 'Capex',
                },
                pricing: {
                    proposedMarkup: 0.25,
                    targetMarkup: 0.30,
                    minimumMarkup: 0.15,
                    contingencyBudget: 0.10,
                    stcPrice: 38.50,
                },
            };

            // Validate inputs
            const validationErrors = validateQuoteInputs(inputs);
            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            // Mock catalog database
            const catalog: CatalogDatabase = {
                panels: [{
                    item_id: '1',
                    item_code: 'PNL-001',
                    category: 'Panels',
                    item_name: '520W Aiko Neostar',
                    brand: 'Aiko',
                    wattage: 520,
                    cost_per_watt: 0.215,
                    product_warranty: 25,
                    performance_warranty: 30,
                    item_type: 'Premium Commercial Module',
                }],
                inverters: [{
                    item_id: '2',
                    item_code: 'INV-001',
                    category: 'Inverters',
                    item_name: 'Sungrow SG110CX',
                    brand: 'Sungrow',
                    model: 'SG110CX',
                    watt: 110000,
                    cost_per_unit: 8800,
                    warranty_years: 10,
                }],
                batteries: [],
                racking: [{
                    item_id: '3',
                    item_code: 'RCK-001',
                    category: 'Racking',
                    item_name: 'Standard Racking',
                    racking_type: 'Roof Mount',
                    cost_per_watt: 0.05,
                    unit: 'kW',
                }],
                cabling: [{
                    item_id: '4',
                    item_code: 'CBL-001',
                    category: 'Cabling',
                    item_name: 'DC Cable 6mm²',
                    conductor_material: 'Copper',
                    size_mm2: 6,
                    single_core_price_per_meter: 3.50,
                    inclusion: 'Included',
                }],
                install: [{
                    item_id: '5',
                    item_code: 'INS-001',
                    category: 'Installation',
                    item_name: 'Standard Installation',
                    install_item: 'Labor',
                    item_type: 'Installation',
                    price: 150,
                    unit: 'per kW',
                }],
                prelim: [{
                    item_id: '6',
                    item_code: 'PRL-001',
                    category: 'Preliminaries',
                    item_name: 'Grid Connection',
                    item_type: 'Application',
                    price_total: 2000,
                }],
                gridConnection: [{
                    item_id: '7',
                    item_code: 'GRD-001',
                    category: 'Grid Connection',
                    item_name: 'Ausgrid Application',
                    state: 'NSW',
                    dnsp: 'Ausgrid',
                    is_bess_only: false,
                    is_solar_or_solar_bess: true,
                    low_size_kva: 0,
                    high_side_kva: 200,
                    preliminary_enquiry: 500,
                    app_fee_tech_assessment: 1500,
                    total_network_fee: 2000,
                }],
            };

            // Calculate
            const result = calculateQuote(inputs, catalog);
            setQuoteResult(result);
        } catch (error) {
            console.error('Calculation error:', error);
            setErrors(['Failed to calculate quote']);
        } finally {
            setIsCalculating(false);
        }
    };

    // Handle save
    const handleSave = async () => {
        if (!quoteResult) {
            setErrors(['Please calculate the quote first']);
            return;
        }

        setIsSaving(true);
        setErrors([]);

        try {
            const inputs: QuoteInputs = {
                client: {
                    projectName,
                    contactName: customerName,
                    email,
                    phone,
                    nmi,
                    isOffGrid: false,
                    state,
                    postcode,
                    suburb,
                    billingAddress: streetAddress,
                    abn,
                },
                system: {
                    totalSystemSizeKw: systemSizeKw,
                    panelWattage: 520,
                    panelQuantity: Math.ceil((systemSizeKw * 1000) / 520),
                    inverterSizeKw: systemSizeKw * 1.2,
                    inverterQuantity: 1,
                    hasBess: includeBess,
                    bessCapacityKwh: includeBess ? 5 : undefined,
                    hasEv: includeEv,
                    evChargerQuantity: includeEv ? 1 : undefined,
                    isHvCustomer: false,
                    hasExistingPv: existingSolarKw > 0,
                    existingPvSizeKw: existingSolarKw,
                },
                installation: {
                    installYear: new Date().getFullYear(),
                    installMonth: new Date().getMonth() + 1,
                    siteInspectionConfirmed: false,
                    hvCustomer: false,
                    dnsp: state === 'NSW' ? 'Ausgrid' : 'Other',
                    isPpaOrCapex: 'Capex',
                },
                pricing: {
                    proposedMarkup: 0.25,
                    targetMarkup: 0.30,
                    minimumMarkup: 0.15,
                    contingencyBudget: 0.10,
                    stcPrice: 38.50,
                },
            };

            const saveResult = await saveQuoteData(inputs, quoteResult, 'FY2026.V1');

            if (saveResult.success) {
                alert(`Quote saved successfully! Quote ID: ${saveResult.quoteId}`);
            } else {
                setErrors([saveResult.error || 'Failed to save quote']);
            }
        } catch (error) {
            console.error('Save error:', error);
            setErrors(['Failed to save quote']);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#0a0e1a] text-gray-100">
            {/* Left Panel - Form */}
            <div className="w-[450px] border-r border-gray-800 overflow-y-auto">
                <div className="p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">SITE & SYSTEM</h2>
                        <button className="text-green-400 hover:text-green-300">
                            <Zap className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Customer Information */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span>Customer Information</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Customer name</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Company (optional)</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">ABN (optional)</label>
                                <input
                                    type="text"
                                    value={abn}
                                    onChange={(e) => setAbn(e.target.value)}
                                    placeholder="XX XXX XXX XXX"
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Project name</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Site Details */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span>Site Details</span>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Street address</label>
                            <input
                                type="text"
                                value={streetAddress}
                                onChange={(e) => setStreetAddress(e.target.value)}
                                className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Suburb</label>
                                <input
                                    type="text"
                                    value={suburb}
                                    onChange={(e) => setSuburb(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">State</label>
                                <select
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                >
                                    <option value="NSW">NSW</option>
                                    <option value="VIC">VIC</option>
                                    <option value="QLD">QLD</option>
                                    <option value="SA">SA</option>
                                    <option value="WA">WA</option>
                                    <option value="TAS">TAS</option>
                                    <option value="NT">NT</option>
                                    <option value="ACT">ACT</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Postcode</label>
                                <input
                                    type="text"
                                    value={postcode}
                                    onChange={(e) => setPostcode(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">NMI</label>
                                <input
                                    type="text"
                                    value={nmi}
                                    onChange={(e) => setNmi(e.target.value)}
                                    placeholder="e.g. 6123456789"
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                                <p className="text-xs text-gray-500 mt-1">Auto-detects DNSP from NMI prefix</p>
                            </div>
                        </div>
                    </section>

                    {/* System Configuration */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span>System Configuration</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">System size (kWp)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={systemSizeKw}
                                        onChange={(e) => setSystemSizeKw(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 pr-12 text-sm focus:outline-none focus:border-green-400"
                                    />
                                    <span className="absolute right-3 top-2 text-xs text-gray-500">kWp</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Existing solar on site (kWp)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={existingSolarKw}
                                        onChange={(e) => setExistingSolarKw(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 pr-12 text-sm focus:outline-none focus:border-green-400"
                                    />
                                    <span className="absolute right-3 top-2 text-xs text-gray-500">kWp</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Install type</label>
                            <select
                                value={installType}
                                onChange={(e) => setInstallType(e.target.value)}
                                className="w-full bg-[#1a1f2e] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                            >
                                <option value="Rooftop">Rooftop</option>
                                <option value="Ground Mount">Ground Mount</option>
                                <option value="Carport">Carport</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={includeBess}
                                    onChange={(e) => setIncludeBess(e.target.checked)}
                                    className="w-4 h-4 bg-[#1a1f2e] border border-gray-700 rounded"
                                />
                                <span>Include BESS</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={includeEv}
                                    onChange={(e) => setIncludeEv(e.target.checked)}
                                    className="w-4 h-4 bg-[#1a1f2e] border border-gray-700 rounded"
                                />
                                <span>Include EV Charging</span>
                            </label>
                        </div>
                    </section>

                    {/* Error Display */}
                    {errors.length > 0 && (
                        <div className="bg-red-900/20 border border-red-500 rounded p-3">
                            <p className="text-sm text-red-400 font-medium mb-1">Errors:</p>
                            <ul className="text-xs text-red-300 space-y-1">
                                {errors.map((error, i) => (
                                    <li key={i}>• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Middle Panel - Item Selection */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                    {/* Category Sections */}
                    {Object.entries(groupedItems).map(([category, subcategories]) => (
                        <div key={category} className="mb-4">
                            {/* Category Header */}
                            <button
                                onClick={() => toggleCollapsible(category)}
                                className="w-full flex items-center justify-between bg-[#1a1f2e] hover:bg-[#1f2535] px-4 py-3 rounded-lg transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {collapsibleStates[category] ? (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                    <span className="font-medium">{category}</span>
                                </div>
                                <span className="text-sm text-gray-400">
                                    {formatCurrency(
                                        Object.values(subcategories)
                                            .flat()
                                            .filter(item => itemStates[item.id]?.status === 'Included')
                                            .reduce((sum, item) => sum + item.rate * (itemStates[item.id]?.quantity || 1), 0)
                                    )}
                                </span>
                            </button>

                            {/* Subcategories */}
                            {collapsibleStates[category] && (
                                <div className="mt-2 space-y-2">
                                    {Object.entries(subcategories).map(([subcategory, items]) => (
                                        <div key={subcategory} className="ml-4">
                                            {/* Subcategory Header */}
                                            <button
                                                onClick={() => toggleCollapsible(`${category}-${subcategory}`)}
                                                className="w-full flex items-center justify-between bg-[#0f1419] hover:bg-[#141920] px-4 py-2 rounded transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {collapsibleStates[`${category}-${subcategory}`] ? (
                                                        <ChevronDown className="w-3 h-3 text-gray-500" />
                                                    ) : (
                                                        <ChevronRight className="w-3 h-3 text-gray-500" />
                                                    )}
                                                    <span className="text-sm text-gray-300">{subcategory}</span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {formatCurrency(
                                                        items
                                                            .filter(item => itemStates[item.id]?.status === 'Included')
                                                            .reduce((sum, item) => sum + item.rate * (itemStates[item.id]?.quantity || 1), 0)
                                                    )}
                                                </span>
                                            </button>

                                            {/* Items */}
                                            {collapsibleStates[`${category}-${subcategory}`] && (
                                                <div className="mt-1 space-y-1">
                                                    {items.map(item => (
                                                        <div
                                                            key={item.id}
                                                            className="flex items-center gap-3 bg-[#0a0e1a] px-4 py-2 rounded text-xs"
                                                        >
                                                            {/* Status Dropdown */}
                                                            <select
                                                                value={itemStates[item.id]?.status || 'Not Required'}
                                                                onChange={(e) =>
                                                                    updateItemState(item.id, {
                                                                        status: e.target.value as ItemStatus,
                                                                    })
                                                                }
                                                                className={`px-2 py-1 rounded text-xs font-medium ${itemStates[item.id]?.status === 'Included'
                                                                    ? 'bg-green-900/30 text-green-400 border border-green-700'
                                                                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                                                                    }`}
                                                            >
                                                                <option value="Included">Included</option>
                                                                <option value="Not Required">Not Required</option>
                                                            </select>

                                                            {/* Code */}
                                                            <span className="text-gray-500 w-20">{item.code}</span>

                                                            {/* Description */}
                                                            <span className="flex-1 text-gray-300">{item.description}</span>

                                                            {/* Unit */}
                                                            <span className="text-gray-500 w-16">{item.unit}</span>

                                                            {/* Quantity */}
                                                            <input
                                                                type="number"
                                                                value={itemStates[item.id]?.quantity || 1}
                                                                onChange={(e) =>
                                                                    updateItemState(item.id, {
                                                                        quantity: parseInt(e.target.value) || 1,
                                                                    })
                                                                }
                                                                disabled={itemStates[item.id]?.status !== 'Included'}
                                                                className="w-16 bg-[#1a1f2e] border border-gray-700 rounded px-2 py-1 text-center disabled:opacity-50"
                                                            />

                                                            {/* Rate */}
                                                            <span className="text-gray-400 w-24 text-right">
                                                                {formatCurrency(item.rate)}
                                                            </span>

                                                            {/* Adjustment */}
                                                            <input
                                                                type="number"
                                                                value={itemStates[item.id]?.adjustment || 0}
                                                                onChange={(e) =>
                                                                    updateItemState(item.id, {
                                                                        adjustment: parseFloat(e.target.value) || 0,
                                                                    })
                                                                }
                                                                disabled={itemStates[item.id]?.status !== 'Included'}
                                                                className="w-16 bg-[#1a1f2e] border border-gray-700 rounded px-2 py-1 text-center disabled:opacity-50"
                                                                placeholder="Adj."
                                                            />

                                                            {/* Total */}
                                                            <span className="text-gray-200 w-24 text-right font-medium">
                                                                {itemStates[item.id]?.status === 'Included'
                                                                    ? formatCurrency(
                                                                        item.rate * (itemStates[item.id]?.quantity || 1) +
                                                                        (itemStates[item.id]?.adjustment || 0)
                                                                    )
                                                                    : '-'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel - Quote Summary */}
            <div className="w-[350px] border-l border-gray-800 overflow-y-auto">
                <div className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold">Quote Summary</h3>

                    {isCalculating && (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                            <span>Calculating...</span>
                        </div>
                    )}

                    {quoteResult && (
                        <div className="space-y-4">
                            {/* Subtotals */}
                            <div className="space-y-2">
                                <p className="text-xs text-gray-400 font-medium">SUBTOTALS</p>
                                {quoteResult.subtotals.map((subtotal, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-300">{subtotal.category}</span>
                                        <span className="text-gray-200">{formatCurrency(subtotal.totalSale)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-700 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Subtotal</span>
                                    <span className="text-gray-200 font-medium">
                                        {formatCurrency(quoteResult.totalSystemValueExGst)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">(ex GST)</span>
                                    <span className="text-gray-200">
                                        ${quoteResult.totalSystemValueExGst.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="border-t border-gray-700 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Net (ex GST)</span>
                                    <span className="text-gray-200">
                                        ${quoteResult.netSystemValueExGst.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">GST (10%)</span>
                                    <span className="text-gray-200">
                                        {formatCurrency(quoteResult.gst)}
                                    </span>
                                </div>
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-lg font-semibold">Total</span>
                                    <span className="text-lg font-bold text-green-400">
                                        ${quoteResult.totalSystemValueIncGst.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 text-right mt-1">(inc GST)</p>
                            </div>

                            {/* Metrics */}
                            <div className="border-t border-gray-700 pt-4 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Cost per Watt</span>
                                    <span className="text-gray-300">${quoteResult.costPerWatt.toFixed(2)}/W</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Sale per Watt</span>
                                    <span className="text-gray-300">${quoteResult.salePricePerWatt.toFixed(2)}/W</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Markup</span>
                                    <span className="text-gray-300">{(quoteResult.markup * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Gross Profit</span>
                                    <span className="text-gray-300">{quoteResult.grossProfitPercent.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* Rebates */}
                            {quoteResult.rebates.totalUpfrontRebateExGst > 0 && (
                                <div className="border-t border-gray-700 pt-4 space-y-2 text-xs">
                                    <p className="text-gray-400 font-medium">REBATES</p>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">STC Discount</span>
                                        <span className="text-green-400">
                                            -{formatCurrency(quoteResult.rebates.stcDiscountExGst)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Total Rebate</span>
                                        <span className="text-green-400 font-medium">
                                            -{formatCurrency(quoteResult.rebates.totalUpfrontRebateExGst)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-4">
                        <button
                            onClick={handleSave}
                            disabled={!quoteResult || isSaving}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-medium transition-colors"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Generate Quote</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleCalculate}
                            disabled={isCalculating}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-medium transition-colors"
                        >
                            <Zap className="w-4 h-4" />
                            <span>Recalculate</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}