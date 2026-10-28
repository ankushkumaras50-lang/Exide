#!/usr/bin/env node
// ============================================================================
// EXIDE BATTERY WHOLESALE NEPAL & ENTERPRISE ERP
// scripts/seed-supabase.js: Supabase Database Provisioning & Seed Script
// Seeds: Categories, Warehouses, Products, Stock Balances, Suppliers, Profiles
// ============================================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read Environment Variables from .env or fallback config
const ROOT_DIR = path.join(__dirname, '..');
const envPath = path.join(ROOT_DIR, '.env');
let envConfig = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
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
}

const SUPABASE_URL = process.env.SUPABASE_URL || envConfig.SUPABASE_URL || 'https://upplcvxeaazdujlnwejz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || envConfig.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcGxjdnhlYWF6ZHVqbG53ZWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNzEwMTcsImV4cCI6MjEwODc0NzAxN30.4bxhbuwBLDMTXRvlkCYWUEALIAKWznobH8K20Qf4i7Y';

console.log('================================================================');
console.log('⚡ EXIDE NEPAL ERP - SUPABASE CLOUD SEED & MIGRATION ENGINE');
console.log('================================================================');
console.log(`Endpoint URL : ${SUPABASE_URL}`);
console.log(`Key Type     : ${SUPABASE_KEY.includes('service_role') ? 'Service Role Key (Admin Privileges)' : 'Anon Public Key'}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Data files
const productsData = require('../data/products.json');
const suppliersData = require('../data/suppliers.json');
const usersData = require('../data/users.json');
const { CATEGORIES_LIST } = require('../js/products-data.js');

async function seedCategories() {
  console.log('\n📂 [1/6] Seeding Product Categories...');
  const rows = CATEGORIES_LIST.map((c, i) => ({
    id: c.id,
    name: c.name,
    slug: c.id,
    description: c.desc,
    display_order: i + 1,
    is_active: true
  }));

  const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.warn('  ⚠️ Note on categories (may already exist or need RLS service role):', error.message);
  } else {
    console.log(`  ✅ Successfully synced ${rows.length} categories.`);
  }
}

async function seedWarehouses() {
  console.log('\n🏭 [2/6] Seeding Enterprise Warehouses...');
  const warehouses = [
    {
      id: 'wh-ktm-01',
      code: 'WH-KTM-01',
      name: 'Central Warehouse & Service Depot - Teku',
      district: 'Kathmandu',
      address: 'Teku Link Road, Auto Complex, Kathmandu',
      phone: '+977-9705997260',
      is_primary: true,
      is_active: true
    },
    {
      id: 'wh-btl-01',
      code: 'WH-BTL-01',
      name: 'Lumbini Regional Depot - Butwal',
      district: 'Rupandehi',
      address: 'Traffic Chowk, Butwal',
      phone: '+977-9705997260',
      is_primary: false,
      is_active: true
    },
    {
      id: 'wh-pkr-01',
      code: 'WH-PKR-01',
      name: 'Gandaki Regional Depot - Pokhara',
      district: 'Kaski',
      address: 'Chipledhunga, New Road, Pokhara',
      phone: '+977-9705997260',
      is_primary: false,
      is_active: true
    }
  ];

  const { error } = await supabase.from('warehouses').upsert(warehouses, { onConflict: 'id' });
  if (error) {
    console.warn('  ⚠️ Note on warehouses:', error.message);
  } else {
    console.log(`  ✅ Successfully synced ${warehouses.length} warehouse depots.`);
  }
}

async function seedProducts() {
  console.log('\n📦 [3/6] Seeding Battery & Power Catalog Products...');
  const productRows = productsData.map(p => {
    const catId = (p.categories && p.categories[0]) || 'inverter-battery';
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand || 'Exide',
      category_id: catId,
      model: (p.specs && p.specs.Model) || p.sku,
      capacity: p.capacity || '150Ah - 12V',
      warranty: p.warranty || '36 Months Warranty',
      warranty_months: p.warranty?.includes('48') ? 48 : (p.warranty?.includes('60') ? 60 : 36),
      cost_price: Number(p.costPrice || 0),
      retail_price: Number(p.price || 0),
      wholesale_price: Number(p.wholesalePrice || p.price || 0),
      tax_rate: 13.00,
      reorder_threshold: Number(p.minStock || 5),
      image_url: p.image || 'assets/images/default-battery.png',
      short_desc: p.shortDesc || '',
      description: p.description || '',
      specifications: p.specs || {},
      features: p.features || [],
      is_featured: Boolean(p.featured),
      is_active: p.isActive !== false
    };
  });

  const { error } = await supabase.from('products').upsert(productRows, { onConflict: 'id' });
  if (error) {
    console.warn('  ⚠️ Note on products:', error.message);
  } else {
    console.log(`  ✅ Successfully synced ${productRows.length} catalog products to Supabase.`);
  }

  // Also seed initial stock balance in KTM primary warehouse
  console.log('\n📊 [4/6] Seeding Initial Warehouse Stock Balances...');
  const stockRows = productsData.map(p => ({
    warehouse_id: 'wh-ktm-01',
    product_id: p.id,
    quantity_on_hand: Number(p.stock !== undefined ? p.stock : 20),
    quantity_reserved: 0
  }));

  const { error: stockErr } = await supabase.from('stock_balances').upsert(stockRows, { onConflict: 'warehouse_id,product_id' });
  if (stockErr) {
    console.warn('  ⚠️ Note on stock balances:', stockErr.message);
  } else {
    console.log(`  ✅ Successfully recorded initial balances for ${stockRows.length} inventory SKUs.`);
  }
}

async function seedSuppliers() {
  console.log('\n🏭 [5/6] Seeding Authorized Battery Suppliers...');
  const supplierRows = suppliersData.map(s => ({
    name: s.name,
    company_name: s.name,
    pan_number: s.pan || '301294821',
    contact_person: s.contactPerson || 'Sales Department',
    phone: s.phone || '+977-9705997260',
    email: s.email || 'info@supplier.com',
    address: s.address || 'Kathmandu, Nepal',
    district: s.city || 'Kathmandu',
    payment_terms: s.paymentTerms || '30 Days Net',
    opening_balance: 0.00,
    current_payable: 0.00,
    is_active: s.status === 'ACTIVE'
  }));

  const { error } = await supabase.from('suppliers').upsert(supplierRows, { onConflict: 'pan_number' });
  if (error) {
    console.warn('  ⚠️ Note on suppliers:', error.message);
  } else {
    console.log(`  ✅ Successfully synced ${supplierRows.length} wholesale suppliers.`);
  }
}

async function seedProfiles() {
  console.log('\n👥 [6/6] Seeding Administrative & Verified Staff Accounts...');
  for (const u of usersData) {
    const profileRow = {
      email: u.email,
      phone: u.phone,
      full_name: u.fullName,
      auth_provider: 'local',
      is_email_verified: Boolean(u.isEmailVerified),
      is_phone_verified: Boolean(u.isPhoneVerified),
      password_hash: u.passwordHash,
      password_salt: u.passwordSalt,
      is_active: Boolean(u.isActive)
    };

    const { data: prof, error } = await supabase.from('profiles').upsert(profileRow, { onConflict: 'email' }).select('id').single();
    if (error) {
      console.warn(`  ⚠️ Profile ${u.email}:`, error.message);
    } else if (prof && prof.id) {
      await supabase.from('user_roles').upsert({
        user_id: prof.id,
        role: u.role || 'sales_staff'
      }, { onConflict: 'user_id,role' });
      console.log(`  ✅ Synced profile: ${u.email} [Role: ${u.role}]`);
    }
  }
}

async function main() {
  try {
    await seedCategories();
    await seedWarehouses();
    await seedProducts();
    await seedSuppliers();
    await seedProfiles();

    console.log('\n================================================================');
    console.log('✨ SUPABASE DATABASE PROVISIONING COMPLETE');
    console.log('================================================================');
  } catch (err) {
    console.error('Fatal Seeding Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

