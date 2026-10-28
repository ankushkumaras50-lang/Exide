// Exide Battery Wholesale & AET Official Partner - Comprehensive Products Catalog Data
// Prices in NPR (Nepalese Rupees)

const INITIAL_PRODUCTS = [
  {
    id: "exide-battery-150-invamaster",
    sku: "EX-IMTT1500",
    name: "Exide 150 Ah Invamaster Tubular Battery - IMTT1500",
    brand: "Exide",
    brandSlug: "exide",
    brandColor: "#ED1C24",
    categories: ["inverter-battery"],
    price: 34000,
    originalPrice: 36000,
    discount: "6% off",
    image: "assets/images/exide-imtt1500.png",
    featured: true,
    warranty: "36 Months (24 Months Free + 12 Months Pro-Rata)",
    capacity: "150Ah - 12V",
    stock: 24,
    minStock: 5,
    costPrice: 27500,
    rating: 4.9,
    reviewsCount: 142,
    shortDesc: "Heavy-duty tubular plate battery engineered for deep cyclic discharges and frequent power cuts in Nepal.",
    description: `The Exide 150 Ah Invamaster Tubular Battery (IMTT1500) is Nepal's most trusted choice for residential and commercial power backups. Built with robust tubular plates and superior spine alloy composition, it withstands prolonged power outages and extreme temperature fluctuations with minimal maintenance.`,
    features: [
      "Higher backups with minimal plate degradation",
      "Superior recovery from deep discharge cycles",
      "Special tubular technology requires lower topping-up frequency",
      "Exceptional thermal management for hot lowland climates",
      "Factory charged & ready to install"
    ],
    specs: {
      "Brand": "Exide",
      "Model": "Invamaster IMTT1500",
      "Capacity": "150 Ah @ C20",
      "Nominal Voltage": "12 V",
      "Technology": "Tall Tubular Lead-Acid",
      "Dimensions (L x W x H)": "535 x 215 x 480 mm",
      "Gross Weight": "58.1 kg",
      "Electrolyte Volume": "18.5 Litres",
      "Terminal Type": "L-Type Heavy Lead Terminals",
      "Recommended Inverter": "900VA - 1500VA Pure Sinewave"
    },
    serialNumbers: ["EX-IM-982101", "EX-IM-982102", "EX-IM-982103", "EX-IM-982104"]
  },
  {
    id: "exide-200ah-invamaster-battery",
    sku: "EX-IMTT2000",
    name: "Exide 200 Ah Invamaster Tall Tubular Battery - IMTT2000",
    brand: "Exide",
    brandSlug: "exide",
    brandColor: "#ED1C24",
    categories: ["inverter-battery"],
    price: 44499,
    originalPrice: 73100,
    discount: "39% off",
    image: "assets/images/exide-imtt2000.png",
    featured: true,
    warranty: "36 Months (24 Months Free + 12 Months Pro-Rata)",
    capacity: "200Ah - 12V",
    stock: 16,
    minStock: 4,
    costPrice: 36000,
    rating: 4.9,
    reviewsCount: 98,
    shortDesc: "Maximum capacity tall tubular battery for large homes, hospitals, and commercial office backups.",
    description: `The Exide 200 Ah Invamaster IMTT2000 provides high-capacity endurance for high power draws and extended backup demands. Engineered with thick gauntlet plates and extra electrolyte volume, it ensures uninterrupted lighting, computing, and refrigeration.`,
    features: [
      "Massive 200Ah capacity for up to 10+ hours continuous load",
      "Heavy duty tall container design preventing acid spillage",
      "Optimized for high-draw appliances including refrigerators & laser printers",
      "High purity lead-antimony spine grid alloy"
    ],
    specs: {
      "Brand": "Exide",
      "Model": "Invamaster IMTT2000",
      "Capacity": "200 Ah @ C20",
      "Nominal Voltage": "12 V",
      "Technology": "Tall Tubular Deep Cycle",
      "Dimensions (L x W x H)": "535 x 215 x 505 mm",
      "Gross Weight": "67.4 kg",
      "Electrolyte Volume": "21.0 Litres",
      "Terminal Type": "Heavy Duty Threaded Lead",
      "Recommended Inverter": "1100VA - 2500VA"
    },
    serialNumbers: ["EX-IM-200101", "EX-IM-200102", "EX-IM-200103"]
  },
  {
    id: "exide-battery-200ah-invamagic",
    sku: "EX-MGTT2000",
    name: "Exide 200 Ah Invamagic Tubular Battery - MGTT2000",
    brand: "Exide",
    brandSlug: "exide",
    brandColor: "#ED1C24",
    categories: ["inverter-battery"],
    price: 39899,
    originalPrice: 61049,
    discount: "35% off",
    image: "assets/images/exide-invamagic.png",
    featured: true,
    warranty: "48 Months (24M Replacement + 24M Pro-Rata)",
    capacity: "200Ah - 12V",
    stock: 12,
    minStock: 4,
    costPrice: 32500,
    rating: 4.8,
    reviewsCount: 76,
    shortDesc: "Premium extended warranty tubular battery with enhanced magic eye electrolyte indicators.",
    description: `Exide Invamagic MGTT2000 is built for heavy duty applications with superior active materials. Features easy float level visual indicators so you can check electrolyte levels at a single glance without unscrewing caps.`,
    features: [
      "48-Month Extended Warranty protection",
      "Integrated Magic Eye electrolyte level float indicators",
      "Fast recharge recovery even on low mains voltage (100V-280V)",
      "High vibration resistance and leak-proof vent plugs"
    ],
    specs: {
      "Brand": "Exide",
      "Model": "Invamagic MGTT2000",
      "Capacity": "200 Ah @ C20",
      "Nominal Voltage": "12 V",
      "Technology": "Super Tubular Grid",
      "Dimensions (L x W x H)": "530 x 215 x 490 mm",
      "Gross Weight": "64.2 kg",
      "Electrolyte Volume": "20.2 Litres",
      "Recommended Inverter": "1000VA - 2200VA"
    },
    serialNumbers: ["EX-MG-300101", "EX-MG-300102"]
  },
  {
    id: "exide-matrix-car-battery",
    sku: "EX-MTX80",
    name: "Exide Matrix 12V 80Ah Heavy-Duty Car Battery (MTX-80)",
    brand: "Exide",
    brandSlug: "exide",
    brandColor: "#ED1C24",
    categories: ["car-battery", "automotive-battery"],
    price: 13500,
    originalPrice: 15500,
    discount: "13% off",
    image: "assets/images/exide-matrix.png",
    featured: true,
    warranty: "60 Months (36 Months Free Replacement + 24 Months Pro-Rata)",
    capacity: "80Ah - 12V",
    stock: 18,
    minStock: 5,
    costPrice: 10200,
    rating: 4.9,
    reviewsCount: 112,
    shortDesc: "Zero-maintenance sealed car battery with 750 CCA cranking power for SUVs, 4x4s, and luxury vehicles.",
    description: `Exide Matrix delivers unmatched cranking power for demanding vehicle electronics. Built with pure calcium alloy grids and advanced labyrinth design to eliminate water loss, keeping the battery 100% maintenance-free for its entire service life.`,
    features: [
      "60-Month Warranty - Nepal's longest car battery warranty",
      "Massive 750A Cold Cranking Amps for instant winter starts",
      "Hermetically sealed maintenance-free cover",
      "Magic Eye state-of-charge indicator",
      "High shock & vibration resistance for rough Nepal roads"
    ],
    specs: {
      "Brand": "Exide",
      "Model": "Matrix MTX-80",
      "Capacity": "80 Ah",
      "CCA (Cold Cranking)": "750 A (EN)",
      "Technology": "Silver Calcium Sealed MF",
      "Dimensions (L x W x H)": "260 x 173 x 225 mm",
      "Gross Weight": "19.8 kg",
      "Terminal Layout": "Right Positive (+)",
      "Compatible Vehicles": "Toyota Hilux, Land Cruiser, Scorpio, Safari, Fortuner, Pajero"
    },
    serialNumbers: ["EX-MT-771001", "EX-MT-771002", "EX-MT-771003"]
  },
  {
    id: "exide-xplore-bike-battery",
    sku: "EX-12XL5LB",
    name: "Exide Xplore 12V 5Ah VRLA Maintenance-Free Motorcycle Battery",
    brand: "Exide",
    brandSlug: "exide",
    brandColor: "#ED1C24",
    categories: ["automotive-battery"],
    price: 2950,
    originalPrice: 3400,
    discount: "13% off",
    image: "assets/images/exide-xplore.png",
    featured: true,
    warranty: "48 Months (24M Replacement + 24M Pro-Rata)",
    capacity: "5Ah - 12V",
    stock: 35,
    minStock: 10,
    costPrice: 2100,
    rating: 4.8,
    reviewsCount: 165,
    shortDesc: "VRLA AGM spill-proof battery for Nepal's popular 125cc-250cc bikes (Pulsar, FZ, Apache, Shine).",
    description: `Exide Xplore motorcycle battery uses AGM (Absorbent Glass Mat) separators and VRLA technology. Spill-proof and leak-proof in any riding orientation, providing high cranking performance for reliable push-button electric start.`,
    features: [
      "100% Maintenance Free - Never needs water top-ups",
      "VRLA design guarantees zero acid leakage",
      "High Cold Cranking Current (70A CCA)",
      "Ultra-low self-discharge when motorcycle is parked"
    ],
    specs: {
      "Brand": "Exide",
      "Model": "Xplore 12XL5L-B",
      "Capacity": "5 Ah",
      "CCA": "70 A",
      "Dimensions (L x W x H)": "120 x 60 x 130 mm",
      "Weight": "2.1 kg",
      "Compatible Bikes": "Bajaj Pulsar 150/180/220, TVS Apache RTR, Yamaha FZ, Honda Shine, Hero Splendor"
    },
    serialNumbers: ["EX-XP-5001", "EX-XP-5002", "EX-XP-5003", "EX-XP-5004"]
  },
  {
    id: "smarten-1500-inverter-with-inbuilt-lithium-battery",
    sku: "SM-EVERON1500",
    name: "Smarten 1500VA Inverter with Inbuilt Lithium Battery: Everon 1500",
    brand: "Smarten",
    brandSlug: "smarten",
    brandColor: "#10509A",
    categories: ["inverter", "lithium-battery"],
    price: 70000,
    originalPrice: 80000,
    discount: "13% off",
    image: "assets/images/smarten-everon.png",
    featured: true,
    warranty: "60 Months Comprehensive Warranty",
    capacity: "1500VA / 1.28kWh LiFePO4",
    stock: 9,
    minStock: 2,
    costPrice: 58000,
    rating: 4.9,
    reviewsCount: 54,
    shortDesc: "All-in-one compact wall-mountable pure sinewave UPS with built-in Lithium Iron Phosphate battery.",
    description: `Smarten Everon 1500 eliminates messy external lead-acid batteries and cables. Integrated with high-grade Lithium Iron Phosphate (LiFePO4) cells boasting 3500+ charge cycles, LCD digital touchscreen display, and fast 2-hour recharge.`,
    features: [
      "Compact sleek wall-mountable or floor-standing unit",
      "Zero maintenance LiFePO4 cells with 10+ years design life",
      "Superfast charging - 0 to 100% in under 2.5 hours",
      "Smart BMS with over-temperature and short-circuit protection"
    ],
    specs: {
      "Brand": "Smarten",
      "Model": "Everon 1500",
      "Capacity": "1500 VA / 1200 W",
      "Battery Type": "Built-in Lithium LiFePO4 (12.8V 100Ah)",
      "Cycle Life": "> 3,500 Cycles @ 80% DOD",
      "Recharge Time": "2 - 3 Hours",
      "Dimensions": "420 x 310 x 180 mm",
      "Weight": "18.5 kg"
    },
    serialNumbers: ["SM-EV-1501", "SM-EV-1502"]
  },
  {
    id: "genus-maxillion-1000va-pure-sinewave-lithium-inverter-battery",
    sku: "GN-MAX1000",
    name: "Genus Maxilion 1000VA UPS with Inbuilt Lithium Battery",
    brand: "Genus",
    brandSlug: "genus",
    brandColor: "#0161A8",
    categories: ["inverter", "lithium-battery", "inverter-battery"],
    price: 75000,
    originalPrice: 75000,
    discount: "Popular",
    image: "assets/images/genus-maxilion.webp",
    featured: true,
    warranty: "60 Months Comprehensive Warranty",
    capacity: "1000VA / 12.8V 100Ah LiFePO4",
    stock: 7,
    minStock: 2,
    costPrice: 62000,
    rating: 4.7,
    reviewsCount: 39,
    shortDesc: "Next-gen silent power backup system with integrated smart Lithium battery and interactive LCD display.",
    description: `Genus Maxilion 1000VA is designed for modern smart homes and executive offices. Whisper-quiet operation, pure sinewave output safe for sensitive computers and medical equipment, and high-energy density lithium cells.`,
    features: [
      "Integrated LiFePO4 Lithium battery with Smart BMS",
      "Sleek aesthetics matching contemporary home decor",
      "Fast charging allows full backup even with 3-hour power slots",
      "Comprehensive multi-color LCD status indicator"
    ],
    specs: {
      "Brand": "Genus",
      "Model": "Maxilion 1000",
      "Rating": "1000 VA / 800 W",
      "Battery Capacity": "1280 Wh (12.8V 100Ah LiFePO4)",
      "Output Waveform": "Pure Sinewave (<3% THD)",
      "Warranty": "5 Years on complete system",
      "Weight": "16.8 kg"
    },
    serialNumbers: ["GN-MX-1001", "GN-MX-1002"]
  },
  {
    id: "smarten-100ah-12-6v-inverter-lithium-batery",
    sku: "SM-LITH100",
    name: "Smarten 100Ah 12.8V Lithium Battery for Inverter: Energia 100",
    brand: "Smarten",
    brandSlug: "smarten",
    brandColor: "#10509A",
    categories: ["lithium-battery"],
    price: 45500,
    originalPrice: 55000,
    discount: "17% off",
    image: "assets/images/smarten-lithium.png",
    featured: true,
    warranty: "36 Months Manufacturer Warranty",
    capacity: "100Ah - 12.8V LiFePO4",
    stock: 14,
    minStock: 3,
    costPrice: 37000,
    rating: 4.8,
    reviewsCount: 42,
    shortDesc: "Direct drop-in replacement lithium battery for existing home inverters and solar systems.",
    description: `Upgrade your existing inverter system with Smarten Energia 12.8V 100Ah LiFePO4 battery. Weighs 70% less than standard lead-acid tubular batteries while delivering 3x longer operational lifespan and 2-hour quick charging.`,
    features: [
      "Lightweight - only 12 kg (vs 58 kg tubular battery)",
      "3000+ deep discharge cycles",
      "Built-in active BMS cell balancer",
      "Compatible with almost all 12V inverters"
    ],
    specs: {
      "Brand": "Smarten",
      "Model": "Energia 100Ah",
      "Chemistry": "Lithium Iron Phosphate (LiFePO4)",
      "Rated Voltage": "12.8 V",
      "Energy": "1280 Wh",
      "Max Continuous Discharge": "100 A",
      "Dimensions": "330 x 172 x 215 mm",
      "Weight": "11.8 kg"
    },
    serialNumbers: ["SM-EN-101", "SM-EN-102", "SM-EN-103"]
  },
  {
    id: "livfast-tubular-battery-150-ah-mxtt-1845",
    sku: "LF-MXTT1845",
    name: "Livfast Tubular Battery 150 Ah - MXTT 1845",
    brand: "Livfast",
    brandSlug: "livfast",
    brandColor: "#FF5F1D",
    categories: ["inverter-battery"],
    price: 26999,
    originalPrice: 45600,
    discount: "41% off",
    image: "assets/images/livfast-1845.webp",
    featured: false,
    warranty: "45 Months (24M Free + 21M Pro-Rata)",
    capacity: "150Ah - 12V",
    stock: 11,
    minStock: 4,
    costPrice: 21500,
    rating: 4.6,
    reviewsCount: 68,
    shortDesc: "Value-packed 150Ah tubular battery with fast charging 3D grid design for daily load-shedding.",
    description: `Livfast MXTT 1845 is built with heavy duty tubular plates and specialized oxide paste that absorbs charge quickly during brief grid availability windows. Ideal for budget-conscious families across Nepal.`,
    features: [
      "41% Super Deal discount for Nepal buyers",
      "High surface area tubular gauntlet plates",
      "Ceramic water level indicators included",
      "Low antimony alloy reduces self-discharge"
    ],
    specs: {
      "Brand": "Livfast",
      "Model": "MXTT 1845",
      "Capacity": "150 Ah",
      "Voltage": "12 V",
      "Weight": "52.5 kg",
      "Warranty": "45 Months"
    },
    serialNumbers: ["LF-1845-01", "LF-1845-02"]
  },
  {
    id: "livfast-tubular-battery-160-ah-mxtt-1954",
    sku: "LF-MXTT1954",
    name: "Livfast Tubular Battery 160 Ah - MXTT 1954",
    brand: "Livfast",
    brandSlug: "livfast",
    brandColor: "#FF5F1D",
    categories: ["inverter-battery"],
    price: 30499,
    originalPrice: 49400,
    discount: "38% off",
    image: "assets/images/livfast-1954.png",
    featured: false,
    warranty: "54 Months (30M Free + 24M Pro-Rata)",
    capacity: "160Ah - 12V",
    stock: 8,
    minStock: 3,
    costPrice: 24200,
    rating: 4.7,
    reviewsCount: 52,
    shortDesc: "Extra 160Ah capacity tubular battery with an extended 54-month warranty package.",
    description: `Livfast MXTT 1954 provides enhanced 160Ah storage with a robust 54-month warranty. Designed to deliver consistent voltage curve even during peak appliance power surges.`,
    features: [
      "Extra 10Ah capacity buffer over standard 150Ah units",
      "54-Month extensive manufacturer warranty",
      "Special micro-porous separators",
      "High temperature stability"
    ],
    specs: {
      "Brand": "Livfast",
      "Model": "MXTT 1954",
      "Capacity": "160 Ah",
      "Voltage": "12 V",
      "Weight": "55.0 kg",
      "Warranty": "54 Months"
    },
    serialNumbers: ["LF-1954-01", "LF-1954-02"]
  },
  {
    id: "sf-150-ah-tubular-battery-tt60s150",
    sku: "SF-TT60S150",
    name: "SF Sonic 150Ah Tubular Battery - TT60S150",
    brand: "SF Sonic",
    brandSlug: "sf-sonic",
    brandColor: "#2E3077",
    categories: ["inverter-battery"],
    price: 31500,
    originalPrice: 34000,
    discount: "7% off",
    image: "assets/images/sf-150ah.png",
    featured: false,
    warranty: "60 Months (36M Free + 24M Pro-Rata)",
    capacity: "150Ah - 12V",
    stock: 15,
    minStock: 4,
    costPrice: 25500,
    rating: 4.8,
    reviewsCount: 63,
    shortDesc: "From the makers of Exide: Ultra-durable 60-month warranty tall tubular inverter battery.",
    description: `SF Sonic TT60S150 is backed by Exide Industries technology, offering high discharge endurance and robust tubular spines that deliver high amp-hour efficiency in heavy cyclic applications.`,
    features: [
      "5-Year (60 Month) complete warranty confidence",
      "Spine casted at high pressure (100 bar) for pore-free structure",
      "High antimony spine alloy with selenium grains",
      "Optimized for frequent deep discharge recovery"
    ],
    specs: {
      "Brand": "SF Sonic (An Exide Group Brand)",
      "Model": "TT60S150",
      "Capacity": "150 Ah",
      "Voltage": "12 V",
      "Dimensions": "505 x 190 x 415 mm",
      "Weight": "54.8 kg"
    },
    serialNumbers: ["SF-TT-1501", "SF-TT-1502", "SF-TT-1503"]
  },
  {
    id: "eastman-1500va-inverter-with-150ah-lithium-battery",
    sku: "EM-SOLAR1500",
    name: "Eastman 1000VA Solar Inverter with 150Ah Lithium Battery",
    brand: "Eastman",
    brandSlug: "eastman",
    brandColor: "#253B81",
    categories: ["inverter", "inverter-battery", "lithium-battery"],
    price: 100000,
    originalPrice: 100000,
    discount: "Solar Ready",
    image: "assets/images/eastman-solar.png",
    featured: true,
    warranty: "60 Months Warranty",
    capacity: "1000VA + 150Ah LiFePO4",
    stock: 5,
    minStock: 2,
    costPrice: 82000,
    rating: 4.9,
    reviewsCount: 31,
    shortDesc: "Complete plug-and-play solar hybrid power station with 150Ah LiFePO4 lithium storage.",
    description: `Eastman Solar Lithium Station offers a complete integrated solar hybrid inverter with MPPT solar charger controller and 150Ah high-capacity LiFePO4 battery pack inside a single ventilated metal chassis.`,
    features: [
      "Inbuilt MPPT Solar Charge Controller (supports up to 1000W PV)",
      "150Ah heavy LiFePO4 lithium battery with 1920Wh capacity",
      "Dual charging from Solar & Nepal Grid (NEA)",
      "Smart Mobile App Bluetooth monitoring"
    ],
    specs: {
      "Brand": "Eastman",
      "Model": "Solar Station 1000/150L",
      "Inverter Capacity": "1000 VA / 800 W",
      "Battery Capacity": "12.8V 150Ah LiFePO4",
      "Solar Input": "Up to 1000W VOC 50V",
      "Weight": "24.5 kg"
    },
    serialNumbers: ["EM-SL-101", "EM-SL-102"]
  },
  {
    id: "geon-1250-inverter-with-inbuilt-lithium-battery",
    sku: "GN-FLITH1250",
    name: "Geon 1250VA Inverter with Inbuilt Lithium Battery: Gelithium 1250",
    brand: "Geon",
    brandSlug: "geon",
    brandColor: "#004B85",
    categories: ["inverter", "lithium-battery"],
    price: 70000,
    originalPrice: 70000,
    discount: "Top Rated",
    image: "assets/images/geon-lithium.png",
    featured: false,
    warranty: "60 Months Warranty",
    capacity: "1250VA / 1.28kWh",
    stock: 6,
    minStock: 2,
    costPrice: 56000,
    rating: 4.7,
    reviewsCount: 28,
    shortDesc: "High efficiency smart lithium inverter engineered for uninterrupted power supply in Nepal.",
    description: `Geon Gelithium 1250 is an advanced UPS system featuring intelligent battery temperature compensation, digital harmonic filter, and quick switchover under 10ms so your desktop PCs never restart during cuts.`,
    features: [
      "Sub-10ms transfer time - No PC or Router reboots",
      "Zero fume, clean indoor friendly lithium design",
      "Smart overload auto-reset mechanism",
      "High surge capability (up to 2500VA for pump/motor starts)"
    ],
    specs: {
      "Brand": "Geon",
      "Model": "Gelithium 1250",
      "Inverter Rating": "1250 VA / 1000 W",
      "Battery Storage": "12.8V 100Ah LiFePO4",
      "Dimensions": "400 x 300 x 170 mm",
      "Weight": "17.0 kg"
    },
    serialNumbers: ["GN-FL-1201"]
  },
  {
    id: "livfast-home-ups-1125",
    sku: "LF-RENO1125",
    name: "Livfast 1175 Pure Sinewave Inverter (Reno 1125)",
    brand: "Livfast",
    brandSlug: "livfast",
    brandColor: "#FF5F1D",
    categories: ["inverter"],
    price: 12000,
    originalPrice: 13000,
    discount: "8% off",
    image: "assets/images/livfast-reno.png",
    featured: false,
    warranty: "24 Months Comprehensive Warranty",
    capacity: "1050VA / 12V",
    stock: 19,
    minStock: 5,
    costPrice: 9400,
    rating: 4.6,
    reviewsCount: 47,
    shortDesc: "Reliable pure sinewave home inverter with 3-stage adaptive charging for tubular batteries.",
    description: `Livfast Reno 1125 provides pure sinewave AC output that protects domestic appliances from humming noise and thermal wear. Equipped with dual charging modes for both Tubular and Flat Plate batteries.`,
    features: [
      "Pure Sinewave output - Zero humming in fans & lights",
      "Adaptive battery charging algorithm extends battery life by 25%",
      "Wide input voltage window (90V - 290V) handles low village voltage",
      "High load capability for mix of lighting, fans, and computers"
    ],
    specs: {
      "Brand": "Livfast",
      "Model": "Reno 1125 (1050VA)",
      "System Voltage": "12 V DC",
      "Max Recommended Battery": "150Ah - 220Ah (1 Unit)",
      "Output": "230V AC ± 5%, 50Hz",
      "Weight": "9.8 kg"
    },
    serialNumbers: ["LF-RN-1101", "LF-RN-1102", "LF-RN-1103"]
  }
];

