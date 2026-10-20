/**
 * Deterministic synthetic data that mirrors the five government templates, including the edge cases
 * the rules engine looks for. All dates are relative to "today" so the dashboards stay live.
 * No real person's data is used: names and numbers are generated.
 */
import { addDays, toHijri } from '@/lib/dates';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_AR = ['محمد', 'أحمد', 'علي', 'عمر', 'خالد', 'يوسف', 'إبراهيم', 'حسن', 'سعيد', 'عبدالله', 'مصطفى', 'ياسر', 'طارق', 'جمال', 'سالم', 'رامي', 'وليد', 'نادر'];
const LAST_AR = ['الحسني', 'المصري', 'العدني', 'الخطيب', 'النجار', 'الشامي', 'البكري', 'الزهراني', 'الحداد', 'السيد', 'عثمان', 'إدريس', 'حامد', 'منصور'];
const FIRST_LATIN = ['MUHAMMAD', 'ASIF', 'IMRAN', 'RASHID', 'KAMAL', 'AMINUL', 'ABDUL', 'SHAHID', 'TARIQ', 'NADEEM', 'MAHMOUD', 'IBRAHIM'];
const LAST_LATIN = ['KHAN', 'HUSSAIN', 'AHMED', 'RAHMAN', 'ISLAM', 'ALI', 'BAIG', 'IQBAL', 'MALIK', 'SHEIKH'];
const SAUDI_FIRST = ['فهد', 'سعود', 'نواف', 'تركي', 'ريم', 'نورة', 'سارة', 'عبدالعزيز', 'بندر', 'مشاعل', 'هيفاء', 'ماجد', 'فيصل', 'لمى', 'راكان'];
const SAUDI_LAST = ['العتيبي', 'القحطاني', 'الدوسري', 'الشهري', 'الغامدي', 'المطيري', 'الحربي', 'السبيعي', 'العنزي', 'الشمري'];

const NATIONALITIES: [string, number, 'ar' | 'latin'][] = [
  ['اليمن', 15, 'ar'],
  ['باكستان', 13, 'latin'],
  ['مصر', 10, 'ar'],
  ['السودان', 5, 'ar'],
  ['تشاد', 3, 'ar'],
  ['بنجلاديش', 4, 'latin'],
  ['نيجيريا', 2, 'latin'],
  ['الهند', 4, 'latin'],
  ['الفلبين', 2, 'latin'],
];

const OCCUPATIONS = [
  'عامل تصنيع', 'عامل تصنيع', 'عامل تصنيع', 'مندوب مبيعات', 'عامل تحميل وتنزيل', 'عامل مخزن', 'محاسب', 'أخصائي تسويق',
  'فني كهرباء', 'مشغل آلة', 'مهندس كيميائي', 'بائع', 'فني صيانة',
];

export interface SeedResident {
  iqamaNumber: string;
  name: string;
  gender: string;
  nationality: string;
  occupation: string;
  passportNumber: string;
  passportExpiry: string;
  iqamaIssueDate: string;
  iqamaExpiry: string;
  birthDate: string;
  outsideKingdom: boolean;
  iqamaExpiryHijri: string;
  employerNumber: string;
}

export interface SeedGosi {
  name: string;
  nationalId: string;
  nationality: string;
  isSaudi: boolean;
  gender: string;
  birthDate: string;
  basicWage: number;
  housingAllowance: number;
  commissions: number;
  otherAllowances: number;
  totalWage: number;
  contributoryWage: number;
  occupation: string;
  joinDate: string;
  newSystemEligible: boolean;
}

export interface SeedVehicle {
  plateNumber: string;
  registrationType: string;
  branch: string | null;
  make: string;
  model: string;
  manufactureYear: number;
  sequenceNumber: string;
  chassisNumber: string;
  color: string;
  vehicleStatus: string;
  ownershipDate: string | null;
  licenseExpiry: string;
  inspectionExpiry: string;
  actualUserId: string | null;
  actualUserName: string | null;
  inspectionStatus: string;
  insuranceStatus: string;
  restrictionStatus: string;
  formIssueDate: string;
  bodyType: string;
}

