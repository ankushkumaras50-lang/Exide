# Exide Battery Wholesale & AET Official Partner
### The Power House — Nepal E-Commerce, Live Inventory & ERP Invoicing Platform

A commercial, production-ready e-commerce storefront, inventory management ERP, and Nepal IRD-compliant tax invoicing web application.

---

## 🚀 Quick Start (Ready to Use)

### 1. Launch Local Development Server
The application includes a pure Node.js development server with zero external dependencies:

```bash
# Using npm
npm start
# or
npm run dev

# or directly with Node
node dev-server.js
```

Open your browser and navigate to:
```
http://localhost:3000
```

### 2. Run System Verification Test Suite
Verify that all database structures, authentication flows, scrap calculations, and invoicing engines are 100% functional:

```bash
npm test
```

---

## 🔑 Administrative & ERP Staff Credentials

The system includes Role-Based Access Control (RBAC) with salted cryptographic hashing and JWT session verification. You can use the **1-Click Auto-Fill** buttons on the login modal or enter:

| Role | Username / Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Super Administrator** | `admin@exidebattery.com.np` | `NepalPowerHouse@2026` | Full System Access (`*`) |
| **Store General Manager** | `manager@exidebattery.com.np` | `StoreManager@2026` | Orders, Stock, Logistics, Reports |
| **Warehouse Controller** | `inventory@exidebattery.com.np` | `Inventory@2026` | Stock Adjustments, Serials, Batches |
| **Delivery Rider** | `rider@exidebattery.com.np` | `RiderNepal@2026` | Assigned Deliveries, Cash Collection |

---

## 👤 Verified Customer Demo Accounts

Customer authentication supports Phone OTP verification, Google Sign-In, and password-based login:

| Customer Name | Mobile Number / Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Sunil Yadav** | `9809163454` | `pass_3454` | New Baneshwor, Kathmandu |
| **Ramesh Shrestha** | `9841234567` / `ramesh.nepal@gmail.com` | `pass_4567` | Bijulibazar, Kathmandu |
| **Ankush Kumar** | `9705997260` / `ankushkumaras50@gmail.com` | `pass_7260` | Teku Central, Kathmandu |

*Note: You can also use any Nepal mobile number (e.g. `98XXXXXXXX`) with the Phone OTP tab (demo verification code will appear instantly).*

---

## ♻️ Scrap & Old Battery Cash Buyback Calculator

- **High-Capacity Valuation:** Supports high Ampere-hour capacities (35 Ah up to 100,000+ Ah) for inverter banks, telecom systems, and solar projects.
- **Dynamic Cash Rebate:** Evaluates scrap at official rates (e.g. NPR 35/Ah).
- **Cart Integration:**
  - If the scrap rebate is less than the cart subtotal, it automatically deducts from the bill.
  - If the scrap rebate exceeds the order subtotal (or if the cart is empty), it shows the **100% Bill Covered** badge and displays the **Cash Refund / Spot Cash Amount** paid directly to the customer on doorstep pickup.

---

## 🧾 Nepal IRD-Compliant Tax Invoicing & Checkout Flow

1. **Step 1 — Delivery Address:** Pre-filled with sensible defaults (`Ramesh Shrestha`, `9841234567`, Kathmandu) or auto-synced with logged-in customer accounts.
2. **Step 2 — Fitting & Services:** Express doorstep delivery with certified technician installation, terminal greasing, and inverter charging calibration check.
3. **Step 3 — Nepal Payment Methods:**
   - eSewa Mobile Wallet
   - Khalti Digital Wallet
   - Fonepay Dynamic QR
   - Direct Bank Transfer (Global IME Bank)
   - Cash / Card on Delivery (COD)
4. **Step 4 — Tax Invoice / भ्याट बिल:**
   - Generates official Nepal VAT Bill with Buyer PAN, Seller IRD VAT (609823412), itemized breakdown, and 13% VAT calculation.
   - 1-Click **Download PDF Bill** (via HTML2PDF)
   - 1-Click **WhatsApp PDF & Bill** dispatch to customer
   - 1-Click **Print Tax Bill** (formatted for A4 paper)