const BRANDS_LIST = [
  { name: "Exide", slug: "exide", logo: "assets/brands/exide-logo.webp", color: "#ED1C24", desc: "India & Nepal's #1 Battery Giant", featured: true },
  { name: "Amaron Quanta", slug: "amaron-quanta", logo: "assets/brands/amaron-quanta.webp", color: "#618520", desc: "Long Life VRLA & Industrial Batteries" },
  { name: "Livfast", slug: "livfast", logo: "assets/brands/livfast.webp", color: "#FF5F1D", desc: "Fast Charging Inverters & Tubular Batteries" },
  { name: "SF Sonic", slug: "sf-sonic", logo: "assets/brands/sf-sonic.webp", color: "#2E3077", desc: "Exide Group Power Innovation" },
  { name: "Smarten", slug: "smarten", logo: "assets/brands/smarten.webp", color: "#10509A", desc: "Next-gen Lithium Inverters & Solar MPPT" },
  { name: "Eastman", slug: "eastman", logo: "assets/brands/eastman.webp", color: "#253B81", desc: "Solar Hybrid & Tall Tubular Power" },
  { name: "Genus", slug: "genus", logo: "assets/brands/genus.webp", color: "#0161A8", desc: "Smart Digital Sinewave UPS Systems" },
  { name: "Geon", slug: "geon", logo: "assets/brands/geon.png", color: "#004B85", desc: "Lithium Power Stations & Inverters" },
  { name: "Luminous", slug: "luminous", logo: "assets/brands/luminous.webp", color: "#0A387E", desc: "Global Backup & Solar Solutions" },
  { name: "Livguard", slug: "livguard", logo: "assets/brands/livguard.webp", color: "#E02636", desc: "Rugged Power Storage Solutions" },
  { name: "Fuji Electric", slug: "fuji-electric", logo: "assets/brands/fuji-electric.webp", color: "#C00000", desc: "Japanese Precision Online UPS" },
  { name: "Delta", slug: "delta", logo: "assets/brands/delta.png", color: "#0083CA", desc: "Industrial Grade Power Electronics" },
  { name: "HBL", slug: "hbl", logo: "assets/brands/hbl.webp", color: "#003366", desc: "Specialized VRLA Batteries" },
  { name: "Mtekpower", slug: "mtekpower", logo: "assets/brands/mtekpower.png", color: "#D71920", desc: "Tubular Inverter Backup" },
  { name: "Sukam", slug: "sukam", logo: "assets/brands/sukam.webp", color: "#005596", desc: "Pioneering Sinewave & Solar Inverters" },
  { name: "Suntek", slug: "suntek", logo: "assets/brands/suntek.png", color: "#E86C00", desc: "Solar PCUs & Charge Controllers" }
];

