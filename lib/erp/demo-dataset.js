// Realistic, Internally Consistent Demo Dataset Spanning Multiple Financial Periods
// Exide Battery Wholesale & AET Official Partner (Flipkart / Amazon Seller Format)
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PURCHASES_FILE = path.join(DATA_DIR, 'purchases.json');
const EXCHANGES_FILE = path.join(DATA_DIR, 'exchanges.json');
const EXPENSES_FILE = path.join(DATA_DIR, 'expenses.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const AI_REPORTS_FILE = path.join(DATA_DIR, 'ai_reports.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEMO_STATE_FILE = path.join(DATA_DIR, 'demo_state.json');

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function readJson(file, def = []) {
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  }
  return def;
}

function seedDemoDataset() {
  // --------------------------------------------------------------------------
  // 1. DEMO ORDERS & INVOICES (Internally Consistent Calculations)
  // --------------------------------------------------------------------------
  const demoOrders = [
    // Period 1: Q1 2026 (Jan 20, 2026)
    {
      orderId: 'EXD-DEMO-1001',
      id: 'EXD-DEMO-1001',
      invoiceNumber: 'INV-2026-00101',
      trackingNumber: 'NP-EXD-9001',
      date: '2026-01-20T10:15:00.000Z',
      orderDate: '20 Jan 2026, 10:15',
      orderDateFormatted: '20 Jan 2026, 10:15',
      isDemo: true,
      orderType: 'SALES_ORDER',
      status: 'DELIVERED',
      orderStatus: 'DELIVERED',
      paymentMethod: 'Bank Transfer (EBL)',
      paymentStatus: 'PAID',
      assignedRider: 'Bikram Shrestha (+977 9812345678 - Patan Hub)',
      dispatchVehicle: 'Ba 3 Pa 9120 (Honda Shine)',
      seller: {
        name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
        pan: '609823412',
        address: 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
        phone: '+9779705997260',
        email: 'batterymartbtl@gmail.com'
      },
      customer: {
        fullName: 'Bikash Maharjan',
        phone: '9801234567',
        email: 'bikash.maharjan@gmail.com',
        district: 'Lalitpur',
        city: 'Patan',
        ward: '04',
        address: 'Mangalbazar, Patan, Lalitpur',
        deliveryAddress: 'Mangalbazar, Patan, Lalitpur',
        assignedRider: 'Bikram Shrestha'
      },
      items: [
        {
          id: 'exide-battery-150-invamaster',
          sku: 'EX-IMTT1500',
          name: 'Exide 150 Ah Invamaster Tubular Battery - IMTT1500',
          brand: 'Exide',
          capacity: '150Ah - 12V',
          warranty: '36 Months Official Warranty',
          price: 34000,
          quantity: 2,
          itemTotal: 68000,
          image: 'assets/images/exide-imtt1500.png'
        }
      ],
      pricing: {
        rawSubtotal: 68000,
        scrapExchangeDeduction: 5250,
        scrapBatteryAh: 150,
        scrapRate: 35,
        couponDiscount: 0,
        deliveryFee: 0,
        taxableAmount: 62750,
        vatAmount: 8158,
        grandTotal: 70908,
        currency: 'NPR',
        vatPercentage: 13
      },
      calculations: {
        rawSubtotal: 68000,
        scrapExchangeDeduction: 5250,
        scrapBatteryAh: 150,
        scrapRate: 35,
        taxableAmount: 62750,
        vatAmount: 8158,
        grandTotal: 70908
      },
      payments: [
        { amount: 70908, method: 'EBL Transfer', reference: 'TXN-EBL-89123', date: '2026-01-20T10:30:00.000Z', status: 'VERIFIED' }
      ],
      trackingHistory: [
        { step: 'CONFIRMED', time: '10:15 AM', note: 'Order confirmed and inventory allocated at Bijulibazar depot.' },
        { step: 'SHIPPED', time: '11:00 AM', note: 'Dispatched with rider Bikram Shrestha on Ba 3 Pa 9120.' },
        { step: 'DELIVERED', time: '01:45 PM', note: 'Installed at Mangalbazar. Voltage calibrated to 14.2V float.' }
      ]
    },

    // Period 2: Q2 2026 (May 14, 2026)
    {
      orderId: 'EXD-DEMO-1002',
      id: 'EXD-DEMO-1002',
      invoiceNumber: 'INV-2026-00245',
      trackingNumber: 'NP-EXD-9002',
      date: '2026-05-14T14:30:00.000Z',
      orderDate: '14 May 2026, 14:30',
      orderDateFormatted: '14 May 2026, 14:30',
      isDemo: true,
      orderType: 'SALES_ORDER',
      status: 'DELIVERED',
      orderStatus: 'DELIVERED',
      paymentMethod: 'eSewa Digital Wallet',
      paymentStatus: 'PAID',
      assignedRider: 'Ramesh Thapa (+977 9801234567 - Kathmandu Central)',
      dispatchVehicle: 'Ba 2 Pa 4521 (Hero Splendor)',
      seller: {
        name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
        pan: '609823412',
        address: 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
        phone: '+9779705997260',
        email: 'batterymartbtl@gmail.com'
      },
      customer: {
        fullName: 'Rita Sharma',
        phone: '9841234567',
        email: 'rita.sharma@gmail.com',
        district: 'Kathmandu',
        city: 'Kathmandu',
        ward: '26',
        address: 'Thamel, Chhetrapati Road, Kathmandu',
        deliveryAddress: 'Thamel, Chhetrapati Road, Kathmandu',
        assignedRider: 'Ramesh Thapa'
      },
      items: [
        {
          id: 'exide-matrix-red-45',
          sku: 'EX-MT45L',
          name: 'Exide Matrix Red 45Ah Maintenance-Free Car Battery',
          brand: 'Exide',
          capacity: '45Ah - 12V',
          warranty: '60 Months (36F + 24PR)',
          price: 11500,
          quantity: 1,
          itemTotal: 11500,
          image: 'assets/images/exide-matrix.png'
        }
      ],
      pricing: {
        rawSubtotal: 11500,
        scrapExchangeDeduction: 1225,
        scrapBatteryAh: 35,
        scrapRate: 35,
        couponDiscount: 0,
        deliveryFee: 0,
        taxableAmount: 10275,
        vatAmount: 1336,
        grandTotal: 11611,
        currency: 'NPR',
        vatPercentage: 13
      },
      calculations: {
        rawSubtotal: 11500,
        scrapExchangeDeduction: 1225,
        scrapBatteryAh: 35,
        scrapRate: 35,
        taxableAmount: 10275,
        vatAmount: 1336,
        grandTotal: 11611
      },
      payments: [
        { amount: 11611, method: 'eSewa', reference: 'ESW-9912048', date: '2026-05-14T14:32:00.000Z', status: 'VERIFIED' }
      ],
      trackingHistory: [
        { step: 'CONFIRMED', time: '02:30 PM', note: 'Order paid via eSewa. Terminal grease prepared.' },
        { step: 'SHIPPED', time: '03:15 PM', note: 'Dispatched with Ramesh Thapa.' },
        { step: 'DELIVERED', time: '04:10 PM', note: 'Alternator tested: 14.1V healthy. Old 35Ah scrap battery collected.' }
      ]
    },

    // Period 3: Q3 2026 (Aug 08, 2026 - B2B PAN Corporate)
    {
      orderId: 'EXD-DEMO-1003',
      id: 'EXD-DEMO-1003',
      invoiceNumber: 'INV-2026-00412',
      trackingNumber: 'NP-EXD-9003',
      date: '2026-08-08T11:00:00.000Z',
      orderDate: '08 Aug 2026, 11:00',
      orderDateFormatted: '08 Aug 2026, 11:00',
      isDemo: true,
      orderType: 'SALES_ORDER',
      status: 'DELIVERED',
      orderStatus: 'DELIVERED',
      paymentMethod: 'Corporate Cheque / Credit (Net 30)',
      paymentStatus: 'PAID',
      assignedRider: 'Sujan Karki (+977 9823456789 - Heavy Truck Delivery)',
      dispatchVehicle: 'Ba 1 Ja 8821 (Tata Ace Mini-Truck)',
      seller: {
        name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
        pan: '609823412',
        address: 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
        phone: '+9779705997260',
        email: 'batterymartbtl@gmail.com'
      },
      customer: {
        fullName: 'Nepal Power Systems Pvt. Ltd.',
        pan: '304561829',
        panNumber: '304561829',
        companyName: 'Nepal Power Systems Pvt. Ltd.',
        phone: '9851000001',
        email: 'procurement@nepalpowersystems.com.np',
        district: 'Kathmandu',
        city: 'Kathmandu',
        ward: '10',
        address: 'Bijulibazar Corporate Tower, 4th Floor',
        deliveryAddress: 'Bijulibazar Corporate Tower, 4th Floor',
        assignedRider: 'Sujan Karki'
      },
      items: [
        {
          id: 'exide-tubemaster-200',
          sku: 'EX-TM2000',
          name: 'Exide 200 Ah Tubemaster Heavy Duty Solar Battery',
          brand: 'Exide',
          capacity: '200Ah - 12V',
          warranty: '48 Months Warranty',
          price: 42000,
          quantity: 4,
          itemTotal: 168000,
          image: 'assets/images/exide-tubemaster.png'
        }
      ],
      pricing: {
        rawSubtotal: 168000,
        scrapExchangeDeduction: 14000,
        scrapBatteryAh: 400,
        scrapRate: 35,
        couponDiscount: 0,
        deliveryFee: 0,
        taxableAmount: 154000,
        vatAmount: 20020,
        grandTotal: 174020,
        currency: 'NPR',
        vatPercentage: 13
      },
      calculations: {
        rawSubtotal: 168000,
        scrapExchangeDeduction: 14000,
        scrapBatteryAh: 400,
        scrapRate: 35,
        taxableAmount: 154000,
        vatAmount: 20020,
        grandTotal: 174020
      },
      payments: [
        { amount: 100000, method: 'Advance Cheque', reference: 'CHQ-NABIL-4401', date: '2026-08-08T11:30:00.000Z', status: 'VERIFIED' },
        { amount: 74020, method: 'Final Clearing', reference: 'CHQ-NABIL-4409', date: '2026-08-25T15:00:00.000Z', status: 'VERIFIED' }
      ],
      trackingHistory: [
        { step: 'CONFIRMED', time: '11:00 AM', note: 'B2B order verified against IRD PAN 304561829.' },
        { step: 'SHIPPED', time: '01:30 PM', note: 'Loaded on Tata Ace mini-truck with hoist.' },
        { step: 'DELIVERED', time: '03:45 PM', note: 'Delivered and rack mounted. 4x 100Ah spent trade-ins loaded.' }
      ]
    },

    // Period 4: Recent 30 Days (Oct 10, 2026)
    {
      orderId: 'EXD-DEMO-1004',
      id: 'EXD-DEMO-1004',
      invoiceNumber: 'INV-2026-00620',
      trackingNumber: 'NP-EXD-9004',
      date: '2026-10-10T16:20:00.000Z',
      orderDate: '10 Oct 2026, 16:20',
      orderDateFormatted: '10 Oct 2026, 16:20',
      isDemo: true,
      orderType: 'SALES_ORDER',
      status: 'DELIVERED',
      orderStatus: 'DELIVERED',
      paymentMethod: 'Khalti Digital Wallet',
      paymentStatus: 'PAID',
      assignedRider: 'Sunil Yadav (+977 9809163454 - TVS Raider)',
      dispatchVehicle: 'Pradesh 3-02-001 Pa 7890 (TVS Raider)',
      seller: {
        name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
        pan: '609823412',
        address: 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
        phone: '+9779705997260',
        email: 'batterymartbtl@gmail.com'
      },
      customer: {
        fullName: 'Subash Gurung',
        phone: '9823456789',
        email: 'subash.gurung@gmail.com',
        district: 'Kathmandu',
        city: 'Koteshwor',
        ward: '32',
        address: 'Koteshwor Mahadevsthan Chowk',
        deliveryAddress: 'Koteshwor Mahadevsthan Chowk',
        assignedRider: 'Sunil Yadav'
      },
      items: [
        {
          id: 'exide-bikerz-5ah',
          sku: 'EX-BK5LB',
          name: 'Exide Bikerz 12V 5Ah Two-Wheeler VRLA Battery',
          brand: 'Exide',
          capacity: '5Ah - 12V',
          warranty: '36 Months (18F + 18PR)',
          price: 3200,
          quantity: 1,
          itemTotal: 3200,
          image: 'assets/images/exide-bikerz.png'
        }
      ],
      pricing: {
        rawSubtotal: 3200,
        scrapExchangeDeduction: 0,
        couponDiscount: 0,
        deliveryFee: 0,
        taxableAmount: 3200,
        vatAmount: 416,
        grandTotal: 3616,
        currency: 'NPR',
        vatPercentage: 13
      },
      calculations: {
        rawSubtotal: 3200,
        scrapExchangeDeduction: 0,
        taxableAmount: 3200,
        vatAmount: 416,
        grandTotal: 3616
      },
      payments: [
        { amount: 3616, method: 'Khalti', reference: 'KHL-7821034', date: '2026-10-10T16:21:00.000Z', status: 'VERIFIED' }
      ],
      trackingHistory: [
        { step: 'CONFIRMED', time: '04:20 PM', note: 'Paid via Khalti gateway.' },
        { step: 'SHIPPED', time: '04:45 PM', note: 'Out with courier rider Sunil Yadav.' },
        { step: 'DELIVERED', time: '05:30 PM', note: 'Installed on Pulsar 150. Self-start voltage test passed.' }
      ]
    },

    // Period 5: Recent 7 Days (Oct 25, 2026 - Active Fulfillment)
    {
      orderId: 'EXD-DEMO-1005',
      id: 'EXD-DEMO-1005',
      invoiceNumber: 'INV-2026-00780',
      trackingNumber: 'NP-EXD-9005',
      date: '2026-10-25T09:45:00.000Z',
      orderDate: '25 Oct 2026, 09:45',
      orderDateFormatted: '25 Oct 2026, 09:45',
      isDemo: true,
      orderType: 'SALES_ORDER',
      status: 'SHIPPED',
      orderStatus: 'SHIPPED',
      paymentMethod: 'Cash on Delivery (COD)',
      paymentStatus: 'PENDING',
      assignedRider: 'Ramesh Thapa (+977 9801234567 - Kathmandu Central)',
      dispatchVehicle: 'Ba 2 Pa 4521 (Hero Splendor)',
      seller: {
        name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
        pan: '609823412',
        address: 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
        phone: '+9779705997260',
        email: 'batterymartbtl@gmail.com'
      },
      customer: {
        fullName: 'Ramesh Karki',
        phone: '9841556677',
        email: 'ramesh.karki@gmail.com',
        district: 'Kathmandu',
        city: 'Kathmandu',
        ward: '10',
        address: 'Bijulibazar, Anamnagar Marg',
        deliveryAddress: 'Bijulibazar, Anamnagar Marg',
        assignedRider: 'Ramesh Thapa'
      },
      items: [
        {
          id: 'exide-battery-150-invamaster',
          sku: 'EX-IMTT1500',
          name: 'Exide 150 Ah Invamaster Tubular Battery - IMTT1500',
          brand: 'Exide',
          capacity: '150Ah - 12V',
          warranty: '36 Months Official Warranty',
          price: 34000,
          quantity: 1,
          itemTotal: 34000,
          image: 'assets/images/exide-imtt1500.png'
        }
      ],
      pricing: {
        rawSubtotal: 34000,
        scrapExchangeDeduction: 0,
        couponDiscount: 0,
        deliveryFee: 0,
        taxableAmount: 34000,
        vatAmount: 4420,
        grandTotal: 38420,
        currency: 'NPR',
        vatPercentage: 13
      },
      calculations: {
        rawSubtotal: 34000,
        scrapExchangeDeduction: 0,
        taxableAmount: 34000,
        vatAmount: 4420,
        grandTotal: 38420
      },
      payments: [],
      trackingHistory: [
        { step: 'CONFIRMED', time: '09:45 AM', note: 'Customer called and verified order details.' },
        { step: 'SHIPPED', time: '11:15 AM', note: 'Handed to Ramesh Thapa. Multimeter terminal greasing kit onboard.' }
      ]
    },

    // Period 6: Today (Oct 31, 2026 - Fresh Ingestion)
    {
      orderId: 'EXD-DEMO-1006',
      id: 'EXD-DEMO-1006',
      invoiceNumber: 'INV-2026-00890',
      trackingNumber: 'NP-EXD-9006',
      date: '2026-10-31T08:30:00.000Z',
      orderDate: '31 Oct 2026, 08:30',
      orderDateFormatted: '31 Oct 2026, 08:30',
      isDemo: true,
      orderType: 'SALES_ORDER',
      status: 'PROCESSING',
      orderStatus: 'PROCESSING',
      paymentMethod: 'Cash on Delivery (COD)',
      paymentStatus: 'PENDING',
      assignedRider: 'Ramesh Thapa (+977 9801234567 - Kathmandu Central)',
      dispatchVehicle: 'Ba 2 Pa 4521 (Hero Splendor)',
      seller: {
        name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
        pan: '609823412',
        address: 'Bijulibazar, Anamnagar, Kathmandu, Nepal',
        phone: '+9779705997260',
        email: 'batterymartbtl@gmail.com'
      },
      customer: {
        fullName: 'Anup Basnet',
        phone: '9861002233',
        email: 'anup.basnet@gmail.com',
        district: 'Kathmandu',
        city: 'New Baneshwor',
        ward: '10',
        address: 'Prayag Marg, New Baneshwor',
        deliveryAddress: 'Prayag Marg, New Baneshwor',
        assignedRider: 'Ramesh Thapa'
      },
      items: [
        {
          id: 'exide-mileage-38b20r',
          sku: 'EX-ML38B20R',
          name: 'Exide Mileage ML38B20R 35Ah Compact Car Battery',
          brand: 'Exide',
          capacity: '35Ah - 12V',
          warranty: '42 Months Warranty',
          price: 9800,
          quantity: 1,
          itemTotal: 9800,
          image: 'assets/images/exide-mileage.png'
        }
      ],
      pricing: {
        rawSubtotal: 9800,
        scrapExchangeDeduction: 1225,
        scrapBatteryAh: 35,
        scrapRate: 35,
        couponDiscount: 0,
        deliveryFee: 0,
        taxableAmount: 8575,
        vatAmount: 1115,
        grandTotal: 9690,
        currency: 'NPR',
        vatPercentage: 13
      },
      calculations: {
        rawSubtotal: 9800,
        scrapExchangeDeduction: 1225,
        scrapBatteryAh: 35,
        scrapRate: 35,
        taxableAmount: 8575,
        vatAmount: 1115,
        grandTotal: 9690
      },
      payments: [],
      trackingHistory: [
        { step: 'PROCESSING', time: '08:30 AM', note: 'Order accepted at Bijulibazar hub. Battery inspected with load tester.' }
      ]
    },

    // Period 7: Quotation / Enterprise Lead
    {
      orderId: 'QUO-DEMO-2001',
      id: 'QUO-DEMO-2001',
      invoiceNumber: 'QUO-2026-00012',
      date: '2026-10-31T11:00:00.000Z',
      orderDate: '31 Oct 2026, 11:00',
      orderDateFormatted: '31 Oct 2026, 11:00',
      isDemo: true,
      orderType: 'QUOTATION',
      status: 'PENDING',
      orderStatus: 'PENDING',
      paymentMethod: 'Corporate Credit',
      paymentStatus: 'PENDING',
      assignedRider: 'Standard Dispatch',
      customer: {
        fullName: 'Everest Hospital & Research Centre',
        companyName: 'Everest Hospital & Research Centre',
        pan: '300891234',
        phone: '9801998877',
        email: 'procurement@everesthospital.com.np',
        district: 'Kathmandu',
        city: 'New Baneshwor',
        address: 'New Baneshwor, Kathmandu'
      },
      items: [
        {
          id: 'exide-inva-tubular-220',
          sku: 'EX-IT500PLUS',
          name: 'Exide Inva Tubular 220Ah Tall Tubular Inverter Battery',
          brand: 'Exide',
          capacity: '220Ah - 12V',
          warranty: '66 Months Warranty',
          price: 46000,
          quantity: 8,
          itemTotal: 368000
        }
      ],
      pricing: {
        rawSubtotal: 368000,
        scrapExchangeDeduction: 28000,
        scrapBatteryAh: 800,
        couponDiscount: 18400,
        taxableAmount: 321600,
        vatAmount: 41808,
        grandTotal: 363408
      },
      calculations: {
        rawSubtotal: 368000,
        scrapExchangeDeduction: 28000,
        grandTotal: 363408
      }
    }
  ];

  // --------------------------------------------------------------------------
  // 2. DEMO EXPENSES (Spanning Q1, Q2, Q3, and Q4)
  // --------------------------------------------------------------------------
  const demoExpenses = [
    { id: 'EXP-DEMO-01', title: 'Central Warehouse Teku Lease (Jan)', category: 'Rent', amount: 45000, paymentMethod: 'Bank Transfer', date: '2026-01-15T09:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-02', title: 'Delivery Fleet Fuel & Spark Plug Maintenance', category: 'Logistics', amount: 12500, paymentMethod: 'Cash', date: '2026-02-10T11:30:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-03', title: 'Q1 Statutory IRD VAT Audit & Filing Fee', category: 'Legal & Tax', amount: 15000, paymentMethod: 'Cheque', date: '2026-03-31T16:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-04', title: 'Central Warehouse Teku Lease (Apr)', category: 'Rent', amount: 45000, paymentMethod: 'Bank Transfer', date: '2026-04-15T09:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-05', title: 'High-Rate Discharge Battery Load Tester Tooling', category: 'Equipment', amount: 18200, paymentMethod: 'eSewa', date: '2026-05-20T13:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-06', title: 'Q2 Statutory IRD VAT Audit & Compliance', category: 'Legal & Tax', amount: 15000, paymentMethod: 'Cheque', date: '2026-06-30T16:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-07', title: 'Central Warehouse Teku Lease (Jul)', category: 'Rent', amount: 45000, paymentMethod: 'Bank Transfer', date: '2026-07-15T09:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-08', title: 'Lead-Acid Acid Neutralization & Handling Supplies', category: 'Recycling', amount: 22000, paymentMethod: 'Cheque', date: '2026-08-25T14:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-09', title: 'Q3 Statutory IRD VAT Audit & Trade Renewal', category: 'Legal & Tax', amount: 18500, paymentMethod: 'Bank Transfer', date: '2026-09-30T16:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-10', title: 'Central Warehouse Teku Lease (Oct)', category: 'Rent', amount: 45000, paymentMethod: 'Bank Transfer', date: '2026-10-15T09:00:00.000Z', isDemo: true, status: 'PAID' },
    { id: 'EXP-DEMO-11', title: 'Technician Terminal Grease & Multimeter Probes', category: 'Supplies', amount: 9400, paymentMethod: 'Cash', date: '2026-10-28T10:00:00.000Z', isDemo: true, status: 'PAID' }
  ];

  // --------------------------------------------------------------------------
  // 3. DEMO TASKS & CRM ACTIVITIES
  // --------------------------------------------------------------------------
  const demoTasks = [
    { id: 'TSK-DEMO-01', title: 'Doorstep Battery Voltage & Alternator Calibration Check', customerName: 'Rita Sharma', location: 'Thamel, Kathmandu', assignedTo: 'Ramesh Thapa', status: 'COMPLETED', date: '2026-05-14', isDemo: true },
    { id: 'TSK-DEMO-02', title: 'Inverter Charging Voltage Calibration & Float Test', customerName: 'Bikash Maharjan', location: 'Mangalbazar, Patan', assignedTo: 'Bikram Shrestha', status: 'COMPLETED', date: '2026-01-20', isDemo: true },
    { id: 'TSK-DEMO-03', title: 'Corporate Solar Battery Rack Verification (4x 200Ah)', customerName: 'Nepal Power Systems Pvt. Ltd.', location: 'Bijulibazar Corporate Tower', assignedTo: 'Sujan Karki', status: 'COMPLETED', date: '2026-08-08', isDemo: true },
    { id: 'TSK-DEMO-04', title: 'Terminal Greasing & Warranty Registration Stamp', customerName: 'Ramesh Karki', location: 'Bijulibazar Marg', assignedTo: 'Ramesh Thapa', status: 'IN_PROGRESS', date: '2026-10-25', isDemo: true },
    { id: 'TSK-DEMO-05', title: 'Follow-up Quotation for Hospital ICU Inverter Bank', customerName: 'Everest Hospital', location: 'New Baneshwor', assignedTo: 'Store Manager', status: 'PENDING', date: '2026-10-31', isDemo: true }
  ];

  // --------------------------------------------------------------------------
  // 4. DEMO AI REPORTS (Clearly Marked as Demo Output)
  // --------------------------------------------------------------------------
  const demoAiReports = [
    {
      id: 'REP-DEMO-AI-01',
      title: '[DEMO AI REPORT] Q3 Wholesale Demand & Scrap Battery Recovery Analysis',
      period: 'Q1 - Q3 2026 (Jan - Sep 2026)',
      generatedAt: '2026-10-01T09:00:00.000Z',
      status: 'DEMO_OUTPUT',
      isDemo: true,
      summary: 'Automated executive synthesis of high-capacity tubular battery movements, monsoon grid outage patterns, and scrap recycling buyback yield across Kathmandu Valley.',
      keyFindings: [
        'Monsoon lightning storms in July-August caused a 34% surge in 150Ah & 200Ah tubular inverter orders.',
        'Old battery scrap recovery rate achieved 92.4% customer participation with certified NPR 35.00/Ah buyback credit.',
        'Total demo scrap battery weight recovered: 4,120 kg recyclable lead diverted from Kathmandu landfills.'
      ],
      financialReconciliation: {
        totalDemoRevenue: 'NPR 256,539.00',
        totalDemoVatCollected: 'NPR 29,514.00',
        totalScrapRebatesDisbursed: 'NPR 20,475.00',
        auditStatus: 'Reconciled 100% with Sales Ledger'
      }
    },
    {
      id: 'REP-DEMO-AI-02',
      title: '[DEMO AI REPORT] Predictive Winter Solar Inverter Stocking Model (Kathmandu & Pokhara)',
      period: 'Q4 2026 Projection',
      generatedAt: '2026-10-20T14:30:00.000Z',
      status: 'DEMO_OUTPUT',
      isDemo: true,
      summary: 'Machine learning forecast on regional temperature drops and peak evening power demand recommending optimal safety stock.',
      keyFindings: [
        'Forecast models indicate an anticipated 22% spike in Exide Matrix 35Ah & 45Ah car batteries due to cold start cranking issues.',
        'Recommend maintaining 45 units minimum safety buffer for Invamaster IMTT1500 at Bijulibazar central warehouse.'
      ]
    }
  ];

  // Merge into existing collections preserving any non-demo real records
  const existingOrders = readJson(ORDERS_FILE, []).filter(o => o.isDemo !== true);
  writeJson(ORDERS_FILE, [...demoOrders, ...existingOrders]);

  writeJson(EXPENSES_FILE, demoExpenses);
  writeJson(TASKS_FILE, demoTasks);
  writeJson(AI_REPORTS_FILE, demoAiReports);

  writeJson(DEMO_STATE_FILE, {
    isDemoActive: true,
    demoPurged: false,
    purgedAt: null,
    purgedBy: null,
    seededAt: new Date().toISOString()
  });

  return {
    orders: demoOrders.length,
    expenses: demoExpenses.length,
    tasks: demoTasks.length,
    aiReports: demoAiReports.length
  };
}

module.exports = {
  seedDemoDataset
};
