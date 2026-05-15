// ============================================================================
// Quote Database Service - Supabase Transaction Layer
// ============================================================================

import { supabase, getCurrentUserId } from './supabase';
import type { QuoteInputs, QuoteResult, LineItem } from './quoteEngine';

// ============================================================================
// DATABASE TYPES (matching Supabase schema)
// ============================================================================

interface DbClientInfo {
    id?: string;
    abn?: string;
    primary_contact: string;
    direct_ph?: string;
    email_address: string;
    nmi?: string;
    is_off_grid: boolean;
    billing_address?: string;
    suburb?: string;
    postcode: string;
    state: string;
    sce_agent?: string;
    direct_ph_sce?: string;
    email_address_sce?: string;
}

interface DbQuote {
    id?: string;
    quote_number: string;
    project_name: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    price_version_id: string;
    client_info_id: string;
    site_address: string;
    site_suburb: string;
    site_state: string;
    site_postcode: string;
    nmi?: string;
    dnsp?: string;
    system_kw: number;
    system_kva?: number;
    has_bess: boolean;
    has_ev: boolean;
    existing_solar_kw: number;
    valid_until?: string;
    internal_notes?: string;
    created_by: string;
    assigned_to?: string;
}

interface DbQuoteItem {
    id?: string;
    quote_id: string;
    catalog_id?: string;
    quote_number: string;
    category: string;
    subcategory?: string;
    item_code?: string;
    item_name: string;
    item_type?: string;
    qty: number;
    unit?: string;
    cost_per_watt: number;
    sale_cost_per_watt: number;
    quoted_cost: number;
    quoted_markup: number;
    quoted_sales_cost: number;
    total_line_amount: number;
    version_used?: string;
}

interface DbQuoteSnapshot {
    id?: string;
    quote_id: string;
    version_number: number;
    snapshot: any; // jsonb
    change_note?: string;
    created_by: string;
}

interface DbQuoteCalc {
    id?: string;
    quote_id: string;
    calc_sheet: any; // jsonb
}

interface DbRebateCalc {
    id?: string;
    quote_id: string;
    calc_sheet: any; // jsonb
}

interface DbAcCalc {
    id?: string;
    quote_id: string;
    calc_sheet: any; // jsonb
}

interface DbBessCalc {
    id?: string;
    quote_id: string;
    calc_sheet: any; // jsonb
}

interface DbEvCalc {
    id?: string;
    quote_id: string;
    calc_sheet: any; // jsonb
}

interface DbSwitchGearCalc {
    id?: string;
    quote_id: string;
    calc_sheet: any; // jsonb
}

interface DbServiceModelCalc {
    id?: string;
    quote_id: string;
    calc_sheet: any; // jsonb
}

interface DbAgreementResult {
    id?: string;
    quote_id: string;
    agreement_sheet: any; // jsonb
    total_quote_price: number;
    is_pv_only?: boolean;
    is_pv_and_bess?: boolean;
    is_ev_included?: boolean;
    is_bess_only?: boolean;
}

// ============================================================================
// SERVICE RESPONSE TYPES
// ============================================================================

export interface SaveQuoteResult {
    success: boolean;
    quoteId?: string;
    clientInfoId?: string;
    error?: string;
    details?: any;
}

// ============================================================================
// MAIN SERVICE FUNCTION
// ============================================================================

/**
 * Save complete quote data to Supabase
 * Handles client info, quote record, line items, and snapshots
 */