const CATEGORIES_LIST = [
  { id: "inverter-battery", name: "Inverter Battery", icon: "battery-charging", count: 8, desc: "Tall tubular, short tubular & flat plate inverter batteries" },
  { id: "car-battery", name: "Car Battery", icon: "car", count: 5, desc: "Sealed maintenance-free batteries for hatchbacks, sedans & SUVs" },
  { id: "automotive-battery", name: "Automotive Battery", icon: "truck", count: 6, desc: "Commercial vehicle, tractor, bus & motorcycle batteries" },
  { id: "lithium-battery", name: "Lithium Battery", icon: "zap", count: 6, desc: "LiFePO4 high-cycle lithium storage packs for homes & solar" },
  { id: "inverter", name: "Inverter & Home UPS", icon: "cpu", count: 6, desc: "Pure sinewave inverters, digital UPS & integrated power units" },
  { id: "solar-hybrid-pcu", name: "Solar Hybrid PCU", icon: "sun", count: 3, desc: "Solar inverters with smart MPPT/PWM solar charge priority" },
  { id: "online-ups", name: "Online UPS", icon: "server", count: 2, desc: "Zero transfer time online power backup for medical & servers" },
  { id: "solar-charge-controller", name: "Solar Charge Controller", icon: "sun-medium", count: 3, desc: "MPPT & PWM intelligent solar controllers" },
  { id: "voltage-stabilizer", name: "Voltage Stabilizer", icon: "sliders", count: 2, desc: "Automatic digital voltage regulators for AC and refrigerators" },
  { id: "erickshaw-battery", name: "Erickshaw Battery", icon: "activity", count: 2, desc: "Deep cycle traction batteries for Nepal electric three-wheelers" },
  { id: "vrla-battery", name: "VRLA Battery", icon: "shield-check", count: 3, desc: "Sealed lead acid AGM batteries for lifts, telecom & UPS" },
  { id: "battery-charger", name: "Battery Charger", icon: "power", count: 2, desc: "Heavy duty workshop & commercial battery fast chargers" }
];

