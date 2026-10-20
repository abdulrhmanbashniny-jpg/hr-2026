import type { authorities, documents, driverCards, gosiSubscribers, operatingCards, residents, vehicles } from '@/db/schema';
import { addDays, ageOn, bucketForDays, daysUntil, type ExpiryBucket } from '@/lib/dates';
import type { TenantSettings } from '@/lib/settings';
import {
  isActiveCardStatus,
  isInsuranceValid,
  isRegulatedDriverOccupation,
  isRestricted,
  operatingCardRequirement,
  sameOccupation,
} from './classify';
import { arDays, arRemaining, enDays, enRemaining } from './text';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertModule = 'residents' | 'gosi' | 'fleet' | 'operating_cards' | 'driver_cards' | 'documents' | 'cross';

export type ResidentRow = typeof residents.$inferSelect;
export type GosiRow = typeof gosiSubscribers.$inferSelect;
export type VehicleRow = typeof vehicles.$inferSelect;
export type OperatingCardRow = typeof operatingCards.$inferSelect;
export type DriverCardRow = typeof driverCards.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect & { authority?: Pick<typeof authorities.$inferSelect, 'nameAr' | 'nameEn'> | null };

export const RULES = {
  RES_IQAMA_EXPIRY: { module: 'residents', ar: 'انتهاء الإقامة', en: 'Iqama expiry' },
  RES_PASSPORT_EXPIRY: { module: 'residents', ar: 'انتهاء الجواز', en: 'Passport expiry' },
  RES_RENEWAL_BLOCKED: { module: 'residents', ar: 'تعارض تجديد الإقامة', en: 'Iqama renewal blocked by passport' },
  RES_ABROAD_EXPIRY: { module: 'residents', ar: 'خارج المملكة ووثائقه قاربت الانتهاء', en: 'Abroad with expiring documents' },
  RES_SENIOR: { module: 'residents', ar: 'تجاوز سن الستين', en: 'Aged 60 or over' },
  GOSI_LOW_WAGE_SAUDI: { module: 'gosi', ar: 'أجر سعودي دون الحد في نطاقات', en: 'Saudi wage below Nitaqat threshold' },
  GOSI_PROBATION_END: { module: 'gosi', ar: 'نهاية فترة التجربة', en: 'Probation period ending' },
  VEH_LICENSE_EXPIRY: { module: 'fleet', ar: 'انتهاء رخصة السير', en: 'Vehicle registration expiry' },
  VEH_INSPECTION_EXPIRY: { module: 'fleet', ar: 'انتهاء الفحص الدوري', en: 'Periodic inspection expiry' },
  VEH_INSURANCE_INVALID: { module: 'fleet', ar: 'تأمين المركبة غير ساري', en: 'Vehicle insurance not valid' },
  VEH_RESTRICTED: { module: 'fleet', ar: 'مركبة عليها تحفظ', en: 'Vehicle under restriction' },
  VEH_NO_USER: { module: 'fleet', ar: 'مركبة بلا مستخدم فعلي', en: 'Vehicle without an actual user' },
  VEH_USER_OVERLOAD: { module: 'fleet', ar: 'عدة مركبات باسم مستخدم واحد', en: 'Several vehicles on one user' },
  VEH_OPCARD_MISSING: { module: 'operating_cards', ar: 'مركبة نقل بلا بطاقة تشغيل', en: 'Transport vehicle without operating card' },
  OPCARD_EXPIRY: { module: 'operating_cards', ar: 'انتهاء بطاقة التشغيل', en: 'Operating card expiry' },
  OPCARD_ORPHAN: { module: 'operating_cards', ar: 'بطاقة تشغيل لمركبة غير موجودة', en: 'Operating card for an unknown vehicle' },
  DRV_CARD_MISSING: { module: 'driver_cards', ar: 'سائق ثقيل بلا بطاقة سائق', en: 'Regulated driver without driver card' },
  DRVCARD_EXPIRY: { module: 'driver_cards', ar: 'انتهاء بطاقة السائق', en: 'Driver card expiry' },
  X_VEHICLE_USER_ABROAD: { module: 'cross', ar: 'مستخدم المركبة خارج المملكة', en: 'Vehicle user is outside the Kingdom' },
  X_VEHICLE_USER_IQAMA_EXPIRED: { module: 'cross', ar: 'مستخدم المركبة إقامته منتهية', en: "Vehicle user's iqama expired" },
  X_RESIDENT_NOT_IN_GOSI: { module: 'cross', ar: 'مقيم غير مسجل في التأمينات', en: 'Resident not registered in GOSI' },
  X_GOSI_NOT_IN_RESIDENTS: { module: 'cross', ar: 'مشترك في التأمينات غير موجود في مقيم', en: 'GOSI subscriber missing from Muqeem' },
  X_OCCUPATION_MISMATCH: { module: 'cross', ar: 'اختلاف المهنة بين مقيم والتأمينات', en: 'Occupation differs between Muqeem and GOSI' },
  REC_MISSING: { module: 'cross', ar: 'سجل اختفى من آخر ملف', en: 'Record missing from the latest file' },
  DOC_EXPIRY: { module: 'documents', ar: 'انتهاء مستند', en: 'Document expiry' },
} as const satisfies Record<string, { module: AlertModule; ar: string; en: string }>;

