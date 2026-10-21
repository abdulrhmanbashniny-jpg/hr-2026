/** Reference data for the Kingdom: administrative regions, the main cities with coordinates, trades. */

export const REGIONS = [
  { code: 'RIY', nameAr: 'منطقة الرياض', nameEn: 'Riyadh Region' },
  { code: 'MAK', nameAr: 'منطقة مكة المكرمة', nameEn: 'Makkah Region' },
  { code: 'MAD', nameAr: 'منطقة المدينة المنورة', nameEn: 'Madinah Region' },
  { code: 'EAS', nameAr: 'المنطقة الشرقية', nameEn: 'Eastern Province' },
  { code: 'QAS', nameAr: 'منطقة القصيم', nameEn: 'Qassim Region' },
  { code: 'ASR', nameAr: 'منطقة عسير', nameEn: 'Asir Region' },
  { code: 'TAB', nameAr: 'منطقة تبوك', nameEn: 'Tabuk Region' },
  { code: 'HAI', nameAr: 'منطقة حائل', nameEn: 'Hail Region' },
  { code: 'NBR', nameAr: 'منطقة الحدود الشمالية', nameEn: 'Northern Borders' },
  { code: 'JAZ', nameAr: 'منطقة جازان', nameEn: 'Jazan Region' },
  { code: 'NAJ', nameAr: 'منطقة نجران', nameEn: 'Najran Region' },
  { code: 'BAH', nameAr: 'منطقة الباحة', nameEn: 'Al Bahah Region' },
  { code: 'JOF', nameAr: 'منطقة الجوف', nameEn: 'Al Jawf Region' },
];

export const CITIES = [
  { id: 'riyadh', regionCode: 'RIY', nameAr: 'الرياض', nameEn: 'Riyadh', lat: 24.7136, lng: 46.6753 },
  { id: 'kharj', regionCode: 'RIY', nameAr: 'الخرج', nameEn: 'Al Kharj', lat: 24.1556, lng: 47.312 },
  { id: 'jeddah', regionCode: 'MAK', nameAr: 'جدة', nameEn: 'Jeddah', lat: 21.5433, lng: 39.1728 },
  { id: 'makkah', regionCode: 'MAK', nameAr: 'مكة المكرمة', nameEn: 'Makkah', lat: 21.3891, lng: 39.8579 },
  { id: 'taif', regionCode: 'MAK', nameAr: 'الطائف', nameEn: 'Taif', lat: 21.2703, lng: 40.4158 },
  { id: 'madinah', regionCode: 'MAD', nameAr: 'المدينة المنورة', nameEn: 'Madinah', lat: 24.5247, lng: 39.5692 },
  { id: 'yanbu', regionCode: 'MAD', nameAr: 'ينبع', nameEn: 'Yanbu', lat: 24.0895, lng: 38.0618 },
  { id: 'dammam', regionCode: 'EAS', nameAr: 'الدمام', nameEn: 'Dammam', lat: 26.4207, lng: 50.0888 },
  { id: 'khobar', regionCode: 'EAS', nameAr: 'الخبر', nameEn: 'Al Khobar', lat: 26.2172, lng: 50.1971 },
  { id: 'dhahran', regionCode: 'EAS', nameAr: 'الظهران', nameEn: 'Dhahran', lat: 26.2361, lng: 50.0393 },
  { id: 'jubail', regionCode: 'EAS', nameAr: 'الجبيل', nameEn: 'Jubail', lat: 27.0046, lng: 49.646 },
  { id: 'ahsa', regionCode: 'EAS', nameAr: 'الأحساء', nameEn: 'Al Ahsa', lat: 25.3647, lng: 49.5876 },
  { id: 'qatif', regionCode: 'EAS', nameAr: 'القطيف', nameEn: 'Qatif', lat: 26.5196, lng: 50.0115 },
  { id: 'hafr', regionCode: 'EAS', nameAr: 'حفر الباطن', nameEn: 'Hafar Al Batin', lat: 28.4328, lng: 45.9708 },
  { id: 'buraidah', regionCode: 'QAS', nameAr: 'بريدة', nameEn: 'Buraidah', lat: 26.3592, lng: 43.9818 },
  { id: 'unaizah', regionCode: 'QAS', nameAr: 'عنيزة', nameEn: 'Unaizah', lat: 26.0843, lng: 43.9935 },
  { id: 'abha', regionCode: 'ASR', nameAr: 'أبها', nameEn: 'Abha', lat: 18.2164, lng: 42.5053 },
  { id: 'khamis', regionCode: 'ASR', nameAr: 'خميس مشيط', nameEn: 'Khamis Mushait', lat: 18.3, lng: 42.7333 },
  { id: 'tabuk', regionCode: 'TAB', nameAr: 'تبوك', nameEn: 'Tabuk', lat: 28.3835, lng: 36.5662 },
  { id: 'hail', regionCode: 'HAI', nameAr: 'حائل', nameEn: 'Hail', lat: 27.5114, lng: 41.7208 },
  { id: 'arar', regionCode: 'NBR', nameAr: 'عرعر', nameEn: 'Arar', lat: 30.9753, lng: 41.0381 },
  { id: 'jazan', regionCode: 'JAZ', nameAr: 'جازان', nameEn: 'Jazan', lat: 16.8892, lng: 42.5511 },
  { id: 'najran', regionCode: 'NAJ', nameAr: 'نجران', nameEn: 'Najran', lat: 17.4917, lng: 44.1322 },
  { id: 'baha', regionCode: 'BAH', nameAr: 'الباحة', nameEn: 'Al Bahah', lat: 20.0129, lng: 41.4677 },
  { id: 'sakaka', regionCode: 'JOF', nameAr: 'سكاكا', nameEn: 'Sakaka', lat: 29.9697, lng: 40.2064 },
];