const NEPAL_LOCATIONS = {
  provinces: [
    { id: "bagmati", name: "Bagmati Province (बागमती प्रदेश)", districts: ["Kathmandu", "Lalitpur", "Bhaktapur", "Chitwan", "Makwanpur", "Kavrepalanchok", "Dhading", "Nuwakot"] },
    { id: "lumbini", name: "Lumbini Province (लुम्बिनी प्रदेश)", districts: ["Rupandehi (Butwal/Bhairahawa)", "Kapilvastu", "Palpa", "Nawalparasi West", "Dang", "Banke (Nepalgunj)", "Bardiya"] },
    { id: "gandaki", name: "Gandaki Province (गण्डकी प्रदेश)", districts: ["Kaski (Pokhara)", "Tanahun", "Gorkha", "Syangja", "Nawalpur", "Lamjung"] },
    { id: "koshi", name: "Koshi Province (कोशी प्रदेश)", districts: ["Morang (Biratnagar)", "Sunsari (Itahari/Dharan)", "Jhapa (Birtamod)", "Ilam", "Udayapur"] },
    { id: "madhesh", name: "Madhesh Province (मधेश प्रदेश)", districts: ["Parsa (Birgunj)", "Dhanusha (Janakpur)", "Bara", "Rautahat", "Siraha", "Saptari", "Sarlahi", "Mahottari"] },
    { id: "karnali", name: "Karnali Province (कर्णाली प्रदेश)", districts: ["Surkhet", "Dailekh", "Jumla", "Salyan", "Rukum West"] },
    { id: "sudurpashchim", name: "Sudurpashchim Province (सुदूरपश्चिम प्रदेश)", districts: ["Kailali (Dhangadhi)", "Kanchanpur (Mahendranagar)", "Dadeldhura", "Doti", "Baitadi"] }
  ],
  outlets: [
    { city: "Kathmandu - Bijulibazar (Head Office)", address: "Bijulibazar, Anamnagar (near to BhatBhateni), Kathmandu", phone: "+9779705997260", time: "Sun-Fri: 9:00 AM - 7:30 PM (Sat: 10:00 AM - 5:00 PM)", lat: 27.6936, lng: 85.3312 },
    { city: "Kathmandu - Teku Outlet", address: "Teku Link Road (Near Auto Complex), Kathmandu", phone: "+9779705997260", time: "Sun-Fri: 9:30 AM - 6:30 PM", lat: 27.6974, lng: 85.3056 },
    { city: "Kathmandu - Putalisadak", address: "Putalisadak Chowk, Opposite Star Mall, Kathmandu", phone: "+9779705997260", time: "Sun-Fri: 9:30 AM - 6:30 PM", lat: 27.7051, lng: 85.3214 },
    { city: "Butwal Branch Outlet", address: "Traffic Chowk / Hospital Line, Butwal, Rupandehi", phone: "+9779705997260", time: "Sun-Fri: 9:00 AM - 7:00 PM", lat: 27.7006, lng: 83.4484 },
    { city: "Pokhara Outlet", address: "Chipledhunga / New Road, Pokhara, Kaski", phone: "+9779705997260", time: "Sun-Fri: 9:00 AM - 7:00 PM", lat: 28.2163, lng: 83.9856 },
    { city: "Chitwan Outlet", address: "Shahid Chowk, Narayangarh, Chitwan", phone: "+9779705997260", time: "Sun-Fri: 9:00 AM - 7:00 PM", lat: 27.6931, lng: 84.4278 },
    { city: "Itahari Outlet", address: "Main Road, Near Bus Park, Itahari, Sunsari", phone: "+9779705997260", time: "Sun-Fri: 9:00 AM - 7:00 PM", lat: 26.6667, lng: 87.2833 }
  ]
};

