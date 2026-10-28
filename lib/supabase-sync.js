// ============================================================================
// EXIDE BATTERY WHOLESALE NEPAL & ERP
// lib/supabase-sync.js: Supabase Cloud Persistence & Order Synchronization Engine
// ============================================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;

function loadEnvConfig() {
  const envPath = path.join(__dirname, '..', '.env');
  const envConfig = {};
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            envConfig[key] = val;
          }
        }
      });
    } catch (e) {}
  }
  return envConfig;
}

function getSupabaseServerClient() {
  if (cachedClient) return cachedClient;

  const env = loadEnvConfig();
  const url = process.env.SUPABASE_URL || env.SUPABASE_URL || 'https://upplcvxeaazdujlnwejz.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return cachedClient;
  } catch (err) {
    console.warn('[SupabaseSync] Init warning:', err.message);
    return null;
  }
}

// ----------------------------------------------------------------------------
// ENUM NORMALIZERS
// ----------------------------------------------------------------------------
function mapOrderStatus(status) {
  if (!status) return 'confirmed';
  const s = String(status).toLowerCase();
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('out') || s.includes('transit') || s.includes('dispatched')) return 'out_for_delivery';
  if (s.includes('deliver') || s.includes('complete')) return 'delivered';
  if (s.includes('process')) return 'processing';
  if (s.includes('draft')) return 'draft';
  return 'confirmed';
}

function mapPaymentMethod(method) {
  if (!method) return 'COD';
  const m = String(method).toUpperCase();
  if (m.includes('ESEWA')) return 'ESEWA';
  if (m.includes('KHALTI')) return 'KHALTI';
  if (m.includes('FONEPAY') || m.includes('QR')) return 'FONEPAY';
  if (m.includes('BANK') || m.includes('TRANSFER')) return 'BANK_TRANSFER';
  return 'COD';
}

function mapPaymentStatus(status) {
  if (!status) return 'unpaid';
  const s = String(status).toLowerCase();
  if (s === 'paid' || s === 'completed' || s === 'settled') return 'paid';
  if (s.includes('partial')) return 'partially_paid';
  if (s.includes('refund')) return 'refunded';
  return 'unpaid';
}

// ----------------------------------------------------------------------------
// SYNCHRONIZATION WORKFLOWS
// ----------------------------------------------------------------------------

/**
 * Synchronizes an authoritative order and tax invoice to Supabase cloud tables
 */
