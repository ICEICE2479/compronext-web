import type { BuilderSlot } from "./types";

/** ของเสริมนอกเหนือชิ้นส่วนหลัก (พัดลม เมาส์ คีย์บอร์ด ฯลฯ) */
export interface ExtraDockOption {
  id: string;
  name: string;
  price: number;
  platform: string;
  buyUrl: string;
  slotKey?: Exclude<BuilderSlot, "monitor">;
}

export interface ExtraDockSlotConfig {
  key: string;
  labelTh: string;
  linkedSlot?: Exclude<BuilderSlot, "monitor">;
  options: ExtraDockOption[];
}

export const EXTRA_DOCK_SLOTS: ExtraDockSlotConfig[] = [
  {
    key: "hdd",
    labelTh: "HDD",
    options: [
      {
        id: "hdd-wd-2tb",
        name: "HDD WD Blue 2TB 7200RPM SATA3",
        price: 2190,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=WD+Blue+2TB",
      },
      {
        id: "hdd-seagate-4tb",
        name: "HDD Seagate Barracuda 4TB SATA3",
        price: 3490,
        platform: "Lazada",
        buyUrl: "https://www.lazada.co.th/catalog/?q=Seagate+4TB",
      },
    ],
  },
  {
    key: "sata_ssd",
    labelTh: "SSD",
    options: [
      {
        id: "sata-samsung-870",
        name: "SSD Samsung 870 EVO 1TB 2.5\" SATA",
        price: 2990,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Samsung+870+EVO+1TB",
      },
      {
        id: "sata-kingston-960",
        name: "SSD Kingston A400 960GB SATA",
        price: 2090,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Kingston+A400+960GB",
      },
    ],
  },
  {
    key: "liquid_cooler",
    labelTh: "ชุดน้ำ",
    linkedSlot: "cooler",
    options: [
      {
        id: "cooler-aio-240-black",
        name: "Arctic Liquid Freezer III 240 A-RGB Black (ชุดน้ำปิด 240 มม.)",
        price: 3490,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Arctic+Liquid+Freezer+III+240",
        slotKey: "cooler",
      },
      {
        id: "cooler-aio-360-white",
        name: "NZXT Kraken Elite 360 RGB White (ชุดน้ำปิด 360 มม. จอ LCD)",
        price: 8990,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Kraken+Elite+360",
        slotKey: "cooler",
      },
    ],
  },
  {
    key: "air_cooler",
    labelTh: "พัดลม CPU",
    linkedSlot: "cooler",
    options: [
      {
        id: "cooler-air-ak400",
        name: "DeepCool AK400 Digital Black (ซิงก์ลม สูง 156 มม.)",
        price: 1290,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=DeepCool+AK400",
        slotKey: "cooler",
      },
    ],
  },
  {
    key: "case_fan",
    labelTh: "พัดลมเคส",
    options: [
      {
        id: "fan-lianli-sl120-inf",
        name: "พัดลมเคส Lian Li UNI FAN SL-INFINITY 120 RGB (แพ็ก 3 ตัว)",
        price: 3390,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Lian+Li+SL+Infinity",
      },
      {
        id: "fan-nzxt-f120-duo",
        name: "พัดลมเคส NZXT F120 RGB DUO Dual-Ring (แพ็ก 3 ตัว)",
        price: 2990,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=NZXT+F120+RGB+DUO",
      },
      {
        id: "fan-corsair-qx120",
        name: "พัดลมเคส Corsair iCUE LINK QX120 RGB (แพ็ก 3 ตัว)",
        price: 3690,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Corsair+QX120+RGB",
      },
      {
        id: "fan-thermalright-c12c",
        name: "พัดลมเคส Thermalright TL-C12C-S ARGB (แพ็ก 3 ตัว)",
        price: 890,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Thermalright+TL-C12C-S",
      },
      {
        id: "fan-bequiet-silentwings4",
        name: "พัดลมเคส Be Quiet! Silent Wings Pro 4 PWM (เน้นเงียบ ไร้ไฟ RGB)",
        price: 2690,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Silent+Wings+Pro+4",
      },
      {
        id: "fan-arctic-p12-argb",
        name: "พัดลมเคส Arctic P12 PWM PST A-RGB 0dB (แพ็ก 3 ตัว)",
        price: 1890,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Arctic+P12+A-RGB",
      },
    ],
  },
  {
    key: "mouse",
    labelTh: "เมาส์",
    options: [
      {
        id: "mouse-gpro-x2",
        name: "เมาส์ไร้สาย Logitech G Pro X Superlight 2 Wireless",
        price: 4990,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Superlight+2",
      },
      {
        id: "mouse-viper-v3",
        name: "เมาส์ไร้สาย Razer Viper V3 Pro Wireless",
        price: 5490,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Razer+Viper+V3+Pro",
      },
    ],
  },
  {
    key: "keyboard",
    labelTh: "คีย์บอร์ด",
    options: [
      {
        id: "kb-keychron-q1",
        name: "คีย์บอร์ดไร้สาย Keychron Q1 Pro Custom Mechanical",
        price: 6290,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Keychron+Q1+Pro",
      },
      {
        id: "kb-rog-azoth",
        name: "คีย์บอร์ด ASUS ROG Azoth 75% Wireless OLED",
        price: 7990,
        platform: "Lazada",
        buyUrl: "https://www.lazada.co.th/catalog/?q=ROG+Azoth",
      },
    ],
  },
  {
    key: "monitor",
    labelTh: "จอ",
    options: [
      {
        id: "mon-lg-27-240-oled",
        name: "จอเกมมิ่ง LG UltraGear 27 นิ้ว 2K 240Hz OLED",
        price: 25900,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=LG+27+240Hz+OLED",
      },
      {
        id: "mon-27-qhd-240-ips",
        name: "จอ ASUS ROG Strix XG27ACS 27 นิ้ว 2K 180Hz Fast IPS",
        price: 8990,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=XG27ACS",
      },
    ],
  },
  {
    key: "ups_acc",
    labelTh: "เสริม",
    options: [
      {
        id: "ups-apc-1500va",
        name: "เครื่องสำรองไฟ APC Back-UPS Pro 1500VA / 865W",
        price: 6490,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=UPS+1500VA",
      },
      {
        id: "acc-elgato-camlink",
        name: "การ์ดแคปเจอร์ Elgato HD60 X 4K60 HDR",
        price: 6290,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Elgato+HD60+X",
      },
    ],
  },
  {
    key: "gear",
    labelTh: "เกียร์",
    options: [
      {
        id: "gear-hyperx-cloud3",
        name: "หูฟังเกมมิ่งไร้สาย HyperX Cloud III Wireless",
        price: 4990,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=HyperX+Cloud+III+Wireless",
      },
      {
        id: "gear-shure-mv7",
        name: "ไมโครโฟน Shure MV7+ Podcast USB/XLR",
        price: 10900,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Shure+MV7",
      },
    ],
  },
  {
    key: "software",
    labelTh: "ซอฟต์แวร์",
    options: [
      {
        id: "sw-win11-home",
        name: "Microsoft Windows 11 Home FPP (ลิขสิทธิ์แท้ย้ายเครื่องได้)",
        price: 4590,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Windows+11+Home+FPP",
      },
      {
        id: "sw-office-2024",
        name: "Microsoft Office Home 2024 (ลิขสิทธิ์แท้ถาวร)",
        price: 4290,
        platform: "Shopee",
        buyUrl: "https://shopee.co.th/search?keyword=Office+Home+2024",
      },
    ],
  },
];