const VEHICLE_DATABASE = {
  cars: [
    { make: "Hyundai", models: ["Creta", "i20", "Grand i10", "Venue", "Tucson", "Santro"], battery: "exide-matrix-car-battery" },
    { make: "Suzuki / Maruti", models: ["Swift", "Baleno", "Brezza", "WagonR", "Alto 800", "Dzire"], battery: "exide-matrix-car-battery" },
    { make: "Toyota", models: ["Hilux", "Fortuner", "Corolla Cross", "Innova", "RAV4"], battery: "exide-matrix-car-battery" },
    { make: "Mahindra", models: ["Scorpio", "Bolero", "XUV700", "Thar", "XUV300"], battery: "exide-matrix-car-battery" },
    { make: "Tata", models: ["Nexon", "Punch", "Harrier", "Tiago", "Safari"], battery: "exide-matrix-car-battery" },
    { make: "Kia", models: ["Seltos", "Sonet", "Carens", "Sportage"], battery: "exide-matrix-car-battery" }
  ],
  bikes: [
    { make: "Bajaj", models: ["Pulsar 150", "Pulsar 220F", "Pulsar NS200", "Dominar 400", "Platina 100"], battery: "exide-xplore-bike-battery" },
    { make: "Yamaha", models: ["FZ-S V3/V4", "R15 V4", "MT-15", "RayZR 125", "Aerox 155"], battery: "exide-xplore-bike-battery" },
    { make: "Honda", models: ["Shine 125", "Dio 110/125", "Activa 6G", "Hornet 2.0", "XR 190L"], battery: "exide-xplore-bike-battery" },
    { make: "TVS", models: ["Apache RTR 160", "Apache RTR 200 4V", "NTORQ 125", "Raider 125"], battery: "exide-xplore-bike-battery" },
    { make: "Royal Enfield", models: ["Classic 350", "Hunter 350", "Himalayan 450", "Bullet 350"], battery: "exide-xplore-bike-battery" }
  ]
};