async function syncOrderToSupabase(order) {
  const client = getSupabaseServerClient();
  if (!client || !order) return null;

  try {
    const orderNumber = order.orderId || order.id || `EXD-${Date.now().toString().slice(-6)}`;
    const grandTotal = Number(order.grandTotal || order.total || 0);
    const scrapRebate = Number(order.scrapRebate || (order.scrapBattery ? order.scrapBattery.rebate : 0));
    const subtotal = Number(order.subtotal || (grandTotal + scrapRebate));
    const vatAmount = Number(order.tax || order.vatAmount || 0);
    const taxableAmount = Number(order.taxableAmount || (grandTotal > 0 ? Math.round(grandTotal / 1.13) : 0));

    // 1. Upsert into sales_orders
    const orderPayload = {
      order_number: orderNumber,
      order_type: order.orderType || 'retail',
      status: mapOrderStatus(order.status || order.orderStatus),
      payment_method: mapPaymentMethod(order.paymentMethod),
      payment_status: mapPaymentStatus(order.paymentStatus),
      raw_subtotal: subtotal,
      scrap_rebate_discount: scrapRebate,
      delivery_fee: Number(order.deliveryFee || 0),
      grand_total: grandTotal,
      vat_percentage: 13.00,
      taxable_amount: taxableAmount,
      vat_amount: vatAmount,
      guest_customer_info: order.customer || null,
      notes: order.notes || (order.service ? order.service.name : null)
    };

    const { data: savedOrder, error: orderErr } = await client
      .from('sales_orders')
      .upsert(orderPayload, { onConflict: 'order_number' })
      .select('id')
      .single();

    if (orderErr && !String(orderErr.message).includes('fetch failed')) {
      console.warn('[SupabaseSync] sales_orders notice:', orderErr.message);
    }

    const orderDbId = savedOrder?.id;

    // 2. Sync Order Items if available
    if (orderDbId && Array.isArray(order.items) && order.items.length > 0) {
      const itemsPayload = order.items.map(item => ({
        sales_order_id: orderDbId,
        product_id: item.id || item.productId,
        quantity: Number(item.qty || item.quantity || 1),
        unit_price: Number(item.price || item.unitPrice || 0),
        line_total: Number(item.total || ((item.price || item.unitPrice || 0) * (item.qty || item.quantity || 1))),
        warranty_months: 36
      }));

      await client.from('sales_order_items').insert(itemsPayload).catch(() => {});
    }

    // 3. Sync Nepal IRD Tax Invoice if issued
    if (order.invoiceNumber) {
      const invoicePayload = {
        invoice_number: order.invoiceNumber,
        sales_order_id: orderDbId || null,
        buyer_name: order.customer?.name || order.buyerName || 'Walk-in Retail Customer',
        buyer_pan: order.customer?.pan || order.buyerPan || null,
        buyer_phone: order.customer?.phone || order.buyerPhone || '9800000000',
        buyer_address: order.customer?.address || order.buyerAddress || 'Kathmandu, Nepal',
        seller_name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
        seller_pan: '609823412',
        seller_address: 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
        taxable_amount: taxableAmount,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        payment_status: mapPaymentStatus(order.paymentStatus) === 'paid' ? 'paid' : 'unpaid'
      };

      const { error: invErr } = await client
        .from('invoices')
        .upsert(invoicePayload, { onConflict: 'invoice_number' });

      if (invErr && !String(invErr.message).includes('fetch failed')) {
        console.warn('[SupabaseSync] invoices notice:', invErr.message);
      }
    }

    // 4. Sync Scrap Battery Exchange if customer traded in old battery
    if (order.scrapBattery && order.scrapBattery.capacity) {
      const exchangeCode = `EXCH-${orderNumber}`;
      const exchangePayload = {
        exchange_code: exchangeCode,
        sales_order_id: orderDbId || null,
        battery_brand: order.scrapBattery.brand || 'Old Lead Acid Battery',
        battery_model: order.scrapBattery.type || 'Automotive / Tubular Scrap',
        capacity_ah: parseInt(order.scrapBattery.capacity, 10) || 150,
        rate_per_ah: 35.00,
        agreed_credit_amount: scrapRebate,
        battery_condition: 'Used Lead Acid',
        disposition: 'scrap_recycle'
      };

      await client.from('battery_exchanges').upsert(exchangePayload, { onConflict: 'exchange_code' }).catch(() => {});
    }

    return true;
  } catch (err) {
    if (!String(err.message).includes('fetch failed')) {
      console.warn('[SupabaseSync] syncOrderToSupabase error:', err.message);
    }
    return false;
  }
}

/**
 * Synchronizes scrap trade-in record to Supabase
 */
async function syncExchangeToSupabase(exchange) {
  const client = getSupabaseServerClient();
  if (!client || !exchange) return null;

  try {
    const exchangePayload = {
      exchange_code: exchange.exchangeNumber || exchange.id,
      battery_brand: exchange.oldBrand || exchange.batteryBrand || 'Generic Lead Acid',
      battery_model: exchange.batteryType || exchange.model || 'Scrap Battery',
      capacity_ah: parseInt(exchange.capacityAh || exchange.capacity, 10) || 100,
      rate_per_ah: Number(exchange.scrapRate || 35.00),
      agreed_credit_amount: Number(exchange.rebateAmount || exchange.agreedCredit || 0),
      battery_condition: exchange.physicalCondition === 'DAMAGED' ? 'Damaged / Swollen' : 'Used Lead Acid',
      disposition: exchange.dispositionStatus === 'CONSIGNMENT_SMELTER' ? 'supplier_credit_return' : 'scrap_recycle'
    };

    await client.from('battery_exchanges').upsert(exchangePayload, { onConflict: 'exchange_code' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Synchronizes warehouse stock movement to Supabase
 */
async function syncStockMovementToSupabase(productId, qty, movementType, refType, refId, reason) {
  const client = getSupabaseServerClient();
  if (!client || !productId) return null;

  try {
    const movementPayload = {
      warehouse_id: 'wh-ktm-01',
      product_id: productId,
      movement_type: movementType || 'MANUAL_ADJUSTMENT',
      quantity: Number(qty),
      reference_type: refType || 'SYSTEM',
      reference_id: String(refId || ''),
      notes: reason || 'Inventory ledger movement'
    };

    await client.from('stock_movements').insert(movementPayload);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  getSupabaseServerClient,
  syncOrderToSupabase,
  syncExchangeToSupabase,
  syncStockMovementToSupabase,
  mapOrderStatus,
  mapPaymentMethod,
  mapPaymentStatus
};