export const TRADES = [
  { id: 'interior', nameAr: 'دهانات داخلية', nameEn: 'Interior painting' },
  { id: 'exterior', nameAr: 'دهانات خارجية', nameEn: 'Exterior painting' },
  { id: 'decorative', nameAr: 'دهانات ديكورية', nameEn: 'Decorative finishes' },
  { id: 'epoxy', nameAr: 'أرضيات إيبوكسي', nameEn: 'Epoxy floors' },
  { id: 'waterproofing', nameAr: 'عزل مائي وحراري', nameEn: 'Waterproofing' },
  { id: 'gypsum', nameAr: 'جبس وأسقف', nameEn: 'Gypsum and ceilings' },
  { id: 'wallpaper', nameAr: 'ورق جدران', nameEn: 'Wallpaper' },
  { id: 'wood', nameAr: 'دهانات أخشاب', nameEn: 'Wood finishes' },
  { id: 'industrial', nameAr: 'دهانات صناعية', nameEn: 'Industrial coatings' },
].map((t, i) => ({ ...t, sortOrder: i }));

/** Fictional brands and dealers, so the demo never implies a partnership with a real company. */
export const BRANDS = [
  { key: 'sahara', name: 'Sahara Coatings', nameAr: 'دهانات الصحراء' },
  { key: 'najd', name: 'Najd Paints', nameAr: 'ألوان نجد' },
  { key: 'gulfpro', name: 'Gulf Pro Coatings', nameAr: 'الخليج برو' },
  { key: 'redsea', name: 'Red Sea Paints', nameAr: 'دهانات البحر الأحمر' },
];

export const DEALERS = [
  { key: 'd1', brand: 'sahara', name: 'معرض الصحراء للدهانات — الملقا', vat: '310000000100003', cityId: 'riyadh', signed: true },
  { key: 'd2', brand: 'najd', name: 'مركز ألوان نجد — السويدي', vat: '310000000200003', cityId: 'riyadh', signed: true },
  { key: 'd3', brand: 'gulfpro', name: 'الخليج برو — الخبر', vat: '310000000300003', cityId: 'khobar', signed: true },
  { key: 'd4', brand: 'redsea', name: 'البحر الأحمر للدهانات — الروضة', vat: '310000000400003', cityId: 'jeddah', signed: false },
  { key: 'd5', brand: 'sahara', name: 'الصحراء — بريدة', vat: '310000000500003', cityId: 'buraidah', signed: false },
  { key: 'd6', brand: 'najd', name: 'ألوان نجد — أبها', vat: '310000000600003', cityId: 'abha', signed: false },
];