// ============================================================================
// SUPABASE REALTIME & CLOUD HYDRATION LAYER
// ============================================================================
if (typeof window !== 'undefined') {
  window.productsCatalog = [...INITIAL_PRODUCTS];
  window.PRODUCTS = window.productsCatalog;
  window.BRANDS_DATA = BRANDS_LIST;
  window.CATEGORIES_DATA = CATEGORIES_LIST;
  window.NEPAL_LOCATIONS = NEPAL_LOCATIONS;
  window.VEHICLE_DATABASE = VEHICLE_DATABASE;
}

/**
 * Loads active products from Supabase and hydrates catalog
 * @returns {Promise<Array>} List of product objects
 */
async function loadProductsFromSupabase() {
  if (typeof window === 'undefined' || !window.supabaseClient) {
    return (typeof window !== 'undefined' ? window.productsCatalog : INITIAL_PRODUCTS);
  }

  try {
    const { data, error } = await window.supabaseClient
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('retail_price', { ascending: true });

    if (error) {
      console.warn('Supabase products fetch notification:', error.message);
      return window.productsCatalog;
    }

    if (data && data.length > 0) {
      const mapped = data.map(item => {
        const fb = INITIAL_PRODUCTS.find(p => p.id === item.id || p.sku === item.sku) || {};
        return {
          id: item.id || fb.id,
          sku: item.sku || fb.sku,
          name: item.name || item.title || fb.name,
          brand: item.brand || fb.brand,
          brandSlug: (item.brand || fb.brand || 'exide').toLowerCase().replace(/[\s_]+/g, '-'),
          brandColor: fb.brandColor || '#ED1C24',
          categories: item.category_id ? [item.category_id] : (fb.categories || ['inverter-battery']),
          price: Number(item.retail_price || item.price || fb.price || 0),
          originalPrice: item.wholesale_price ? Number(item.wholesale_price) : fb.originalPrice,
          discount: fb.discount || '',
          image: item.image_url || fb.image || 'assets/images/default-battery.png',
          featured: item.is_featured !== undefined ? Boolean(item.is_featured) : Boolean(fb.featured),
          warranty: item.warranty || fb.warranty || ((item.warranty_months || 36) + ' Months Warranty'),
          capacity: item.capacity || fb.capacity || ((item.capacity_ah || 150) + 'Ah'),
          stock: item.stock !== undefined ? item.stock : (fb.stock || 20),
          minStock: item.reorder_threshold !== undefined ? item.reorder_threshold : (fb.minStock || 5),
          costPrice: Number(item.cost_price || fb.costPrice || 0),
          rating: fb.rating || 4.9,
          reviewsCount: fb.reviewsCount || 48,
          shortDesc: item.short_desc || fb.shortDesc || '',
          description: item.description || fb.description || '',
          features: Array.isArray(item.features) ? item.features : (fb.features || []),
          specs: (typeof item.specifications === 'object' && item.specifications) ? item.specifications : (fb.specs || {}),
          serialNumbers: fb.serialNumbers || []
        };
      });

      window.productsCatalog = mapped;
      window.PRODUCTS = mapped;
      console.log('✅ Loaded ' + mapped.length + ' live products from Supabase.');

      if (typeof renderProductsCatalog === 'function') {
        renderProductsCatalog();
      } else if (typeof renderProducts === 'function') {
        renderProducts(mapped);
      }

      window.dispatchEvent(new CustomEvent('products:loaded', { detail: mapped }));
    }

    return window.productsCatalog;
  } catch (err) {
    console.warn('Network error connecting to Supabase:', err.message);
    return window.productsCatalog;
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadProductsFromSupabase();
    });
  } else {
    loadProductsFromSupabase();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    INITIAL_PRODUCTS,
    BRANDS_LIST,
    CATEGORIES_LIST,
    NEPAL_LOCATIONS,
    VEHICLE_DATABASE,
    loadProductsFromSupabase
  };
}