export async function saveQuoteData(
    inputs: QuoteInputs,
    result: QuoteResult,
    priceVersionId: string
): Promise<SaveQuoteResult> {
    try {
        // Get current user
        const userId = await getCurrentUserId();
        if (!userId) {
            return {
                success: false,
                error: 'User not authenticated',
            };
        }

        // Start transaction-like operations
        // Note: Supabase doesn't support true transactions in JS client,
        // so we'll do sequential inserts with rollback on error

        // 1. Insert or update client info
        const clientResult = await saveClientInfo(inputs.client);
        if (!clientResult.success || !clientResult.clientInfoId) {
            return {
                success: false,
                error: 'Failed to save client info',
                details: clientResult.error,
            };
        }

        // 2. Insert quote record
        const quoteResult = await saveQuote(
            inputs,
            result,
            priceVersionId,
            clientResult.clientInfoId,
            userId
        );
        if (!quoteResult.success || !quoteResult.quoteId) {
            return {
                success: false,
                error: 'Failed to save quote',
                details: quoteResult.error,
            };
        }

        const quoteId = quoteResult.quoteId;

        // 3. Insert quote items (line items with static prices)
        const itemsResult = await saveQuoteItems(
            quoteId,
            result.quoteNumber,
            result.subtotals,
            result.markup,
            priceVersionId
        );
        if (!itemsResult.success) {
            // Attempt rollback
            await rollbackQuote(quoteId);
            return {
                success: false,
                error: 'Failed to save quote items',
                details: itemsResult.error,
            };
        }

        // 4. Save all calculation snapshots to respective tables
        await saveAllCalculations(quoteId, inputs, result);

        // 5. Create initial snapshot for version history
        const snapshotResult = await createQuoteSnapshot(
            quoteId,
            1,
            result,
            'Initial quote creation',
            userId
        );
        if (!snapshotResult.success) {
            console.error('Failed to create quote snapshot:', snapshotResult.error);
        }

        return {
            success: true,
            quoteId,
            clientInfoId: clientResult.clientInfoId,
        };
    } catch (error) {
        console.error('Error saving quote data:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error,
        };
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Save client information
 */
async function saveClientInfo(
    client: QuoteInputs['client']
): Promise<{ success: boolean; clientInfoId?: string; error?: any }> {
    try {
        const clientData: DbClientInfo = {
            primary_contact: client.contactName,
            email_address: client.email,
            direct_ph: client.phone,
            nmi: client.nmi,
            is_off_grid: client.isOffGrid,
            billing_address: client.billingAddress,
            suburb: client.suburb,
            postcode: client.postcode,
            state: client.state,
            abn: client.abn,
        };

        // Check if client exists by email
        const { data: existingClient } = await supabase
            .from('client_info')
            .select('id')
            .eq('email_address', client.email)
            .single();

        if (existingClient) {
            // Update existing client
            const { error } = await supabase
                .from('client_info')
                .update(clientData)
                .eq('id', existingClient.id);

            if (error) throw error;

            return {
                success: true,
                clientInfoId: existingClient.id,
            };
        } else {
            // Insert new client
            const { data, error } = await supabase
                .from('client_info')
                .insert(clientData)
                .select('id')
                .single();

            if (error) throw error;

            return {
                success: true,
                clientInfoId: data.id,
            };
        }
    } catch (error) {
        console.error('Error saving client info:', error);
        return {
            success: false,
            error,
        };
    }
}

/**
 * Save main quote record
 */
async function saveQuote(
    inputs: QuoteInputs,
    result: QuoteResult,
    priceVersionId: string,
    clientInfoId: string,
    userId: string
): Promise<{ success: boolean; quoteId?: string; error?: any }> {
    try {
        const quoteData: DbQuote = {
            quote_number: result.quoteNumber,
            project_name: inputs.client.projectName,
            status: 'draft',
            price_version_id: priceVersionId,
            client_info_id: clientInfoId,
            site_address: inputs.client.billingAddress || '',
            site_suburb: inputs.client.suburb || '',
            site_state: inputs.client.state,
            site_postcode: inputs.client.postcode,
            nmi: inputs.client.nmi,
            dnsp: inputs.installation.dnsp,
            system_kw: inputs.system.totalSystemSizeKw,
            system_kva: inputs.system.totalSystemSizeKw * 1.2, // Approximate conversion
            has_bess: inputs.system.hasBess,
            has_ev: inputs.system.hasEv,
            existing_solar_kw: inputs.system.existingPvSizeKw || 0,
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
            internal_notes: `Markup: ${(inputs.pricing.proposedMarkup * 100).toFixed(2)}%`,
            created_by: userId,
        };

        const { data, error } = await supabase
            .from('quotes')
            .insert(quoteData)
            .select('id')
            .single();

        if (error) throw error;

        return {
            success: true,
            quoteId: data.id,
        };
    } catch (error) {
        console.error('Error saving quote:', error);
        return {
            success: false,
            error,
        };
    }
}

/**
 * Save quote line items with static prices
 */
async function saveQuoteItems(
    quoteId: string,
    quoteNumber: string,
    subtotals: QuoteResult['subtotals'],
    markup: number,
    priceVersionId: string
): Promise<{ success: boolean; error?: any }> {
    try {
        const items: DbQuoteItem[] = [];

        // Flatten all line items from all categories
        subtotals.forEach((subtotal) => {
            subtotal.items.forEach((item: LineItem) => {
                items.push({
                    quote_id: quoteId,
                    quote_number: quoteNumber,
                    category: item.category,
                    subcategory: item.type,
                    item_name: item.item,
                    item_type: item.type,
                    qty: item.quantity,
                    unit: 'unit', // Default unit
                    cost_per_watt: item.costPerWatt,
                    sale_cost_per_watt: item.salePerWatt,
                    quoted_cost: item.unitCost,
                    quoted_markup: markup,
                    quoted_sales_cost: item.salesRate,
                    total_line_amount: item.totalCost,
                    version_used: priceVersionId,
                });
            });
        });

        if (items.length === 0) {
            return { success: true };
        }

        const { error } = await supabase.from('quote_items').insert(items);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error saving quote items:', error);
        return {
            success: false,
            error,
        };
    }
}

/**
 * Save all calculations to their respective tables with JSONB storage
 */
async function saveAllCalculations(
    quoteId: string,
    inputs: QuoteInputs,
    result: QuoteResult
): Promise<void> {
    try {
        // 1. Main quote calculation (quote_calc)
        await saveQuoteCalc(quoteId, result);

        // 2. Rebate calculation (rebate_calc)
        await saveRebateCalc(quoteId, result);

        // 3. AC Calculator (ac_calc) - if applicable
        if (result.subtotals.some(s => s.category === 'Components' || s.category === 'Cabling')) {
            await saveAcCalc(quoteId, inputs, result);
        }

        // 4. BESS calculation (bess_calc) - if BESS included
        if (inputs.system.hasBess) {
            await saveBessCalc(quoteId, inputs, result);
        }

        // 5. EV calculation (ev_calc) - if EV included
        if (inputs.system.hasEv) {
            await saveEvCalc(quoteId, inputs, result);
        }

        // 6. Switch Gear calculation (switch_gear_calc)
        await saveSwitchGearCalc(quoteId, result);

        // 7. Service Model calculation (service_model_calc)
        await saveServiceModelCalc(quoteId, result);

        // 8. Agreement Result (agreement_result)
        await saveAgreementResult(quoteId, inputs, result);

    } catch (error) {
        console.error('Error saving calculations:', error);
        throw error;
    }
}

/**
 * Save main quote calculation
 */
async function saveQuoteCalc(
    quoteId: string,
    result: QuoteResult
): Promise<void> {
    const calcData: DbQuoteCalc = {
        quote_id: quoteId,
        calc_sheet: {
            quoteNumber: result.quoteNumber,
            projectName: result.projectName,
            systemSizeKw: result.systemSizeKw,
            subtotals: result.subtotals,
            totalInstallCost: result.totalInstallCost,
            costPerWatt: result.costPerWatt,
            markup: result.markup,
            salePrice: result.salePrice,
            salePricePerWatt: result.salePricePerWatt,
            profitMargin: result.profitMargin,
            grossProfitPercent: result.grossProfitPercent,
            totalSystemValueExGst: result.totalSystemValueExGst,
            gst: result.gst,
            totalSystemValueIncGst: result.totalSystemValueIncGst,
            netSystemValueExGst: result.netSystemValueExGst,
            netSystemValueIncGst: result.netSystemValueIncGst,
            calculatedAt: result.calculatedAt,
        },
    };

    const { error } = await supabase.from('quote_calc').insert(calcData);
    if (error) throw error;
}

/**
 * Save rebate calculation
 */
async function saveRebateCalc(
    quoteId: string,
    result: QuoteResult
): Promise<void> {
    const rebateData: DbRebateCalc = {
        quote_id: quoteId,
        calc_sheet: {
            claimedStcCapacityKwp: result.rebates.claimedStcCapacityKwp,
            deemingPeriodYears: result.rebates.deemingPeriodYears,
            stcQuantity: result.rebates.stcQuantity,
            stcDiscountExGst: result.rebates.stcDiscountExGst,
            veecTraderFeeExGst: result.rebates.veecTraderFeeExGst,
            upfrontVeecDiscountExGst: result.rebates.upfrontVeecDiscountExGst,
            totalUpfrontRebateExGst: result.rebates.totalUpfrontRebateExGst,
        },
    };

    const { error } = await supabase.from('rebate_calc').insert(rebateData);
    if (error) throw error;
}

/**
 * Save AC calculator results
 */
async function saveAcCalc(
    quoteId: string,
    inputs: QuoteInputs,
    result: QuoteResult
): Promise<void> {
    const acComponents = result.subtotals.filter(
        s => s.category === 'Components' || s.category === 'Cabling'
    );

    const calcData: DbAcCalc = {
        quote_id: quoteId,
        calc_sheet: {
            systemSizeKw: inputs.system.totalSystemSizeKw,
            inverterSizeKw: inputs.system.inverterSizeKw,
            inverterQuantity: inputs.system.inverterQuantity,
            panelWattage: inputs.system.panelWattage,
            panelQuantity: inputs.system.panelQuantity,
            components: acComponents,
            totalComponentCost: acComponents.reduce((sum, c) => sum + c.totalCost, 0),
            totalComponentSale: acComponents.reduce((sum, c) => sum + c.totalSale, 0),
            calculatedAt: new Date().toISOString(),
        },
    };

    const { error } = await supabase.from('ac_calc').insert(calcData);
    if (error) throw error;
}

/**
 * Save BESS calculation
 */
async function saveBessCalc(
    quoteId: string,
    inputs: QuoteInputs,
    result: QuoteResult
): Promise<void> {
    const bessComponents = result.subtotals.filter(s => s.category === 'Battery');

    const calcData: DbBessCalc = {
        quote_id: quoteId,
        calc_sheet: {
            bessCapacityKwh: inputs.system.bessCapacityKwh,
            hasBess: inputs.system.hasBess,
            components: bessComponents,
            totalBessCost: bessComponents.reduce((sum, c) => sum + c.totalCost, 0),
            totalBessSale: bessComponents.reduce((sum, c) => sum + c.totalSale, 0),
            calculatedAt: new Date().toISOString(),
        },
    };

    const { error } = await supabase.from('bess_calc').insert(calcData);
    if (error) throw error;
}

/**
 * Save EV calculation
 */
async function saveEvCalc(
    quoteId: string,
    inputs: QuoteInputs,
    result: QuoteResult
): Promise<void> {
    const calcData: DbEvCalc = {
        quote_id: quoteId,
        calc_sheet: {
            hasEv: inputs.system.hasEv,
            evChargerQuantity: inputs.system.evChargerQuantity,
            calculatedAt: new Date().toISOString(),
        },
    };

    const { error } = await supabase.from('ev_calc').insert(calcData);
    if (error) throw error;
}

/**
 * Save switch gear calculation
 */
async function saveSwitchGearCalc(
    quoteId: string,
    result: QuoteResult
): Promise<void> {
    const switchGearComponents = result.subtotals.filter(
        s => s.category === 'Switch Gear' || s.items.some(i => i.type.toLowerCase().includes('breaker'))
    );

    const calcData: DbSwitchGearCalc = {
        quote_id: quoteId,
        calc_sheet: {
            components: switchGearComponents,
            totalCost: switchGearComponents.reduce((sum, c) => sum + c.totalCost, 0),
            totalSale: switchGearComponents.reduce((sum, c) => sum + c.totalSale, 0),
            calculatedAt: new Date().toISOString(),
        },
    };

    const { error } = await supabase.from('switch_gear_calc').insert(calcData);
    if (error) throw error;
}

/**
 * Save service model calculation
 */
async function saveServiceModelCalc(
    quoteId: string,
    result: QuoteResult
): Promise<void> {
    const calcData: DbServiceModelCalc = {
        quote_id: quoteId,
        calc_sheet: {
            totalSystemValue: result.totalSystemValueExGst,
            profitMargin: result.profitMargin,
            grossProfitPercent: result.grossProfitPercent,
            markup: result.markup,
            calculatedAt: new Date().toISOString(),
        },
    };

    const { error } = await supabase.from('service_model_calc').insert(calcData);
    if (error) throw error;
}

/**
 * Save agreement result
 */
async function saveAgreementResult(
    quoteId: string,
    inputs: QuoteInputs,
    result: QuoteResult
): Promise<void> {
    const agreementData: DbAgreementResult = {
        quote_id: quoteId,
        agreement_sheet: {
            projectName: result.projectName,
            systemSizeKw: result.systemSizeKw,
            totalSystemValueExGst: result.totalSystemValueExGst,
            totalSystemValueIncGst: result.totalSystemValueIncGst,
            netSystemValueExGst: result.netSystemValueExGst,
            netSystemValueIncGst: result.netSystemValueIncGst,
            rebates: result.rebates,
        },
        total_quote_price: result.totalSystemValueIncGst,
        is_pv_only: !inputs.system.hasBess && !inputs.system.hasEv,
        is_pv_and_bess: inputs.system.hasBess && !inputs.system.hasEv,
        is_ev_included: inputs.system.hasEv,
        is_bess_only: inputs.system.hasBess && inputs.system.totalSystemSizeKw === 0,
    };

    const { error } = await supabase.from('agreement_result').insert(agreementData);
    if (error) throw error;
}

/**
 * Create quote snapshot for version history
 */
async function createQuoteSnapshot(
    quoteId: string,
    versionNumber: number,
    result: QuoteResult,
    changeNote: string,
    userId: string
): Promise<{ success: boolean; error?: any }> {
    try {
        const snapshotData: DbQuoteSnapshot = {
            quote_id: quoteId,
            version_number: versionNumber,
            snapshot: {
                fullResult: result,
                timestamp: new Date().toISOString(),
            },
            change_note: changeNote,
            created_by: userId,
        };

        const { error } = await supabase.from('quote_snapshots').insert(snapshotData);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error creating quote snapshot:', error);
        return {
            success: false,
            error,
        };
    }
}

/**
 * Rollback quote on error
 */
async function rollbackQuote(quoteId: string): Promise<void> {
    try {
        // Delete quote items
        await supabase.from('quote_items').delete().eq('quote_id', quoteId);

        // Delete all calculation tables
        await supabase.from('quote_calc').delete().eq('quote_id', quoteId);
        await supabase.from('rebate_calc').delete().eq('quote_id', quoteId);
        await supabase.from('ac_calc').delete().eq('quote_id', quoteId);
        await supabase.from('bess_calc').delete().eq('quote_id', quoteId);
        await supabase.from('ev_calc').delete().eq('quote_id', quoteId);
        await supabase.from('switch_gear_calc').delete().eq('quote_id', quoteId);
        await supabase.from('service_model_calc').delete().eq('quote_id', quoteId);
        await supabase.from('agreement_result').delete().eq('quote_id', quoteId);

        // Delete quote snapshots
        await supabase.from('quote_snapshots').delete().eq('quote_id', quoteId);

        // Delete quote
        await supabase.from('quotes').delete().eq('id', quoteId);

        console.log('Quote rollback completed:', quoteId);
    } catch (error) {
        console.error('Error during rollback:', error);
    }
}

// ============================================================================
// ADDITIONAL UTILITY FUNCTIONS
// ============================================================================

/**
 * Update existing quote
 */
export async function updateQuoteData(
    quoteId: string,
    inputs: QuoteInputs,
    result: QuoteResult,
    changeNote: string
): Promise<SaveQuoteResult> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return {
                success: false,
                error: 'User not authenticated',
            };
        }

        // Get current version number
        const { data: snapshots } = await supabase
            .from('quote_snapshots')
            .select('version_number')
            .eq('quote_id', quoteId)
            .order('version_number', { ascending: false })
            .limit(1);

        const nextVersion = snapshots && snapshots.length > 0 ? snapshots[0].version_number + 1 : 1;

        // Delete existing quote items
        await supabase.from('quote_items').delete().eq('quote_id', quoteId);

        // Insert new quote items
        const itemsResult = await saveQuoteItems(
            quoteId,
            result.quoteNumber,
            result.subtotals,
            result.markup,
            '' // Price version not needed for update
        );

        if (!itemsResult.success) {
            return {
                success: false,
                error: 'Failed to update quote items',
                details: itemsResult.error,
            };
        }

        // Update all calculations
        await supabase.from('quote_calc').delete().eq('quote_id', quoteId);
        await supabase.from('rebate_calc').delete().eq('quote_id', quoteId);
        await supabase.from('ac_calc').delete().eq('quote_id', quoteId);
        await supabase.from('bess_calc').delete().eq('quote_id', quoteId);
        await supabase.from('ev_calc').delete().eq('quote_id', quoteId);
        await supabase.from('switch_gear_calc').delete().eq('quote_id', quoteId);
        await supabase.from('service_model_calc').delete().eq('quote_id', quoteId);
        await supabase.from('agreement_result').delete().eq('quote_id', quoteId);

        await saveAllCalculations(quoteId, inputs, result);

        // Create new snapshot
        await createQuoteSnapshot(quoteId, nextVersion, result, changeNote, userId);

        // Update quote record
        await supabase
            .from('quotes')
            .update({
                system_kw: inputs.system.totalSystemSizeKw,
                has_bess: inputs.system.hasBess,
                has_ev: inputs.system.hasEv,
                updated_at: new Date().toISOString(),
            })
            .eq('id', quoteId);

        return {
            success: true,
            quoteId,
        };
    } catch (error) {
        console.error('Error updating quote data:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error,
        };
    }
}

