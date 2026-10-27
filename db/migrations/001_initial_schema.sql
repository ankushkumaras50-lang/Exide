-- ============================================================================
-- EXIDE BATTERY WHOLESALE NEPAL & SECURE ERP
-- 001_initial_schema.sql: Core Production PostgreSQL Schema
-- Business: Exide Battery Wholesale (AET Official Partner)
-- Location: Bijulibazar, Kathmandu, Nepal | PAN: 609823412
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to Asia/Kathmandu by default
SET timezone = 'Asia/Kathmandu';

-- ----------------------------------------------------------------------------
-- 1. PROFILES & AUTHENTICATED IDENTITIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Foreign key to auth.users if using Supabase Auth
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    auth_provider TEXT DEFAULT 'local', -- 'google', 'phone_otp', 'local'
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    province TEXT DEFAULT 'Bagmati',
    district TEXT DEFAULT 'Kathmandu',
    city TEXT DEFAULT 'Kathmandu',
    ward TEXT DEFAULT '10',
    address TEXT DEFAULT 'Kathmandu, Nepal',
    delivery_notes TEXT,
    password_hash TEXT,
    password_salt TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);

-- ----------------------------------------------------------------------------
-- 2. ROLES & GRANULAR PERMISSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN (
        'super_admin',
        'inventory_manager',
        'sales_staff',
        'accountant',
        'delivery_rider',
        'viewer',
        'customer'
    )),
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_role UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (role, permission_key)
);

-- Seed Default Granular Capabilities
INSERT INTO role_permissions (role, permission_key, description) VALUES
    ('super_admin', '*', 'Full uncontrolled business and administrative authority'),
    ('inventory_manager', 'inventory_read', 'Read product inventory and stock levels'),
    ('inventory_manager', 'inventory_write', 'Update inventory and stock adjustments'),
    ('inventory_manager', 'purchases_manage', 'Create purchase orders and receive goods'),
    ('inventory_manager', 'cost_price_view', 'View wholesale landed purchase costs'),
    ('sales_staff', 'catalog_read', 'Read products and retail/wholesale prices'),
    ('sales_staff', 'quotations_manage', 'Create customer quotations'),
    ('sales_staff', 'sales_orders_manage', 'Create and confirm sales orders'),
    ('sales_staff', 'invoices_issue', 'Generate official Nepal IRD tax invoices'),
    ('sales_staff', 'battery_exchange_create', 'Process customer old-battery exchange trade-in'),
    ('accountant', 'invoices_read', 'Read all tax invoices and sales records'),
    ('accountant', 'payments_manage', 'Record and verify customer/supplier payments'),
    ('accountant', 'reports_financial', 'View financial reports and tax ledger'),
    ('accountant', 'cost_price_view', 'View product purchase costs for ledger accounting'),
    ('delivery_rider', 'deliveries_assigned', 'View assigned delivery orders'),
    ('delivery_rider', 'delivery_status_update', 'Update delivery and payment collection status'),
    ('viewer', 'records_read', 'Read-only access to permitted records'),
    ('customer', 'orders_own_read', 'View own past order history and invoice receipts'),
    ('customer', 'profile_manage', 'Update own delivery address and profile information')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. NEPAL MOBILE OTP REQUESTS & RATE LIMITING
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    attempts_count INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    is_verified BOOLEAN DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_requests(phone, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. STAFF INVITATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer')),
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON staff_invitations(email);

-- ----------------------------------------------------------------------------
-- 5. AUDIT LOGS (Immutable Activity Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'LOGIN', 'ROLE_CHANGE', 'STOCK_ADJUST', 'PRICE_CHANGE', etc.
    entity_name TEXT NOT NULL,
    entity_id TEXT,
    old_state JSONB,
    new_state JSONB,
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);

-- ----------------------------------------------------------------------------
-- 6. PRODUCT CATALOGUE & CATEGORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
    model TEXT,
    capacity TEXT, -- e.g. '150Ah - 12V', '200Ah - 12V'
    warranty TEXT DEFAULT '36 Months Warranty',
    warranty_months INT DEFAULT 36,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    retail_price NUMERIC(12, 2) NOT NULL,
    wholesale_price NUMERIC(12, 2),
    tax_rate NUMERIC(5, 2) DEFAULT 13.00, -- Nepal 13% VAT
    reorder_threshold INT DEFAULT 5,
    image_url TEXT,
    secondary_images JSONB DEFAULT '[]'::jsonb,
    short_desc TEXT,
    description TEXT,
    specifications JSONB DEFAULT '{}'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ----------------------------------------------------------------------------
-- 7. WAREHOUSES & ATOMIC STOCK LEDGER
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT NOT NULL,
    contact_phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Default Central Warehouses in Nepal
INSERT INTO warehouses (id, name, code, address, contact_phone) VALUES
    ('wh-ktm-central', 'Bijulibazar Central Warehouse', 'KTM-01', 'Bijulibazar, Anamnagar, Kathmandu, Nepal', '+977-9705997260'),
    ('wh-btl-depot', 'Butwal Regional Distribution Hub', 'BTL-01', 'Traffic Chowk, Butwal, Rupandehi, Nepal', '+977-9857086733')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    stock_on_hand INT NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
    stock_reserved INT NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
    last_counted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_warehouse UNIQUE (product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON stock_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON stock_balances(warehouse_id);

CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'OPENING_BALANCE',
        'PURCHASE_RECEIPT',
        'SALES_DEDUCTION',
        'SALES_RETURN',
        'EXCHANGE_SCRAP_INWARD',
        'INTERNAL_TRANSFER_IN',
        'INTERNAL_TRANSFER_OUT',
        'AUDIT_ADJUSTMENT_ADD',
        'AUDIT_ADJUSTMENT_DEDUCT',
        'DAMAGE_WRITE_OFF'
    )),
    quantity INT NOT NULL, -- positive for receipts, negative for deductions
    unit_cost NUMERIC(12, 2) DEFAULT 0.00,
    reference_type TEXT, -- 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'SALES_INVOICE', 'EXCHANGE', 'AUDIT'
    reference_id TEXT,   -- ID of invoice, GRN, etc.
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id);

