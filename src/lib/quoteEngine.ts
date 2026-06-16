// ============================================================================
// Quote Engine - Pure TypeScript Calculation Utility
// ============================================================================

// ============================================================================
// STRICT TYPE DEFINITIONS
// ============================================================================

export type ItemStatus = 'Included' | 'Not Required';

// Client Input Types
export interface ClientInfo {
    projectName: string;
    contactName: string;
    email: string;
    phone?: string;
    nmi?: string;
    isOffGrid: boolean;
    state: string;
    postcode: string;
    suburb?: string;
    billingAddress?: string;
    abn?: string;
}

export interface SystemConfiguration {
    totalSystemSizeKw: number;
    panelWattage: number;
    panelQuantity: number;
    inverterSizeKw: number;
    inverterQuantity: number;
    hasBess: boolean;
    bessCapacityKwh?: number;
    hasEv: boolean;
    evChargerQuantity?: number;
    isHvCustomer: boolean;
    hasExistingPv: boolean;
    existingPvSizeKw?: number;
}

export interface InstallationDetails {
    installYear: number;
    installMonth: number;
    siteInspectionConfirmed: boolean;
    hvCustomer: boolean;
    dnsp: string;
    isPpaOrCapex: 'PPA' | 'Capex';
}

export interface PricingInputs {
    proposedMarkup: number;
    targetMarkup: number;
    minimumMarkup: number;
    contingencyBudget: number;
    stcPrice: number;
    veecTraderFee?: number;
}

export interface QuoteInputs {
    client: ClientInfo;
    system: SystemConfiguration;
    installation: InstallationDetails;
    pricing: PricingInputs;
}

// Catalog Item Types (from Supabase)
export interface CatalogItem {
    item_id: string;
    item_code: string;
    category: string;
    subcategory?: string;
    item_name: string;
    item_type?: string;
    status?: ItemStatus;
}

export interface PanelSpec extends CatalogItem {
    brand: string;
    wattage: number;
    cost_per_watt: number;
    product_warranty: number;
    performance_warranty: number;
    item_type: string;
    is_local_stock?: boolean;
}

export interface InverterSpec extends CatalogItem {
    brand: string;
    model: string;
    watt: number;
    cost_per_unit: number;
    warranty_years: number;
}

export interface BatterySpec extends CatalogItem {
    brand: string;
    item_name: string;
    nominal_kwh: number;
    battery_price_fob: number;
    is_pcs_included: boolean;
    cost_per_kwh_inc_pcs: number;
    product_warranty: number;
    performance_warranty: number;
}

export interface RackingSpec extends CatalogItem {
    racking_type: string;
    cost_per_watt?: number;
    cost_per_item?: number;
    unit: string;
}

export interface CablingSpec extends CatalogItem {
    conductor_material: string;
    size_mm2: number;
    single_core_price_per_meter: number;
    inclusion?: ItemStatus;
}

export interface InstallSpec extends CatalogItem {
    install_item: string;
    item_type: string;
    price: number;
    unit: string;
}

export interface PrelimSpec extends CatalogItem {
    item_type: string;
    item_name: string;
    price_total: number;
}

export interface GridConnectionSpec extends CatalogItem {
    state: string;
    dnsp: string;
    is_bess_only: boolean;
    is_solar_or_solar_bess: boolean;
    low_size_kva: number;
    high_side_kva: number;
    preliminary_enquiry: number;
    app_fee_tech_assessment: number;
    total_network_fee: number;
}

export interface CatalogDatabase {
    panels: PanelSpec[];
    inverters: InverterSpec[];
    batteries: BatterySpec[];
    racking: RackingSpec[];
    cabling: CablingSpec[];
    install: InstallSpec[];
    prelim: PrelimSpec[];
    gridConnection: GridConnectionSpec[];
}

// ============================================================================
// CALCULATION OUTPUT TYPES
// ============================================================================

export interface LineItem {
    category: string;
    item: string;
    type: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    costPerWatt: number;
    salesRate: number;
    salePerWatt: number;
    status: ItemStatus;
    catalog_id?: string | null;
    item_code?: string | null;
    unit?: string | null;
}

export interface CategorySubtotal {
    category: string;
    totalCost: number;
    totalSale: number;
    costPerWatt: number;
    salePerWatt: number;
    items: LineItem[];
}

export interface RebateCalculation {
    claimedStcCapacityKwp: number;
    deemingPeriodYears: number;
    stcQuantity: number;
    stcDiscountExGst: number;
    veecTraderFeeExGst: number;
    upfrontVeecDiscountExGst: number;
    totalUpfrontRebateExGst: number;
}