export interface SeedOperatingCard {
  cardNumber: string;
  sequenceNumber: string;
  activity: string;
  issueDate: string;
  expiryDate: string;
  cardStatus: string;
}

export interface SeedDriverCard {
  driverId: string;
  firstName: string;
  lastName: string;
  cardNumber: string;
  activity: string;
  issueDate: string;
  expiryDate: string;
  cardClass: string;
  requestStatus: string;
}

export interface SeedDataset {
  residents: SeedResident[];
  gosi: SeedGosi[];
  vehicles: SeedVehicle[];
  operatingCards: SeedOperatingCard[];
  driverCards: SeedDriverCard[];
}

const ACTIVITY = 'نقل البضائع على الحساب الخاص';

export function buildDataset(today: string, seed = 2026): SeedDataset {
  const r = rng(seed);
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)];
  const int = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const used = new Set<string>();
  const uniqueDigits = (prefix: string, len: number) => {
    for (;;) {
      let s = prefix;
      while (s.length < len) s += String(int(0, 9));
      if (!used.has(s)) {
        used.add(s);
        return s;
      }
    }
  };
  const employer = '7001234560';

  // ── Residents ──
  const nationalityPool: [string, 'ar' | 'latin'][] = NATIONALITIES.flatMap(([n, c, s]) => Array.from({ length: c }, () => [n, s] as [string, 'ar' | 'latin']));
  // iqama expiry offsets that guarantee every bucket is populated
  const iqamaOffsets = [-40, -12, -3, -1, 4, 9, 14, 18, 23, 28, 35, 41, 47, 52, 58, 63, 66, 71, 76, 80, 84, 88];
  const residents: SeedResident[] = nationalityPool.map(([nationality, script], i) => {
    const name = script === 'ar' ? `${pick(FIRST_AR)} ${pick(FIRST_AR)} ${pick(LAST_AR)}` : `${pick(FIRST_LATIN)} ${pick(FIRST_LATIN)} - ${pick(LAST_LATIN)}`;
    const iqamaExpiry = addDays(today, iqamaOffsets[i] ?? int(95, 420));
    const birthYearsAgo = i % 9 === 0 ? int(60, 72) : int(22, 55);
    return {
      iqamaNumber: uniqueDigits('2', 10),
      name,
      gender: 'ذكر',
      nationality,
      occupation: pick(OCCUPATIONS),
      passportNumber: `${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${int(1000000, 9999999)}`,
      passportExpiry: addDays(today, int(400, 2600)),
      iqamaIssueDate: addDays(today, -int(400, 6000)),
      iqamaExpiry,
      birthDate: addDays(today, -Math.round(birthYearsAgo * 365.25) - int(0, 300)),
      outsideKingdom: false,
      iqamaExpiryHijri: toHijri(iqamaExpiry)!,
      employerNumber: employer,
    };
  });
  // Renewal blocked: passport expired while iqama is within 90 days.
  for (const i of [5, 12, 17]) residents[i].passportExpiry = addDays(today, -int(5, 120));
  // Passport expires before the iqama.
  for (const i of [9, 15]) residents[i].passportExpiry = addDays(residents[i].iqamaExpiry, -int(5, 25));
  // Outside the Kingdom (two of them with an iqama expiring within 30 days).
  for (const i of [6, 7, 22, 30, 41, 50]) residents[i].outsideKingdom = true;
  // Heavy truck drivers and forklift drivers (the latter must not need a driver card).
  const heavyIdx = [20, 24, 27, 33, 38, 44, 47];
  for (const i of heavyIdx) residents[i].occupation = 'سائق شاحنة ثقيلة';
  for (const i of [26, 35]) residents[i].occupation = 'سائق رافعة شوكية';

  // ── GOSI ──
  const gosi: SeedGosi[] = [];
  const skipFromGosi = new Set([3, 31, 45]); // residents not registered in GOSI
  residents.forEach((res, i) => {
    if (skipFromGosi.has(i)) return;
    const basic = int(15, 60) * 100;
    const housing = Math.round(basic * 0.25);
    const other = int(0, 6) * 100;
    const total = basic + housing + other;
    gosi.push({
      name: res.name,
      nationalId: res.iqamaNumber,
      nationality: res.nationality,
      isSaudi: false,
      gender: res.gender,
      birthDate: res.birthDate,
      basicWage: basic,
      housingAllowance: housing,
      commissions: 0,
      otherAllowances: other,
      totalWage: total,
      contributoryWage: basic + housing,
      occupation: i === 11 ? 'عامل' : res.occupation,
      joinDate: addDays(today, -int(200, 4000)),
      newSystemEligible: false,
    });
  });
  // Paying for people who are no longer active residents.
  for (let k = 0; k < 2; k++) {
    gosi.push({
      name: `${pick(FIRST_LATIN)} ${pick(LAST_LATIN)}`,
      nationalId: uniqueDigits('2', 10),
      nationality: 'باكستان',
      isSaudi: false,
      gender: 'ذكر',
      birthDate: addDays(today, -int(9000, 15000)),
      basicWage: 2000,
      housingAllowance: 500,
      commissions: 0,
      otherAllowances: 0,
      totalWage: 2500,
      contributoryWage: 2500,
      occupation: 'عامل تصنيع',
      joinDate: addDays(today, -int(700, 2000)),
      newSystemEligible: false,
    });
  }
  // Saudis.
  for (let k = 0; k < 24; k++) {
    const female = k % 3 === 1;
    const basic = k < 3 ? int(28, 34) * 100 : int(45, 160) * 100;
    const housing = Math.round(basic * 0.25);
    const total = basic + housing + int(0, 10) * 100;
    const joinDate = k < 3 ? addDays(today, -int(76, 88)) : k < 6 ? addDays(today, -int(20, 70)) : addDays(today, -int(200, 5000));
    gosi.push({
      name: `${pick(SAUDI_FIRST)} ${pick(SAUDI_FIRST)} ${pick(SAUDI_LAST)}`,
      nationalId: uniqueDigits('1', 10),
      nationality: 'السعودية',
      isSaudi: true,
      gender: female ? 'أنثى' : 'ذكر',
      birthDate: addDays(today, -int(8000, 16000)),
      basicWage: basic,
      housingAllowance: housing,
      commissions: 0,
      otherAllowances: total - basic - housing,
      totalWage: total,
      contributoryWage: Math.min(basic + housing, 45000),
      occupation: pick(['محاسب', 'أخصائي موارد بشرية', 'مشرف إنتاج', 'مهندس صناعي', 'أخصائي تسويق', 'مدير مبيعات', 'سكرتير']),
      joinDate,
      newSystemEligible: k < 6 || k % 7 === 0,
    });
  }

  // ── Vehicles ──
  const heavy = (i: number) => residents[heavyIdx[i]];
  const vehicleSpecs: Partial<SeedVehicle>[] = [
    { registrationType: 'نقل خاص', make: 'مرسيدس', model: 'أكتروس شاحنة ثقيلة', bodyType: 'شاحنة', actualUserId: heavy(0).iqamaNumber, actualUserName: heavy(0).name },
    { registrationType: 'نقل خاص', make: 'فولفو', model: 'FH رأس تريلا', bodyType: 'رأس تريلا', actualUserId: heavy(1).iqamaNumber, actualUserName: heavy(1).name },
    { registrationType: 'نقل خاص', make: 'مان', model: 'TGS قلاب', bodyType: 'قلاب', actualUserId: heavy(2).iqamaNumber, actualUserName: heavy(2).name },
    { registrationType: 'نقل خاص', make: 'ايسوزو', model: 'FVR شاحنة متوسطة', bodyType: 'صندوق', actualUserId: heavy(3).iqamaNumber, actualUserName: heavy(3).name },
    { registrationType: 'نقل خاص', make: 'هينو', model: '500 شاحنة', bodyType: 'صندوق مبرد', actualUserId: heavy(4).iqamaNumber, actualUserName: heavy(4).name },
    { registrationType: 'نقل خاص', make: 'مرسيدس', model: 'أكسور شاحنة', bodyType: 'صهريج', actualUserId: heavy(5).iqamaNumber, actualUserName: heavy(5).name },
    { registrationType: 'نقل خاص', make: 'سكانيا', model: 'R450 رأس تريلا', bodyType: 'رأس تريلا', actualUserId: residents[7].iqamaNumber, actualUserName: residents[7].name },
    { registrationType: 'نقل خاص', make: 'فولفو', model: 'FMX قلاب', bodyType: 'قلاب', actualUserId: residents[0].iqamaNumber, actualUserName: residents[0].name },
    { registrationType: 'نقل خاص', make: 'ايسوزو', model: 'بكب نصف نقل', bodyType: 'غمارة', actualUserId: residents[2].iqamaNumber, actualUserName: residents[2].name },
    { registrationType: 'نقل خاص', make: 'تويوتا', model: 'هايلكس بكب', bodyType: 'غمارتين', actualUserId: residents[4].iqamaNumber, actualUserName: residents[4].name },
    { registrationType: 'نقل خاص', make: 'نيسان', model: 'ددسن ونيت', bodyType: 'غمارة', actualUserId: residents[4].iqamaNumber, actualUserName: residents[4].name },
    { registrationType: 'نقل خاص', make: 'شيفروليه', model: 'سلفرادو بكب', bodyType: 'غمارتين', actualUserId: residents[4].iqamaNumber, actualUserName: residents[4].name },
    { registrationType: 'خصوصي', make: 'تويوتا', model: 'كامري', bodyType: 'سيدان', actualUserId: residents[8].iqamaNumber, actualUserName: residents[8].name },
    { registrationType: 'خصوصي', make: 'هيونداي', model: 'سوناتا', bodyType: 'سيدان', actualUserId: null, actualUserName: null },
    { registrationType: 'نقل عام', make: 'مرسيدس', model: 'حافلة ركاب', bodyType: 'حافلة', actualUserId: residents[10].iqamaNumber, actualUserName: residents[10].name },
    { registrationType: 'نقل خاص', make: 'هينو', model: '300 شاحنة خفيفة', bodyType: 'صندوق', actualUserId: null, actualUserName: null },
    { registrationType: 'نقل خاص', make: 'مرسيدس', model: 'أكتروس شاحنة ثقيلة', bodyType: 'سطحة', actualUserId: residents[13].iqamaNumber, actualUserName: residents[13].name },
    { registrationType: 'نقل خاص', make: 'فولفو', model: 'FH رأس تريلا', bodyType: 'رأس تريلا', actualUserId: residents[16].iqamaNumber, actualUserName: residents[16].name },
  ];
  const plateLetters = ['أ ب ج', 'ر س ص', 'ط ع ق', 'ك ل م', 'ن هـ و', 'ي د ح', 'ب ر ع', 'س ط ك'];
  const colors = ['ابيض', 'ابيض', 'فضي', 'ازرق', 'احمر', 'رمادي'];
  const vehicles: SeedVehicle[] = vehicleSpecs.map((spec, i) => {
    const year = int(2008, 2025);
    const formIssue = addDays(today, -int(100, 3000));
    return {
      plateNumber: `${pick(plateLetters)} ${int(1000, 9999)}`,
      registrationType: spec.registrationType!,
      branch: i % 3 === 0 ? 'الرياض' : i % 3 === 1 ? 'الدمام' : null,
      make: spec.make!,
      model: spec.model!,
      manufactureYear: year,
      sequenceNumber: uniqueDigits(String(int(1, 9)), 9),
      chassisNumber: `${['WDB', 'YV2', 'WMA', 'JAL', 'JHF'][i % 5]}${int(10000000, 99999999)}${int(1000, 9999)}`,
      color: pick(colors),
      vehicleStatus: 'صالحة',
      ownershipDate: i % 4 === 0 ? addDays(today, -int(300, 3000)) : null,
      licenseExpiry: addDays(today, [2, 5].includes(i) ? int(5, 25) : int(60, 900)),
      inspectionExpiry: addDays(today, [1, 6].includes(i) ? -int(3, 40) : [3].includes(i) ? int(10, 28) : int(70, 360)),
      actualUserId: spec.actualUserId ?? null,
      actualUserName: spec.actualUserName ?? null,
      inspectionStatus: [1, 6].includes(i) ? 'منتهي' : 'ساري',
      insuranceStatus: i === 4 ? 'غير ساري' : 'ساري المفعول',
      restrictionStatus: i === 16 ? 'متحفظ عليها' : 'غير متحفظ',
      formIssueDate: formIssue,
      bodyType: spec.bodyType!,
    };
  });

  // ── Operating cards (heavy vehicles 0–7, 14, 16, 17 need one) ──
  const cardFor = (vi: number, expiryOffset: number, status = 'نشط'): SeedOperatingCard => ({
    cardNumber: `33-${uniqueDigits('00', 8)}`,
    sequenceNumber: vehicles[vi].sequenceNumber,
    activity: vi === 14 ? 'نقل الركاب' : ACTIVITY,
    issueDate: addDays(today, expiryOffset - 365),
    expiryDate: addDays(today, expiryOffset),
    cardStatus: status,
  });
  const operatingCards: SeedOperatingCard[] = [
    cardFor(0, 210),
    cardFor(1, -15, 'منتهية'),
    cardFor(2, 40),
    cardFor(3, 55),
    cardFor(4, 300),
    cardFor(5, 120),
    cardFor(6, 18),
    cardFor(14, 260),
    cardFor(16, 190),
    // vehicles 7 and 17 have no card → missing operating card alerts
    {
      cardNumber: `33-${uniqueDigits('00', 8)}`,
      sequenceNumber: uniqueDigits('9', 9),
      activity: ACTIVITY,
      issueDate: addDays(today, -200),
      expiryDate: addDays(today, 165),
      cardStatus: 'نشط',
    },
  ];

  // ── Driver cards (heavy truck drivers; two have none) ──
  const driverCards: SeedDriverCard[] = [0, 1, 2, 3, 5].map((h, k) => {
    const res = heavy(h);
    const [first, ...rest] = res.name.split(' ');
    const expiry = addDays(today, k === 1 ? 20 : k === 3 ? -9 : int(120, 600));
    return {
      driverId: res.iqamaNumber,
      firstName: first,
      lastName: rest.filter((x) => x !== '-').pop() ?? '',
      cardNumber: `33.${uniqueDigits('00', 8)}`,
      activity: ACTIVITY,
      issueDate: addDays(expiry, -400),
      expiryDate: expiry,
      cardClass: 'سنوية',
      requestStatus: k === 3 ? 'منتهية' : 'نشط',
    };
  });

  return { residents, gosi, vehicles, operatingCards, driverCards };
}