-- ----------------------------------------------------------------------------
-- 8. SUPPLIERS & PURCHASES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company_name TEXT,
    pan_number TEXT,
    contact_person TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    district TEXT DEFAULT 'Kathmandu',
    payment_terms TEXT DEFAULT '30 Days Net',
    opening_balance NUMERIC(12, 2) DEFAULT 0.00,
    current_payable NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'partially_received', 'received', 'cancelled')),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    ordered_quantity INT NOT NULL CHECK (ordered_quantity > 0),
    received_quantity INT NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number TEXT NOT NULL UNIQUE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    supplier_invoice_no TEXT,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_received_units INT NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    received_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_received INT NOT NULL CHECK (quantity_received > 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(12, 2) NOT NULL,
    batch_number TEXT,
    serial_numbers JSONB DEFAULT '[]'::jsonb
);

-- ----------------------------------------------------------------------------
-- 9. SALES, ORDERS & NEPAL IRD TAX INVOICING
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE, -- e.g. EXD-123456
    customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    guest_customer_info JSONB, -- For unauthenticated guest checkouts
    warehouse_id TEXT DEFAULT 'wh-ktm-central' REFERENCES warehouses(id) ON DELETE RESTRICT,
    order_type TEXT DEFAULT 'retail' CHECK (order_type IN ('retail', 'wholesale', 'quotation')),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN (
        'draft',
        'confirmed',
        'processing',
        'out_for_delivery',
        'delivered',
        'cancelled'
    )),
    payment_method TEXT NOT NULL DEFAULT 'COD' CHECK (payment_method IN ('COD', 'ESEWA', 'KHALTI', 'FONEPAY', 'BANK_TRANSFER')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded')),
    assigned_rider_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    raw_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    scrap_rebate_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    coupon_code TEXT,
    coupon_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_percentage NUMERIC(5, 2) DEFAULT 13.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created ON sales_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    unit_cost NUMERIC(12, 2) DEFAULT 0.00,
    line_total NUMERIC(12, 2) NOT NULL,
    warranty_months INT DEFAULT 36
);

-- Official Sequential Nepal IRD Tax Invoice
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE, -- e.g. INV-2026-01040
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    buyer_name TEXT NOT NULL,
    buyer_pan TEXT,
    buyer_phone TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    seller_name TEXT NOT NULL DEFAULT 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
    seller_pan TEXT NOT NULL DEFAULT '609823412',
    seller_address TEXT NOT NULL DEFAULT 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
    taxable_amount NUMERIC(12, 2) NOT NULL,
    vat_amount NUMERIC(12, 2) NOT NULL,
    grand_total NUMERIC(12, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'paid',
    issued_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    issued_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issued_date DESC);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    vat_amount NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 10. PAYMENTS (Receipts & Settlements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT NOT NULL UNIQUE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'ESEWA', 'KHALTI', 'FONEPAY', 'BANK_TRANSFER', 'CASH')),
    transaction_reference TEXT,
    payment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    received_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT
);

-- ----------------------------------------------------------------------------
-- 11. DEDICATED OLD-BATTERY EXCHANGE (TRADE-IN) WORKFLOW
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS battery_exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_code TEXT NOT NULL UNIQUE, -- e.g. EXCH-2026-0012
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    battery_brand TEXT NOT NULL,
    battery_model TEXT,
    capacity_ah INT NOT NULL CHECK (capacity_ah > 0),
    rate_per_ah NUMERIC(10, 2) NOT NULL DEFAULT 35.00,
    agreed_credit_amount NUMERIC(12, 2) NOT NULL CHECK (agreed_credit_amount >= 0),
    battery_condition TEXT DEFAULT 'Used Lead Acid' CHECK (battery_condition IN (
        'Used Lead Acid',
        'Damaged / Swollen',
        'Dry Cell Defective',
        'Industrial Bank Scrap'
    )),
    disposition TEXT NOT NULL DEFAULT 'pending_inspection' CHECK (disposition IN (
        'pending_inspection',
        'reusable_tested',
        'scrap_recycle',
        'supplier_credit_return'
    )),
    supplier_settlement_ref TEXT,
    inspected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_battery_exchanges_order ON battery_exchanges(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_battery_exchanges_disposition ON battery_exchanges(disposition);
