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

/** The factory behind the platform (a placeholder name until the real brand is configured in the console). */
export const BRANDS = [{ key: 'factory', name: 'The Paint Factory', nameAr: 'مصنع الدهانات' }];

/** Independent paint shops that sell the factory's products. Fictional names. */
export const DEALERS = [
  { key: 'd1', brand: 'factory', name: 'معرض الصحراء للدهانات — الملقا', vat: '310000000100003', cityId: 'riyadh', signed: true },
  { key: 'd2', brand: 'factory', name: 'مركز ألوان نجد — السويدي', vat: '310000000200003', cityId: 'riyadh', signed: true },
  { key: 'd3', brand: 'factory', name: 'الخليج برو — الخبر', vat: '310000000300003', cityId: 'khobar', signed: true },
  { key: 'd4', brand: 'factory', name: 'البحر الأحمر للدهانات — الروضة', vat: '310000000400003', cityId: 'jeddah', signed: false },
  { key: 'd5', brand: 'factory', name: 'الصحراء — بريدة', vat: '310000000500003', cityId: 'buraidah', signed: false },
  { key: 'd6', brand: 'factory', name: 'ألوان نجد — أبها', vat: '310000000600003', cityId: 'abha', signed: false },
];

export const REWARDS = [
  { kind: 'fuel_voucher', titleAr: 'قسيمة وقود رقمية 50 ريال', titleEn: 'Digital fuel voucher, SAR 50', partnerName: 'شبكة محطات شريكة', pointsCost: 2000, valueSar: 50, accent: '#F59E0B' },
  { kind: 'fuel_voucher', titleAr: 'قسيمة وقود رقمية 100 ريال', titleEn: 'Digital fuel voucher, SAR 100', partnerName: 'شبكة محطات شريكة', pointsCost: 3800, valueSar: 100, accent: '#F59E0B' },
  { kind: 'supplier_discount', titleAr: 'خصم 15٪ على منتجات المصنع لدى الموزعين', titleEn: '15% off the factory’s paints at partner dealers', partnerName: 'الموردون المعتمدون', pointsCost: 1200, valueSar: null, accent: '#102A43' },
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

/** The factory's catalogue (illustrated packshots in scripts/seed-media/products). */
export const FACTORY_PRODUCTS = [
  { file: 'interior-matt', nameAr: 'دهان داخلي مطفي فاخر', nameEn: 'Premium interior matt', category: 'interior', descriptionAr: 'تغطية عالية ولمسة مخملية ناعمة، منخفض الرائحة ومناسب لغرف النوم والمجالس.', descriptionEn: 'High hiding power and a soft velvet touch. Low odour, ideal for bedrooms and majlis.', finishAr: 'مطفي', finishEn: 'Matt', coverage: 12, sizes: ['18 L', '3.6 L'], swatch: '#E9DDC9', featured: true },
  { file: 'interior-silk', nameAr: 'دهان داخلي حريري قابل للغسيل', nameEn: 'Washable interior silk', category: 'interior', descriptionAr: 'سطح حريري مقاوم للبقع يتحمل الغسيل المتكرر، للمطابخ والممرات.', descriptionEn: 'Stain-resistant silk finish that stands up to scrubbing, for kitchens and corridors.', finishAr: 'نصف لامع', finishEn: 'Silk', coverage: 11, sizes: ['18 L', '3.6 L'], swatch: '#C7D5E0', featured: true },
  { file: 'exterior-acrylic', nameAr: 'دهان خارجي أكريليك مقاوم', nameEn: 'Exterior acrylic weathershield', category: 'exterior', descriptionAr: 'مقاوم للأشعة فوق البنفسجية والأتربة والرطوبة، يحافظ على اللون في صيف المملكة.', descriptionEn: 'Resists UV, dust and humidity, and keeps its colour through Saudi summers.', finishAr: 'مطفي', finishEn: 'Matt', coverage: 10, sizes: ['18 L'], swatch: '#D6BE9C', featured: true },
  { file: 'exterior-thermal', nameAr: 'دهان خارجي عازل حراري', nameEn: 'Heat-reflective exterior', category: 'exterior', descriptionAr: 'يعكس أشعة الشمس ويخفض حرارة الجدران حتى 8 درجات.', descriptionEn: 'Reflects sunlight and lowers wall temperature by up to 8 °C.', finishAr: 'مطفي', finishEn: 'Matt', coverage: 9, sizes: ['18 L'], swatch: '#F3EEE5', featured: true },
  { file: 'primer', nameAr: 'أساس مائي (برايمر)', nameEn: 'Water-based primer sealer', category: 'primer', descriptionAr: 'يثبت السطح ويحسن التصاق الطبقات النهائية ويقلل استهلاك الدهان.', descriptionEn: 'Seals the surface, improves adhesion of the top coats and reduces paint use.', finishAr: null, finishEn: null, coverage: 12, sizes: ['18 L'], swatch: '#FFFFFF', featured: false },
  { file: 'waterproofing', nameAr: 'عازل مائي للأسطح', nameEn: 'Roof waterproofing membrane', category: 'waterproofing', descriptionAr: 'غشاء مرن يمنع تسرب المياه للأسطح والحمامات.', descriptionEn: 'A flexible membrane that stops leaks on roofs and in wet rooms.', finishAr: null, finishEn: null, coverage: 2, sizes: ['20 KG'], swatch: '#A9B1BC', featured: false },
  { file: 'decorative-marble', nameAr: 'دهان ديكوري بتأثير الرخام', nameEn: 'Marble-effect decorative finish', category: 'decorative', descriptionAr: 'تأثير رخامي فاخر للمجالس والمداخل بلمسة لامعة.', descriptionEn: 'A rich marble effect with a soft sheen, for majlis and entrances.', finishAr: 'لامع', finishEn: 'Gloss', coverage: 8, sizes: ['5 L'], swatch: '#B9AA99', featured: true },
  { file: 'enamel', nameAr: 'ورنيش ومينا للأخشاب والمعادن', nameEn: 'Wood & metal enamel', category: 'wood_metal', descriptionAr: 'حماية ولمعان طويل الأمد للأبواب والشبابيك والحديد.', descriptionEn: 'Long-lasting gloss and protection for doors, windows and steel.', finishAr: 'لامع', finishEn: 'Gloss', coverage: 14, sizes: ['3.6 L', '0.9 L'], swatch: '#8A3B1A', featured: false },
] as const;

export const REVIEWERS = ['م. فهد التميمي', 'أبو سعود الغامدي', 'عبدالعزيز الشمري', 'نورة القحطاني', 'خالد الدوسري', 'أم ريان', 'سلمان العنزي', 'د. هيفاء الزهراني', 'ماجد الحربي', 'عمر باوزير'];

export const REVIEW_TEXTS = [
  { rating: 5, project: 'فيلا سكنية', body: 'التزام تام بالمواعيد ونظافة بعد الانتهاء. اختار معنا الألوان بعناية والنتيجة فاقت توقعاتنا.' },
  { rating: 5, project: 'صالة استقبال', body: 'شغل نظيف وحواف دقيقة، واستخدم دهانات المصنع الأصلية مع ضمان مكتوب. أنصح بالتعامل معه.' },
  { rating: 4, project: 'شقة دوبلكس', body: 'تعامل راقٍ وسعر مناسب. تأخر يوماً واحداً عن الموعد لكنه عوّض بجودة التشطيب.' },
  { rating: 5, project: 'واجهة خارجية', body: 'عالج الرطوبة والتشققات قبل الدهان، والواجهة صارت كأنها جديدة. فريق محترف.' },
  { rating: 5, project: 'مجلس رجال', body: 'دهان ديكوري رائع بلمسة رخامية، والضيوف يسألون عنه دائماً.' },
  { rating: 4, project: 'مطبخ', body: 'دهان قابل للغسيل كما وعد، وعمل بسرعة دون إزعاج.' },
] as const;