export type RuleCode = keyof typeof RULES;

export interface AlertCandidate {
  fingerprint: string;
  ruleCode: RuleCode;
  module: AlertModule;
  severity: Severity;
  entityType: 'resident' | 'gosi' | 'vehicle' | 'operating_card' | 'driver_card' | 'document' | 'person';
  entityId: string | null;
  entityKey: string;
  entityLabel: string;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  dueDate: string | null;
  link: string;
}

export interface RulesInput {
  today: string;
  settings: TenantSettings;
  residents: ResidentRow[];
  gosi: GosiRow[];
  vehicles: VehicleRow[];
  operatingCards: OperatingCardRow[];
  driverCards: DriverCardRow[];
  documents: DocumentRow[];
  /** Cross-file rules only run once both files were uploaded at least once. */
  imported: Record<'residents' | 'gosi' | 'vehicles' | 'operating_cards' | 'driver_cards', boolean>;
}

export const EXPIRY_WINDOW_DAYS = 90;

export function severityForBucket(bucket: ExpiryBucket): Severity {
  switch (bucket) {
    case 'expired':
      return 'critical';
    case 'd30':
      return 'high';
    case 'd60':
      return 'medium';
    default:
      return 'low';
  }
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
export const compareSeverity = (a: Severity, b: Severity) => SEVERITY_RANK[a] - SEVERITY_RANK[b];

const MISSING_TEMPLATE_AR: Record<string, string> = {
  resident: 'ملف المقيمين',
  gosi: 'ملف التأمينات',
  vehicle: 'ملف المركبات',
  operating_card: 'ملف بطاقات التشغيل',
  driver_card: 'ملف بطاقات السائقين',
};
const MISSING_TEMPLATE_EN: Record<string, string> = {
  resident: 'residents file',
  gosi: 'GOSI file',
  vehicle: 'vehicles file',
  operating_card: 'operating cards file',
  driver_card: 'driver cards file',
};

export function evaluateRules(input: RulesInput): AlertCandidate[] {
  const { today, settings } = input;
  const out: AlertCandidate[] = [];
  const push = (c: Omit<AlertCandidate, 'module' | 'titleAr' | 'titleEn'> & { titleAr?: string; titleEn?: string }) => {
    const rule = RULES[c.ruleCode];
    out.push({ ...c, module: rule.module, titleAr: c.titleAr ?? rule.ar, titleEn: c.titleEn ?? rule.en });
  };

  const live = <T extends { recordStatus: string }>(rows: T[]) => rows.filter((r) => r.recordStatus !== 'archived');
  const residentsLive = live(input.residents);
  const gosiLive = live(input.gosi);
  const vehiclesLive = live(input.vehicles);
  const opCardsLive = live(input.operatingCards);
  const driverCardsLive = live(input.driverCards);

  const residentById = new Map(residentsLive.map((r) => [r.iqamaNumber, r]));
  const gosiById = new Map(gosiLive.map((g) => [g.nationalId, g]));

  const expiry = (
    ruleCode: RuleCode,
    date: string | null,
    base: Pick<AlertCandidate, 'entityType' | 'entityId' | 'entityKey' | 'entityLabel' | 'link'>,
    whatAr: string,
    whatEn: string,
    window = EXPIRY_WINDOW_DAYS,
  ) => {
    const days = daysUntil(date, today);
    if (days === null || days > window) return;
    const bucket = bucketForDays(days);
    push({
      ...base,
      ruleCode,
      fingerprint: `${ruleCode}:${base.entityKey}:${date}`,
      severity: severityForBucket(bucket),
      detailAr: `${whatAr} — ${arRemaining(days)} (${date}).`,
      detailEn: `${whatEn} — ${enRemaining(days)} (${date}).`,
      dueDate: date,
    });
  };

  // ── Residents (Muqeem) ──
  for (const r of residentsLive) {
    const base = { entityType: 'resident' as const, entityId: r.id, entityKey: r.iqamaNumber, entityLabel: r.name, link: `/app/people/${r.iqamaNumber}` };
    if (r.recordStatus === 'active') {
      expiry('RES_IQAMA_EXPIRY', r.iqamaExpiry, base, `إقامة ${r.name}`, `${r.name}'s iqama`);
      expiry('RES_PASSPORT_EXPIRY', r.passportExpiry, base, `جواز ${r.name}`, `${r.name}'s passport`);

      const iqamaDays = daysUntil(r.iqamaExpiry, today);
      const passportDays = daysUntil(r.passportExpiry, today);
      if (iqamaDays !== null && iqamaDays <= EXPIRY_WINDOW_DAYS && r.passportExpiry && r.iqamaExpiry) {
        const passportExpired = passportDays !== null && passportDays <= 0;
        if (passportExpired || r.passportExpiry < r.iqamaExpiry) {
          push({
            ...base,
            ruleCode: 'RES_RENEWAL_BLOCKED',
            fingerprint: `RES_RENEWAL_BLOCKED:${r.iqamaNumber}:${r.iqamaExpiry}:${r.passportExpiry}`,
            severity: passportExpired && iqamaDays <= 30 ? 'critical' : 'high',
            detailAr: passportExpired
              ? `جواز ${r.name} منتهٍ (${r.passportExpiry}) والإقامة ${arRemaining(iqamaDays)}. نظام مقيم يمنع التجديد بجواز منتهٍ؛ جدّد الجواز أولاً.`
              : `جواز ${r.name} ينتهي (${r.passportExpiry}) قبل الإقامة (${r.iqamaExpiry}). جدّد الجواز قبل تجديد الإقامة.`,
            detailEn: passportExpired
              ? `${r.name}'s passport expired (${r.passportExpiry}) and the iqama has ${enRemaining(iqamaDays)}. Muqeem will not renew with an expired passport; renew the passport first.`
              : `${r.name}'s passport expires (${r.passportExpiry}) before the iqama (${r.iqamaExpiry}). Renew the passport before the iqama.`,
            dueDate: r.iqamaExpiry,
          });
        }
      }

      if (r.outsideKingdom) {
        const soon = [iqamaDays, passportDays].filter((d): d is number => d !== null && d <= EXPIRY_WINDOW_DAYS);
        if (soon.length) {
          const worst = Math.min(...soon);
          push({
            ...base,
            ruleCode: 'RES_ABROAD_EXPIRY',
            fingerprint: `RES_ABROAD_EXPIRY:${r.iqamaNumber}:${r.iqamaExpiry}:${r.passportExpiry}`,
            severity: worst <= 0 ? 'critical' : 'high',
            detailAr: `${r.name} خارج المملكة، والإقامة ${iqamaDays === null ? 'بلا تاريخ' : arRemaining(iqamaDays)} والجواز ${passportDays === null ? 'بلا تاريخ' : arRemaining(passportDays)}. تابع عودته قبل أن يُسجَّل «خرج ولم يعد».`,
            detailEn: `${r.name} is outside the Kingdom; iqama ${iqamaDays === null ? 'has no date' : enRemaining(iqamaDays)}, passport ${passportDays === null ? 'has no date' : enRemaining(passportDays)}. Follow up before the status becomes "exited and did not return".`,
            dueDate: [r.iqamaExpiry, r.passportExpiry].filter(Boolean).sort()[0] ?? null,
          });
        }
      }

      const age = ageOn(r.birthDate, today);
      if (age !== null && age >= settings.seniorAge) {
        push({
          ...base,
          ruleCode: 'RES_SENIOR',
          fingerprint: `RES_SENIOR:${r.iqamaNumber}`,
          severity: 'info',
          detailAr: `${r.name} عمره ${age} عاماً؛ تختلف اشتراطات التأمين الطبي ورسومه لمن تجاوز ${settings.seniorAge}.`,
          detailEn: `${r.name} is ${age}; medical insurance terms and fees differ above ${settings.seniorAge}.`,
          dueDate: null,
        });
      }
    } else {
      pushMissing(push, 'resident', base, r.missingSince);
    }
  }

  // ── GOSI ──
  for (const g of gosiLive) {
    const base = { entityType: 'gosi' as const, entityId: g.id, entityKey: g.nationalId, entityLabel: g.name, link: `/app/people/${g.nationalId}` };
    if (g.recordStatus !== 'active') {
      pushMissing(push, 'gosi', base, g.missingSince);
      continue;
    }
    if (g.isSaudi && g.contributoryWage < settings.saudiMinContributoryWage) {
      push({
        ...base,
        ruleCode: 'GOSI_LOW_WAGE_SAUDI',
        fingerprint: `GOSI_LOW_WAGE_SAUDI:${g.nationalId}:${g.contributoryWage}`,
        severity: 'medium',
        detailAr: `الأجر الخاضع للاشتراك لـ ${g.name} هو ${g.contributoryWage.toLocaleString('en')} ريال، أقل من ${settings.saudiMinContributoryWage.toLocaleString('en')}؛ لا يُحتسب بوزن كامل في نطاقات.`,
        detailEn: `${g.name}'s contributory wage is SAR ${g.contributoryWage.toLocaleString('en')}, below ${settings.saudiMinContributoryWage.toLocaleString('en')}; it does not count at full weight in Nitaqat.`,
        dueDate: null,
      });
    }
    if (g.joinDate && !g.probationReviewedAt) {
      const probation = g.probationDays ?? settings.probationDays;
      const endDate = addDays(g.joinDate, probation);
      const left = daysUntil(endDate, today)!;
      if (left >= 0 && left <= settings.probationAlertLeadDays) {
        push({
          ...base,
          ruleCode: 'GOSI_PROBATION_END',
          fingerprint: `GOSI_PROBATION_END:${g.nationalId}:${endDate}`,
          severity: 'medium',
          detailAr: `تنتهي فترة تجربة ${g.name} (${probation} يوماً) في ${endDate} — ${arRemaining(left)}. قيّم الموظف قبل انتهائها.`,
          detailEn: `${g.name}'s ${probation}-day probation ends on ${endDate} (${enRemaining(left)}). Evaluate before it ends.`,
          dueDate: endDate,
        });
      }
    }
  }

  // ── Fleet (Tamm) ──
  const vehiclesByUser = new Map<string, VehicleRow[]>();
  const opCardsBySeq = new Map<string, OperatingCardRow[]>();
  for (const c of opCardsLive) {
    if (!c.sequenceNumber || c.recordStatus !== 'active') continue;
    opCardsBySeq.set(c.sequenceNumber, [...(opCardsBySeq.get(c.sequenceNumber) ?? []), c]);
  }
  const vehicleSeqs = new Set(vehiclesLive.map((v) => v.sequenceNumber));

  for (const v of vehiclesLive) {
    const label = [v.plateNumber, v.make, v.model].filter(Boolean).join(' · ') || v.sequenceNumber;
    const base = { entityType: 'vehicle' as const, entityId: v.id, entityKey: v.sequenceNumber, entityLabel: label, link: `/app/fleet/${v.sequenceNumber}` };
    if (v.recordStatus !== 'active') {
      pushMissing(push, 'vehicle', base, v.missingSince);
      continue;
    }
    expiry('VEH_LICENSE_EXPIRY', v.licenseExpiry, base, `رخصة سير ${label}`, `Registration of ${label}`);
    expiry('VEH_INSPECTION_EXPIRY', v.inspectionExpiry, base, `الفحص الدوري لـ ${label}`, `Inspection of ${label}`);

    if (isInsuranceValid(v.insuranceStatus) === false) {
      push({
        ...base,
        ruleCode: 'VEH_INSURANCE_INVALID',
        fingerprint: `VEH_INSURANCE_INVALID:${v.sequenceNumber}`,
        severity: 'high',
        detailAr: `حالة تأمين ${label}: «${v.insuranceStatus}». لا تُشغّل المركبة قبل تجديد التأمين.`,
        detailEn: `Insurance status of ${label}: "${v.insuranceStatus}". Do not operate it until insurance is renewed.`,
        dueDate: null,
      });
    }
    if (isRestricted(v.restrictionStatus)) {
      push({
        ...base,
        ruleCode: 'VEH_RESTRICTED',
        fingerprint: `VEH_RESTRICTED:${v.sequenceNumber}`,
        severity: 'high',
        detailAr: `على ${label} تحفظ: «${v.restrictionStatus}».`,
        detailEn: `${label} is under restriction: "${v.restrictionStatus}".`,
        dueDate: null,
      });
    }
    if (!v.actualUserId) {
      push({
        ...base,
        ruleCode: 'VEH_NO_USER',
        fingerprint: `VEH_NO_USER:${v.sequenceNumber}`,
        severity: 'medium',
        detailAr: `${label} غير مسندة لمستخدم فعلي في تم؛ أي مخالفة ستسجل على المنشأة.`,
        detailEn: `${label} has no actual user in Tamm; violations will be recorded against the company.`,
        dueDate: null,
      });
    } else {
      vehiclesByUser.set(v.actualUserId, [...(vehiclesByUser.get(v.actualUserId) ?? []), v]);
      const holder = residentById.get(v.actualUserId);
      if (holder && holder.recordStatus === 'active') {
        if (holder.outsideKingdom) {
          push({
            ...base,
            ruleCode: 'X_VEHICLE_USER_ABROAD',
            fingerprint: `X_VEHICLE_USER_ABROAD:${v.sequenceNumber}:${holder.iqamaNumber}`,
            severity: 'high',
            detailAr: `${label} مسجلة باسم ${holder.name} وهو خارج المملكة حالياً. أعد إسناد المركبة لسائق متواجد.`,
            detailEn: `${label} is assigned to ${holder.name}, who is currently outside the Kingdom. Reassign it to a present driver.`,
            dueDate: null,
          });
        }
        const iqDays = daysUntil(holder.iqamaExpiry, today);
        if (iqDays !== null && iqDays <= 0) {
          push({
            ...base,
            ruleCode: 'X_VEHICLE_USER_IQAMA_EXPIRED',
            fingerprint: `X_VEHICLE_USER_IQAMA_EXPIRED:${v.sequenceNumber}:${holder.iqamaNumber}:${holder.iqamaExpiry}`,
            severity: 'critical',
            detailAr: `${label} مسجلة باسم ${holder.name} وإقامته ${arRemaining(iqDays)}.`,
            detailEn: `${label} is assigned to ${holder.name}, whose iqama ${enRemaining(iqDays)}.`,
            dueDate: holder.iqamaExpiry,
          });
        }
      }
    }

    const need = operatingCardRequirement(v, settings);
    if (need.required && !opCardsBySeq.has(v.sequenceNumber) && input.imported.operating_cards) {
      push({
        ...base,
        ruleCode: 'VEH_OPCARD_MISSING',
        fingerprint: `VEH_OPCARD_MISSING:${v.sequenceNumber}`,
        severity: 'high',
        detailAr: `${label} (${v.registrationType ?? '—'}) تتطلب بطاقة تشغيل من هيئة النقل ولا توجد بطاقة بالرقم التسلسلي ${v.sequenceNumber}. إن كانت نقلاً خفيفاً غير خاضع فعّل «إعفاء من كرت التشغيل».`,
        detailEn: `${label} (${v.registrationType ?? '—'}) needs a TGA operating card and none matches sequence ${v.sequenceNumber}. If it is light transport, mark it exempt.`,
        dueDate: null,
      });
    }
  }

  for (const [userId, list] of vehiclesByUser) {
    if (list.length <= settings.maxVehiclesPerUser) continue;
    const name = list.find((v) => v.actualUserName)?.actualUserName ?? residentById.get(userId)?.name ?? userId;
    push({
      ruleCode: 'VEH_USER_OVERLOAD',
      fingerprint: `VEH_USER_OVERLOAD:${userId}:${list.length}`,
      severity: 'low',
      entityType: 'person',
      entityId: null,
      entityKey: userId,
      entityLabel: name,
      link: `/app/people/${userId}`,
      detailAr: `${list.length} مركبات مسجلة باسم ${name} كمستخدم فعلي: ${list.map((v) => v.plateNumber ?? v.sequenceNumber).join('، ')}.`,
      detailEn: `${list.length} vehicles list ${name} as actual user: ${list.map((v) => v.plateNumber ?? v.sequenceNumber).join(', ')}.`,
      dueDate: null,
    });
  }

  // ── Operating cards ──
  for (const c of opCardsLive) {
    const base = {
      entityType: 'operating_card' as const,
      entityId: c.id,
      entityKey: c.cardNumber,
      entityLabel: `بطاقة ${c.cardNumber}`,
      link: c.sequenceNumber && vehicleSeqs.has(c.sequenceNumber) ? `/app/fleet/${c.sequenceNumber}` : '/app/operating-cards',
    };
    if (c.recordStatus !== 'active') {
      pushMissing(push, 'operating_card', base, c.missingSince);
      continue;
    }
    expiry('OPCARD_EXPIRY', c.expiryDate, base, `بطاقة التشغيل ${c.cardNumber}`, `Operating card ${c.cardNumber}`);
    if (c.sequenceNumber && input.imported.vehicles && !vehicleSeqs.has(c.sequenceNumber)) {
      push({
        ...base,
        ruleCode: 'OPCARD_ORPHAN',
        fingerprint: `OPCARD_ORPHAN:${c.cardNumber}:${c.sequenceNumber}`,
        severity: 'low',
        detailAr: `بطاقة التشغيل ${c.cardNumber} مرتبطة بالرقم التسلسلي ${c.sequenceNumber} غير الموجود في ملف المرور؛ ربما بيعت المركبة. ألغِ البطاقة إن لم تعد مستخدمة.`,
        detailEn: `Operating card ${c.cardNumber} points to sequence ${c.sequenceNumber}, which is not in the Tamm file; the vehicle may have been sold. Cancel the card if unused.`,
        dueDate: null,
      });
    }
  }

  // ── Driver cards ──
  const cardsByDriver = new Map<string, DriverCardRow[]>();
  for (const c of driverCardsLive) {
    if (c.recordStatus !== 'active') continue;
    cardsByDriver.set(c.driverId, [...(cardsByDriver.get(c.driverId) ?? []), c]);
  }
  for (const c of driverCardsLive) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.driverId;
    const base = { entityType: 'driver_card' as const, entityId: c.id, entityKey: c.cardNumber, entityLabel: name, link: `/app/people/${c.driverId}` };
    if (c.recordStatus !== 'active') {
      pushMissing(push, 'driver_card', base, c.missingSince);
      continue;
    }
    expiry('DRVCARD_EXPIRY', c.expiryDate, base, `بطاقة السائق ${name}`, `Driver card of ${name}`);
  }

  if (input.imported.driver_cards) {
    const people = new Map<string, { name: string; occupation: string | null; source: 'residents' | 'gosi' }>();
    for (const g of gosiLive) if (g.recordStatus === 'active') people.set(g.nationalId, { name: g.name, occupation: g.occupation, source: 'gosi' });
    for (const r of residentsLive) if (r.recordStatus === 'active') people.set(r.iqamaNumber, { name: r.name, occupation: r.occupation, source: 'residents' });
    for (const [id, p] of people) {
      if (!isRegulatedDriverOccupation(p.occupation, settings)) continue;
      const cards = cardsByDriver.get(id) ?? [];
      const hasActive = cards.some((c) => isActiveCardStatus(c.requestStatus) && (daysUntil(c.expiryDate, today) ?? 1) > 0);
      if (hasActive) continue;
      push({
        ruleCode: 'DRV_CARD_MISSING',
        fingerprint: `DRV_CARD_MISSING:${id}`,
        severity: 'high',
        entityType: 'person',
        entityId: null,
        entityKey: id,
        entityLabel: p.name,
        link: `/app/people/${id}`,
        detailAr: cards.length
          ? `${p.name} (${p.occupation}) لديه بطاقة سائق غير نشطة أو منتهية. جدّدها من منصة لوجستي.`
          : `${p.name} (${p.occupation}) يعمل بمهنة خاضعة لهيئة النقل ولا توجد له بطاقة سائق.`,
        detailEn: cards.length
          ? `${p.name} (${p.occupation}) has an inactive or expired driver card. Renew it on Logisti.`
          : `${p.name} (${p.occupation}) works in a TGA-regulated occupation and has no driver card.`,
        dueDate: null,
      });
    }
  }

  // ── Cross-file: Muqeem ↔ GOSI ──
  if (input.imported.gosi) {
    for (const r of residentsLive) {
      if (r.recordStatus !== 'active' || gosiById.has(r.iqamaNumber)) continue;
      push({
        ruleCode: 'X_RESIDENT_NOT_IN_GOSI',
        fingerprint: `X_RESIDENT_NOT_IN_GOSI:${r.iqamaNumber}`,
        severity: 'medium',
        entityType: 'resident',
        entityId: r.id,
        entityKey: r.iqamaNumber,
        entityLabel: r.name,
        link: `/app/people/${r.iqamaNumber}`,
        detailAr: `${r.name} مقيم نشط على المنشأة في مقيم ولا يظهر في ملف التأمينات الاجتماعية.`,
        detailEn: `${r.name} is an active resident in Muqeem but is not in the GOSI file.`,
        dueDate: null,
      });
    }
  }
  if (input.imported.residents) {
    for (const g of gosiLive) {
      if (g.recordStatus !== 'active' || g.isSaudi || !g.nationalId.startsWith('2') || residentById.has(g.nationalId)) continue;
      push({
        ruleCode: 'X_GOSI_NOT_IN_RESIDENTS',
        fingerprint: `X_GOSI_NOT_IN_RESIDENTS:${g.nationalId}`,
        severity: 'high',
        entityType: 'gosi',
        entityId: g.id,
        entityKey: g.nationalId,
        entityLabel: g.name,
        link: `/app/people/${g.nationalId}`,
        detailAr: `${g.name} ما زال مشتركاً في التأمينات وتُدفع عنه اشتراكات، لكنه غير موجود في ملف المقيمين النشطين. استبعده من التأمينات إن غادر المنشأة.`,
        detailEn: `${g.name} is still a GOSI subscriber with contributions paid, but is not among active residents. Remove them from GOSI if they left.`,
        dueDate: null,
      });
    }
  }
  for (const r of residentsLive) {
    const g = gosiById.get(r.iqamaNumber);
    if (!g || r.recordStatus !== 'active' || g.recordStatus !== 'active') continue;
    if (sameOccupation(r.occupation, g.occupation)) continue;
    push({
      ruleCode: 'X_OCCUPATION_MISMATCH',
      fingerprint: `X_OCCUPATION_MISMATCH:${r.iqamaNumber}:${r.occupation}:${g.occupation}`,
      severity: 'low',
      entityType: 'resident',
      entityId: r.id,
      entityKey: r.iqamaNumber,
      entityLabel: r.name,
      link: `/app/people/${r.iqamaNumber}`,
      detailAr: `مهنة ${r.name} في مقيم «${r.occupation}» وفي التأمينات «${g.occupation}». وحّد المهنة لتجنب مخالفات التفتيش.`,
      detailEn: `${r.name}'s occupation is "${r.occupation}" in Muqeem and "${g.occupation}" in GOSI. Align them to avoid inspection findings.`,
      dueDate: null,
    });
  }

  // ── Document hub ──
  for (const d of input.documents) {
    if (d.status === 'archived' || !d.expiryDate) continue;
    const window = Math.max(EXPIRY_WINDOW_DAYS, ...(d.alertDays ?? []));
    const days = daysUntil(d.expiryDate, today)!;
    if (days > window) continue;
    const authorityAr = d.authority?.nameAr ? ` (${d.authority.nameAr})` : '';
    const authorityEn = d.authority?.nameEn ? ` (${d.authority.nameEn})` : '';
    const inProgressAr = d.status === 'renewal_in_progress' ? ' التجديد جارٍ.' : '';
    const inProgressEn = d.status === 'renewal_in_progress' ? ' Renewal in progress.' : '';
    push({
      ruleCode: 'DOC_EXPIRY',
      fingerprint: `DOC_EXPIRY:${d.id}:${d.expiryDate}`,
      severity: days > EXPIRY_WINDOW_DAYS ? 'low' : severityForBucket(bucketForDays(days)),
      entityType: 'document',
      entityId: d.id,
      entityKey: d.id,
      entityLabel: d.title,
      link: `/app/documents?doc=${d.id}`,
      titleAr: `انتهاء ${d.title}`,
      titleEn: `${d.title} expiry`,
      detailAr: `${d.title}${authorityAr} — ${arRemaining(days)} (${d.expiryDate}).${inProgressAr}`,
      detailEn: `${d.title}${authorityEn} — ${enRemaining(days)} (${d.expiryDate}).${inProgressEn}`,
      dueDate: d.expiryDate,
    });
  }

  return out.sort((a, b) => compareSeverity(a.severity, b.severity) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}

function pushMissing(
  push: (c: Omit<AlertCandidate, 'module' | 'titleAr' | 'titleEn'>) => void,
  kind: keyof typeof MISSING_TEMPLATE_AR,
  base: Pick<AlertCandidate, 'entityType' | 'entityId' | 'entityKey' | 'entityLabel' | 'link'>,
  since: Date | null,
) {
  const sinceText = since ? since.toISOString().slice(0, 10) : '';
  push({
    ...base,
    ruleCode: 'REC_MISSING',
    fingerprint: `REC_MISSING:${base.entityType}:${base.entityKey}`,
    severity: 'medium',
    detailAr: `${base.entityLabel} لم يعد موجوداً في آخر ${MISSING_TEMPLATE_AR[kind]}${sinceText ? ` منذ ${sinceText}` : ''}. أرشفه مع السبب (نقل كفالة، خروج نهائي، بيع مركبة…).`,
    detailEn: `${base.entityLabel} is no longer in the latest ${MISSING_TEMPLATE_EN[kind]}${sinceText ? ` since ${sinceText}` : ''}. Archive it with a reason (sponsorship transfer, final exit, vehicle sold…).`,
    dueDate: null,
  });
}

export { arDays, enDays };