export interface QuoteResult {
    quoteNumber: string;
    projectName: string;
    systemSizeKw: number;

    // Cost breakdown
    subtotals: CategorySubtotal[];

    // Financial summary
    totalInstallCost: number;
    costPerWatt: number;
    markup: number;
    salePrice: number;
    salePricePerWatt: number;
    profitMargin: number;
    grossProfitPercent: number;

    // Rebates
    rebates: RebateCalculation;

    // Final pricing
    totalSystemValueExGst: number;
    gst: number;
    totalSystemValueIncGst: number;
    netSystemValueExGst: number;
    netSystemValueIncGst: number;

    // Metadata
    calculatedAt: Date;
    internalNotes?: string;
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate STC (Small-scale Technology Certificate) rebate
 * Based on Excel formulas from SOLAR sheet and Rebates sheet
 */
function calculateStcRebate(
    systemSizeKw: number,
    installYear: number,
    _installMonth: number,
    state: string,
    stcPrice: number,
    existingSolarKw: number = 0
): RebateCalculation {
    // Deeming period: 2031 - install year (Excel: L18 = 2031-F20)
    const deemingPeriodYears = Math.max(0, 2031 - installYear);

    // Zone rating factors from Excel Rebates sheet
    const zoneRatings: Record<string, number> = {
        'NSW': 1.382,
        'ACT': 1.382,
        'QLD': 1.536,
        'VIC': 1.382,
        'SA': 1.536,
        'WA': 1.536,
        'TAS': 1.185,
        'NT': 1.536,
    };

    const zoneRating = zoneRatings[state] || 1.382;

    // Claimed STC capacity (Excel L17):
    // =IF(F13>100,IF(F19="Yes",MIN(100,100-F22),0),MIN(100-F22,F13))
    let claimedCapacity: number;
    if (systemSizeKw > 100) {
        claimedCapacity = Math.min(100, 100 - existingSolarKw);
    } else {
        claimedCapacity = Math.min(100 - existingSolarKw, systemSizeKw);
    }
    claimedCapacity = Math.max(0, claimedCapacity);

    // STC calculation: Claimed Capacity × Zone Rating × Deeming Period
    const stcQuantity = claimedCapacity * zoneRating * deemingPeriodYears;
    const stcDiscountExGst = stcQuantity * stcPrice;

    return {
        claimedStcCapacityKwp: claimedCapacity,
        deemingPeriodYears,
        stcQuantity: Math.round(stcQuantity),
        stcDiscountExGst,
        veecTraderFeeExGst: 0,
        upfrontVeecDiscountExGst: 0,
        totalUpfrontRebateExGst: stcDiscountExGst,
    };
}

/**
 * Calculate component costs
 */
function calculateComponentCosts(
    inputs: QuoteInputs,
    catalog: CatalogDatabase
): CategorySubtotal[] {
    const subtotals: CategorySubtotal[] = [];
    const systemSizeW = inputs.system.totalSystemSizeKw * 1000;

    // 1. Preliminaries
    const prelimItems: LineItem[] = [];

    // Grid connection application
    const gridConn = catalog.gridConnection.find(
        gc => gc.state === inputs.installation.dnsp &&
            gc.is_solar_or_solar_bess === !inputs.system.hasBess
    );

    if (gridConn) {
        prelimItems.push({
            category: 'Preliminaries',
            item: 'Grid Connection Application',
            type: 'Application Fee',
            quantity: 1,
            unitCost: gridConn.total_network_fee,
            totalCost: gridConn.total_network_fee,
            costPerWatt: gridConn.total_network_fee / systemSizeW,
            salesRate: gridConn.total_network_fee * (1 + inputs.pricing.proposedMarkup),
            salePerWatt: (gridConn.total_network_fee * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
            status: 'Included',
        });
    }

    // Other prelim items
    catalog.prelim.forEach(prelim => {
        prelimItems.push({
            category: 'Preliminaries',
            item: prelim.item_name,
            type: prelim.item_type,
            quantity: 1,
            unitCost: prelim.price_total,
            totalCost: prelim.price_total,
            costPerWatt: prelim.price_total / systemSizeW,
            salesRate: prelim.price_total * (1 + inputs.pricing.proposedMarkup),
            salePerWatt: (prelim.price_total * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
            status: 'Included',
        });
    });

    const prelimTotal = prelimItems.reduce((sum, item) => sum + item.totalCost, 0);
    subtotals.push({
        category: 'Preliminaries',
        totalCost: prelimTotal,
        totalSale: prelimTotal * (1 + inputs.pricing.proposedMarkup),
        costPerWatt: prelimTotal / systemSizeW,
        salePerWatt: (prelimTotal * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
        items: prelimItems,
    });

    // 2. PV Components
    const componentItems: LineItem[] = [];

    // Panels
    const panel = catalog.panels[0]; // Use first panel from catalog
    if (panel) {
        const panelCost = inputs.system.panelQuantity * panel.wattage * panel.cost_per_watt;
        componentItems.push({
            category: 'Components',
            item: `${panel.brand} ${panel.wattage}W Panel`,
            type: panel.item_type,
            quantity: inputs.system.panelQuantity,
            unitCost: panel.wattage * panel.cost_per_watt,
            totalCost: panelCost,
            costPerWatt: panelCost / systemSizeW,
            salesRate: panelCost * (1 + inputs.pricing.proposedMarkup),
            salePerWatt: (panelCost * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
            status: 'Included',
        });
    }

    // Inverters
    const inverter = catalog.inverters[0]; // Use first inverter from catalog
    if (inverter) {
        const inverterCost = inputs.system.inverterQuantity * inverter.cost_per_unit;
        componentItems.push({
            category: 'Components',
            item: `${inverter.brand} ${inverter.model}`,
            type: 'Inverter',
            quantity: inputs.system.inverterQuantity,
            unitCost: inverter.cost_per_unit,
            totalCost: inverterCost,
            costPerWatt: inverterCost / systemSizeW,
            salesRate: inverterCost * (1 + inputs.pricing.proposedMarkup),
            salePerWatt: (inverterCost * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
            status: 'Included',
        });
    }

    // Racking
    const racking = catalog.racking[0];
    if (racking && racking.cost_per_watt) {
        const rackingCost = systemSizeW * racking.cost_per_watt;
        componentItems.push({
            category: 'Components',
            item: racking.racking_type,
            type: 'Racking',
            quantity: 1,
            unitCost: rackingCost,
            totalCost: rackingCost,
            costPerWatt: racking.cost_per_watt,
            salesRate: rackingCost * (1 + inputs.pricing.proposedMarkup),
            salePerWatt: racking.cost_per_watt * (1 + inputs.pricing.proposedMarkup),
            status: 'Included',
        });
    }

    const componentTotal = componentItems.reduce((sum, item) => sum + item.totalCost, 0);
    subtotals.push({
        category: 'Components',
        totalCost: componentTotal,
        totalSale: componentTotal * (1 + inputs.pricing.proposedMarkup),
        costPerWatt: componentTotal / systemSizeW,
        salePerWatt: (componentTotal * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
        items: componentItems,
    });

    // 3. Cabling
    const cablingItems: LineItem[] = [];
    const estimatedCableLength = Math.sqrt(systemSizeW / 1000) * 50; // Simplified estimation

    catalog.cabling.forEach(cable => {
        if (cable.inclusion === 'Included') {
            const cableCost = estimatedCableLength * cable.single_core_price_per_meter;
            cablingItems.push({
                category: 'Cabling',
                item: `${cable.conductor_material} ${cable.size_mm2}mm²`,
                type: 'Cable',
                quantity: estimatedCableLength,
                unitCost: cable.single_core_price_per_meter,
                totalCost: cableCost,
                costPerWatt: cableCost / systemSizeW,
                salesRate: cableCost * (1 + inputs.pricing.proposedMarkup),
                salePerWatt: (cableCost * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
                status: 'Included',
            });
        }
    });

    const cablingTotal = cablingItems.reduce((sum, item) => sum + item.totalCost, 0);
    if (cablingTotal > 0) {
        subtotals.push({
            category: 'Cabling',
            totalCost: cablingTotal,
            totalSale: cablingTotal * (1 + inputs.pricing.proposedMarkup),
            costPerWatt: cablingTotal / systemSizeW,
            salePerWatt: (cablingTotal * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
            items: cablingItems,
        });
    }

    // 4. Installation
    const installItems: LineItem[] = [];

    catalog.install.forEach(install => {
        let quantity = 1;
        if (install.unit === 'per kW') {
            quantity = inputs.system.totalSystemSizeKw;
        } else if (install.unit === 'per panel') {
            quantity = inputs.system.panelQuantity;
        }

        const installCost = quantity * install.price;
        installItems.push({
            category: 'Installation',
            item: install.install_item,
            type: install.item_type,
            quantity,
            unitCost: install.price,
            totalCost: installCost,
            costPerWatt: installCost / systemSizeW,
            salesRate: installCost * (1 + inputs.pricing.proposedMarkup),
            salePerWatt: (installCost * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
            status: 'Included',
        });
    });

    const installTotal = installItems.reduce((sum, item) => sum + item.totalCost, 0);
    if (installTotal > 0) {
        subtotals.push({
            category: 'Installation',
            totalCost: installTotal,
            totalSale: installTotal * (1 + inputs.pricing.proposedMarkup),
            costPerWatt: installTotal / systemSizeW,
            salePerWatt: (installTotal * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
            items: installItems,
        });
    }

    // 5. Battery (if applicable)
    if (inputs.system.hasBess && inputs.system.bessCapacityKwh) {
        const batteryItems: LineItem[] = [];
        const battery = catalog.batteries[0];

        if (battery) {
            const batteryQuantity = Math.ceil(inputs.system.bessCapacityKwh / battery.nominal_kwh);
            const batteryCost = batteryQuantity * battery.battery_price_fob;

            batteryItems.push({
                category: 'Battery',
                item: `${battery.brand} ${battery.item_name}`,
                type: 'Battery Storage',
                quantity: batteryQuantity,
                unitCost: battery.battery_price_fob,
                totalCost: batteryCost,
                costPerWatt: batteryCost / systemSizeW,
                salesRate: batteryCost * (1 + inputs.pricing.proposedMarkup),
                salePerWatt: (batteryCost * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
                status: 'Included',
            });

            const batteryTotal = batteryItems.reduce((sum, item) => sum + item.totalCost, 0);
            subtotals.push({
                category: 'Battery',
                totalCost: batteryTotal,
                totalSale: batteryTotal * (1 + inputs.pricing.proposedMarkup),
                costPerWatt: batteryTotal / systemSizeW,
                salePerWatt: (batteryTotal * (1 + inputs.pricing.proposedMarkup)) / systemSizeW,
                items: batteryItems,
            });
        }
    }

    return subtotals;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate complete quote with all formulas and pricing
 */
export function calculateQuote(
    inputs: QuoteInputs,
    catalog: CatalogDatabase
): QuoteResult {
    // Calculate component costs
    const subtotals = calculateComponentCosts(inputs, catalog);

    // Calculate totals
    const totalInstallCost = subtotals.reduce((sum, cat) => sum + cat.totalCost, 0);
    const systemSizeW = inputs.system.totalSystemSizeKw * 1000;
    const costPerWatt = totalInstallCost / systemSizeW;

    // Apply markup
    const markup = inputs.pricing.proposedMarkup;
    const salePrice = totalInstallCost * (1 + markup);
    const salePricePerWatt = salePrice / systemSizeW;

    // Calculate profit metrics
    const profitMargin = salePrice - totalInstallCost;
    const grossProfitPercent = (profitMargin / salePrice) * 100;

    // Calculate rebates with existing solar consideration
    const rebates = calculateStcRebate(
        inputs.system.totalSystemSizeKw,
        inputs.installation.installYear,
        inputs.installation.installMonth,
        inputs.client.state,
        inputs.pricing.stcPrice,
        inputs.system.existingPvSizeKw || 0
    );

    // Calculate final pricing
    const totalSystemValueExGst = salePrice;
    const gst = totalSystemValueExGst * 0.1;
    const totalSystemValueIncGst = totalSystemValueExGst + gst;

    const netSystemValueExGst = totalSystemValueExGst - rebates.totalUpfrontRebateExGst;
    const netSystemValueIncGst = netSystemValueExGst * 1.1;

    return {
        quoteNumber: `Q-${Date.now()}`,
        projectName: inputs.client.projectName,
        systemSizeKw: inputs.system.totalSystemSizeKw,

        subtotals,

        totalInstallCost,
        costPerWatt,
        markup,
        salePrice,
        salePricePerWatt,
        profitMargin,
        grossProfitPercent,

        rebates,

        totalSystemValueExGst,
        gst,
        totalSystemValueIncGst,
        netSystemValueExGst,
        netSystemValueIncGst,

        calculatedAt: new Date(),
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate quote inputs
 */
export function validateQuoteInputs(inputs: QuoteInputs): string[] {
    const errors: string[] = [];

    if (!inputs.client.projectName) {
        errors.push('Project name is required');
    }

    if (inputs.system.totalSystemSizeKw <= 0) {
        errors.push('System size must be greater than 0');
    }

    if (inputs.system.panelQuantity <= 0) {
        errors.push('Panel quantity must be greater than 0');
    }

    if (inputs.pricing.proposedMarkup < inputs.pricing.minimumMarkup) {
        errors.push('Proposed markup is below minimum markup');
    }

    if (inputs.pricing.proposedMarkup > inputs.pricing.targetMarkup) {
        errors.push('Proposed markup exceeds target markup');
    }

    return errors;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}