/**
 * A later export of the same company: some renewals happened, one resident left, one joined, and
 * one row carries an older date than the platform holds (to show stale-row protection).
 */
export function buildNextExport(base: SeedDataset, today: string, seed = 77): SeedDataset {
  const r = rng(seed);
  const next: SeedDataset = structuredClone(base);
  for (const i of [0, 1, 2, 4, 6]) next.residents[i].iqamaExpiry = addDays(today, 360 + Math.floor(r() * 20));
  for (const res of next.residents) res.iqamaExpiryHijri = toHijri(res.iqamaExpiry)!;
  next.residents[8].iqamaExpiry = addDays(base.residents[8].iqamaExpiry, -365);
  next.residents[8].iqamaExpiryHijri = toHijri(next.residents[8].iqamaExpiry)!;
  next.residents.splice(19, 1);
  next.residents.push({
    ...base.residents[0],
    iqamaNumber: '2999000001',
    name: 'NEW JOINER - SAMPLE',
    nationality: 'الهند',
    occupation: 'فني صيانة',
    iqamaExpiry: addDays(today, 330),
    iqamaExpiryHijri: toHijri(addDays(today, 330))!,
    outsideKingdom: false,
  });
  next.vehicles[1].inspectionExpiry = addDays(today, 365);
  next.operatingCards[1].expiryDate = addDays(today, 350);
  next.operatingCards[1].cardStatus = 'نشط';
  return next;
}