/**
 * Retrieve quote by ID with all related data
 */
export async function getQuoteById(quoteId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
}> {
    try {
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select('*, client_info(*)')
            .eq('id', quoteId)
            .single();

        if (quoteError) throw quoteError;

        const { data: items, error: itemsError } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quoteId);

        if (itemsError) throw itemsError;

        const { data: calc, error: calcError } = await supabase
            .from('quote_calc')
            .select('*')
            .eq('quote_id', quoteId)
            .single();

        if (calcError && calcError.code !== 'PGRST116') {
            // Ignore "not found" error
            throw calcError;
        }

        const { data: rebate, error: rebateError } = await supabase
            .from('rebate_calc')
            .select('*')
            .eq('quote_id', quoteId)
            .single();

        if (rebateError && rebateError.code !== 'PGRST116') {
            throw rebateError;
        }

        return {
            success: true,
            data: {
                quote,
                items,
                calc,
                rebate,
            },
        };
    } catch (error) {
        console.error('Error retrieving quote:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * List all quotes with pagination
 */
export async function listQuotes(
    page: number = 1,
    pageSize: number = 20
): Promise<{
    success: boolean;
    data?: any[];
    total?: number;
    error?: string;
}> {
    try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
            .from('quotes')
            .select('*, client_info(primary_contact, email_address)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            success: true,
            data: data || [],
            total: count || 0,
        };
    } catch (error) {
        console.error('Error listing quotes:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