export const REWARDS = [
  { kind: 'fuel_voucher', titleAr: 'قسيمة وقود رقمية 50 ريال', titleEn: 'Digital fuel voucher, SAR 50', partnerName: 'شبكة محطات شريكة', pointsCost: 2000, valueSar: 50, accent: '#F59E0B' },
  { kind: 'fuel_voucher', titleAr: 'قسيمة وقود رقمية 100 ريال', titleEn: 'Digital fuel voucher, SAR 100', partnerName: 'شبكة محطات شريكة', pointsCost: 3800, valueSar: 100, accent: '#F59E0B' },
  { kind: 'supplier_discount', titleAr: 'خصم 15٪ على الدهانات لدى الموردين المعتمدين', titleEn: '15% off paint at partner dealers', partnerName: 'الموردون المعتمدون', pointsCost: 1200, valueSar: null, accent: '#102A43' },
  { kind: 'tool', titleAr: 'طقم رولات احترافي (6 قطع)', titleEn: 'Professional roller kit (6 pieces)', partnerName: null, pointsCost: 3000, valueSar: 90, accent: '#486581', stock: 40 },
  { kind: 'tool', titleAr: 'رشاش دهان كهربائي', titleEn: 'Electric paint sprayer', partnerName: null, pointsCost: 9000, valueSar: 260, accent: '#486581', stock: 12, minTier: 'B' },
  { kind: 'tool', titleAr: 'عدة سلامة كاملة (كمامة، نظارة، قفازات)', titleEn: 'Full safety kit (respirator, goggles, gloves)', partnerName: null, pointsCost: 1500, valueSar: 45, accent: '#486581', stock: 80 },
  { kind: 'cash_out', titleAr: 'تحويل 100 ريال إلى محفظتك الرقمية', titleEn: 'SAR 100 to your digital wallet', partnerName: 'STC Pay / urpay', pointsCost: 4000, valueSar: 100, accent: '#047857' },
  { kind: 'cash_out', titleAr: 'تحويل 250 ريال إلى محفظتك الرقمية', titleEn: 'SAR 250 to your digital wallet', partnerName: 'STC Pay / urpay', pointsCost: 9500, valueSar: 250, accent: '#047857', minTier: 'B' },
  { kind: 'tool', titleAr: 'جهاز رش Airless احترافي', titleEn: 'Professional airless sprayer', partnerName: null, pointsCost: 32000, valueSar: 850, accent: '#486581', stock: 5, minTier: 'A' },
  { kind: 'supplier_discount', titleAr: 'رصيد مشتريات 1,500 ريال لدى الموردين', titleEn: 'SAR 1,500 purchase credit at partner dealers', partnerName: 'الموردون المعتمدون', pointsCost: 55000, valueSar: 1500, accent: '#102A43', minTier: 'A' },
] as const;

export const FIRST = ['فهد', 'عبدالله', 'محمد', 'سالم', 'خالد', 'ناصر', 'سعيد', 'ماجد', 'تركي', 'عمر', 'يوسف', 'إبراهيم', 'حسن', 'علي', 'بندر', 'راشد', 'عادل', 'منصور', 'وليد', 'هاني', 'طارق', 'مازن', 'أحمد', 'جابر', 'نواف', 'سلطان', 'مشعل', 'زياد', 'فيصل', 'سامي'];
export const BUSINESS = ['للدهانات', 'للديكور والدهانات', 'للتشطيبات', 'لأعمال الدهان', 'للعزل والدهانات', 'لدهانات الفلل'];

export const PROJECTS = [
  { scene: 'living', title: 'فيلا حي النرجس — دهان داخلي كامل', description: 'تجهيز الجدران ومعالجة التشققات ثم طبقتا أساس وطبقتان من الدهان المطفي بلون رملي دافئ.', area: 420, district: 'النرجس', colors: [{ name: 'رملي دافئ', code: 'SC-1043', hex: '#D8C9B0' }, { name: 'بني كراميل', code: 'SC-2210', hex: '#B98B5E' }] },
  { scene: 'bedroom', title: 'غرفة نوم رئيسية — جدار مميز', description: 'جدار مميز بلون أخضر مريمي مع حواف نظيفة وتشطيب ساتان قابل للغسل.', area: 64, district: 'الياسمين', colors: [{ name: 'أخضر مريمي', code: 'NJ-5521', hex: '#A7C4BC' }] },
  { scene: 'majlis', title: 'مجلس رجال — دهان ديكوري لافندر', description: 'دهان ديكوري بلمسة حريرية وإضاءة دافئة، مع تشطيب الأسقف الجبسية.', area: 96, district: 'الملقا', colors: [{ name: 'لافندر', code: 'GP-3307', hex: '#C6B4D8' }, { name: 'بنفسجي داكن', code: 'GP-3390', hex: '#8F74AD' }] },
  { scene: 'facade', title: 'واجهة فيلا — دهان خارجي مقاوم للعوامل', description: 'غسيل الواجهة ومعالجة الرطوبة ثم دهان خارجي مقاوم للأشعة فوق البنفسجية.', area: 610, district: 'العارض', colors: [{ name: 'كريمي', code: 'RS-7001', hex: '#EFE3C8' }, { name: 'ذهبي ترابي', code: 'RS-7104', hex: '#C69C54' }] },
  { scene: 'kitchen', title: 'مطبخ مفتوح — دهان قابل للغسل', description: 'دهان مقاوم للبقع والرطوبة مع تجديد دهان الخزائن الخشبية.', area: 48, district: 'الروضة', colors: [{ name: 'عاجي', code: 'SC-1002', hex: '#E9E2D0' }] },
  { scene: 'office', title: 'مكتب إداري — دهان هادئ للأعمال', description: 'دهان بلون أزرق رمادي هادئ في مساحات العمل مع جدول تنفيذ ليلي دون إيقاف العمل.', area: 280, district: 'العليا', colors: [{ name: 'أزرق رمادي', code: 'NJ-4410', hex: '#CBD8E6' }] },
] as const;
