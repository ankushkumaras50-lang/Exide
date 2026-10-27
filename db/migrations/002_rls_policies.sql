-- ============================================================================
-- EXIDE BATTERY WHOLESALE NEPAL & SECURE ERP
-- 002_rls_policies.sql: PostgreSQL Row-Level Security (RLS) Policies
-- Enforces Least-Privilege Data Access at the Database Engine Level
-- ============================================================================

-- Enable RLS on all sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE battery_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR RLS CHECKS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
    SELECT r.role 
    FROM user_roles r
    JOIN profiles p ON p.id = r.user_id
    WHERE p.auth_user_id = auth.uid() OR p.id = auth.uid()
    ORDER BY CASE 
        WHEN r.role = 'super_admin' THEN 1
        WHEN r.role = 'inventory_manager' THEN 2
        WHEN r.role = 'accountant' THEN 3
        WHEN r.role = 'sales_staff' THEN 4
        WHEN r.role = 'delivery_rider' THEN 5
        ELSE 6
    END
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_erp_staff()
RETURNS BOOLEAN AS $$
    SELECT current_user_role() IN ('super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT current_user_role() = 'super_admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Users can view their own profile; staff can view all profiles
CREATE POLICY "profiles_select_own_or_staff" ON profiles
    FOR SELECT USING (
        id = auth.uid() OR auth_user_id = auth.uid() OR is_erp_staff()
    );

-- Users can update their own contact/address details; SuperAdmin can update any
CREATE POLICY "profiles_update_own_or_admin" ON profiles
    FOR UPDATE USING (
        id = auth.uid() OR auth_user_id = auth.uid() OR is_super_admin()
    );

-- ----------------------------------------------------------------------------
-- 2. USER ROLES & PERMISSIONS
-- ----------------------------------------------------------------------------
-- Only SuperAdmin can manage or view staff user roles
CREATE POLICY "roles_admin_all" ON user_roles
    FOR ALL USING (is_super_admin());

CREATE POLICY "permissions_read_all" ON role_permissions
    FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS & CATEGORIES
-- ----------------------------------------------------------------------------
-- Anyone can view active categories
CREATE POLICY "categories_public_read" ON categories
    FOR SELECT USING (is_active = true OR is_erp_staff());

-- Staff can modify categories
CREATE POLICY "categories_staff_write" ON categories
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager'));

-- Public can view active products
CREATE POLICY "products_public_read" ON products
    FOR SELECT USING (is_active = true OR is_erp_staff());

-- Only Inventory Managers & SuperAdmin can add/edit products
CREATE POLICY "products_staff_write" ON products
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager'));

-- ----------------------------------------------------------------------------
-- 4. STOCK BALANCES & AUDIT LEDGER (RESTRICTED TO AUTHENTICATED STAFF)
-- ----------------------------------------------------------------------------
-- Public NEVER sees stock balances directly (only public available quantity projection)
CREATE POLICY "stock_balances_staff_read" ON stock_balances
    FOR SELECT USING (is_erp_staff());

CREATE POLICY "stock_balances_staff_write" ON stock_balances
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager'));

-- Stock movements are strictly immutable: no updates or deletes permitted
CREATE POLICY "stock_movements_staff_read" ON stock_movements
    FOR SELECT USING (is_erp_staff());

CREATE POLICY "stock_movements_staff_insert" ON stock_movements
    FOR INSERT WITH CHECK (is_erp_staff());

-- ----------------------------------------------------------------------------
-- 5. SUPPLIERS & PURCHASES (NO SALES STAFF ACCESS)
-- ----------------------------------------------------------------------------
CREATE POLICY "suppliers_management" ON suppliers
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager', 'accountant'));

CREATE POLICY "purchases_management" ON purchase_orders
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager', 'accountant'));

CREATE POLICY "purchase_items_management" ON purchase_order_items
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager', 'accountant'));

CREATE POLICY "goods_receipts_management" ON goods_receipts
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager', 'accountant'));

CREATE POLICY "goods_receipt_items_management" ON goods_receipt_items
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager', 'accountant'));

-- ----------------------------------------------------------------------------
-- 6. SALES ORDERS & TAX INVOICES
-- ----------------------------------------------------------------------------
-- Customers see only their own orders; staff sees all
CREATE POLICY "sales_orders_select" ON sales_orders
    FOR SELECT USING (
        customer_id = auth.uid() OR is_erp_staff()
    );

CREATE POLICY "sales_orders_insert" ON sales_orders
    FOR INSERT WITH CHECK (true); -- Guests and logged-in customers can place orders

CREATE POLICY "sales_orders_staff_update" ON sales_orders
    FOR UPDATE USING (
        is_erp_staff() OR (current_user_role() = 'delivery_rider' AND assigned_rider_id = auth.uid())
    );

CREATE POLICY "invoices_select" ON invoices
    FOR SELECT USING (
        customer_id = auth.uid() OR is_erp_staff()
    );

CREATE POLICY "invoices_staff_write" ON invoices
    FOR ALL USING (current_user_role() IN ('super_admin', 'sales_staff', 'accountant', 'inventory_manager'));

-- ----------------------------------------------------------------------------
-- 7. BATTERY EXCHANGES
-- ----------------------------------------------------------------------------
CREATE POLICY "battery_exchanges_select" ON battery_exchanges
    FOR SELECT USING (
        customer_id = auth.uid() OR is_erp_staff()
    );

CREATE POLICY "battery_exchanges_staff_write" ON battery_exchanges
    FOR ALL USING (current_user_role() IN ('super_admin', 'inventory_manager', 'sales_staff'));

-- ----------------------------------------------------------------------------
-- 8. AUDIT LOGS
-- ----------------------------------------------------------------------------
-- Strictly SuperAdmin can read audit logs; no one can update or delete
CREATE POLICY "audit_logs_read" ON audit_logs
    FOR SELECT USING (is_super_admin());

CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT WITH CHECK (true);
