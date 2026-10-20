import { describe, expect, it } from 'vitest';
import { isRegulatedDriverOccupation, operatingCardRequirement } from '@/lib/rules/classify';
import { evaluateRules } from '@/lib/rules/engine';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { doc, driverCard, gosi, input, opCard, resident, vehicle } from './factories';

const codes = (xs: { ruleCode: string }[]) => xs.map((x) => x.ruleCode);

describe('residents rules', () => {
  it('opens an expiry alert inside 90 days with bucket severity', () => {
    const r = resident({ iqamaExpiry: '2026-11-05' });
    const out = evaluateRules(input({ residents: [r], gosi: [gosi({ nationalId: r.iqamaNumber, isSaudi: false, occupation: r.occupation })] }));
    const a = out.find((x) => x.ruleCode === 'RES_IQAMA_EXPIRY')!;
    expect(a.severity).toBe('high');
    expect(a.fingerprint).toContain('2026-11-05');
    expect(a.detailAr).toContain('باقٍ 16 يوماً');
  });

  it('blocks renewal when the passport expired or ends before the iqama', () => {
    const expiredPassport = resident({ iqamaExpiry: '2026-11-05', passportExpiry: '2026-09-01' });
    const shortPassport = resident({ iqamaExpiry: '2026-12-30', passportExpiry: '2026-12-15' });
    const fine = resident({ iqamaExpiry: '2026-12-30', passportExpiry: '2029-01-01' });
    const out = evaluateRules(input({ residents: [expiredPassport, shortPassport, fine], imported: { residents: true, gosi: false, vehicles: false, operating_cards: false, driver_cards: false } }));
    const blocked = out.filter((x) => x.ruleCode === 'RES_RENEWAL_BLOCKED').map((x) => x.entityKey);
    expect(blocked).toEqual(expect.arrayContaining([expiredPassport.iqamaNumber, shortPassport.iqamaNumber]));
    expect(blocked).not.toContain(fine.iqamaNumber);
  });

  it('warns about employees abroad whose documents are close to expiry, and about seniors', () => {
    const abroad = resident({ outsideKingdom: true, iqamaExpiry: '2026-11-30' });
    const senior = resident({ birthDate: '1960-05-01' });
    const out = evaluateRules(input({ residents: [abroad, senior], imported: { residents: true, gosi: false, vehicles: false, operating_cards: false, driver_cards: false } }));
    expect(out.find((x) => x.ruleCode === 'RES_ABROAD_EXPIRY')?.entityKey).toBe(abroad.iqamaNumber);
    expect(out.find((x) => x.ruleCode === 'RES_SENIOR')?.entityKey).toBe(senior.iqamaNumber);
  });

  it('asks to archive records missing from the latest file', () => {
    const out = evaluateRules(input({ residents: [resident({ recordStatus: 'missing' })] }));
    expect(codes(out)).toContain('REC_MISSING');
  });
});

describe('GOSI rules', () => {
  it('flags Saudi wages under 4,000 and probation ending within 15 days', () => {
    const low = gosi({ contributoryWage: 3500 });
    const probation = gosi({ joinDate: '2026-07-30' }); // 90 days → 2026-10-28
    const out = evaluateRules(input({ gosi: [low, probation] }));
    expect(out.find((x) => x.ruleCode === 'GOSI_LOW_WAGE_SAUDI')?.entityKey).toBe(low.nationalId);
    expect(out.find((x) => x.ruleCode === 'GOSI_PROBATION_END')?.dueDate).toBe('2026-10-28');
  });

  it('cross-checks Muqeem and GOSI both ways and occupation mismatches', () => {
    const r1 = resident({ occupation: 'محاسب' });
    const r2 = resident();
    const g1 = gosi({ nationalId: r1.iqamaNumber, isSaudi: false, occupation: 'عامل' });
    const ghost = gosi({ nationalId: '2777777777', isSaudi: false });
    const out = evaluateRules(input({ residents: [r1, r2], gosi: [g1, ghost] }));
    expect(out.find((x) => x.ruleCode === 'X_RESIDENT_NOT_IN_GOSI')?.entityKey).toBe(r2.iqamaNumber);
    expect(out.find((x) => x.ruleCode === 'X_GOSI_NOT_IN_RESIDENTS')?.entityKey).toBe('2777777777');
    expect(out.find((x) => x.ruleCode === 'X_OCCUPATION_MISMATCH')?.entityKey).toBe(r1.iqamaNumber);
  });

  it('does not run cross-file rules before the other file was ever uploaded', () => {
    const out = evaluateRules(input({ residents: [resident()], imported: { residents: true, gosi: false, vehicles: false, operating_cards: false, driver_cards: false } }));
    expect(codes(out)).not.toContain('X_RESIDENT_NOT_IN_GOSI');
  });
});

describe('fleet and TGA rules', () => {
  it('requires operating cards only for medium/heavy transport, with manual overrides', () => {
    const s = DEFAULT_SETTINGS;
    expect(operatingCardRequirement({ registrationType: 'نقل خاص', model: 'أكتروس شاحنة ثقيلة', bodyType: 'شاحنة', operatingCardRequirement: 'auto' }, s).required).toBe(true);
    expect(operatingCardRequirement({ registrationType: 'نقل خاص', model: 'بكب نصف نقل', bodyType: '3 عجلات', operatingCardRequirement: 'auto' }, s)).toEqual({ required: false, reason: 'light_vehicle' });
    expect(operatingCardRequirement({ registrationType: 'خصوصي', model: 'كامري', bodyType: 'سيدان', operatingCardRequirement: 'auto' }, s).reason).toBe('not_commercial');
    expect(operatingCardRequirement({ registrationType: 'نقل خاص', model: 'بكب', bodyType: null, operatingCardRequirement: 'required' }, s).required).toBe(true);
    expect(operatingCardRequirement({ registrationType: 'نقل خاص', model: 'شاحنة', bodyType: null, operatingCardRequirement: 'exempt' }, s).required).toBe(false);
  });

  it('opens missing-card alerts for heavy vehicles only and links cards by sequence number', () => {
    const heavy = vehicle();
    const covered = vehicle();
    const pickup = vehicle({ model: 'هايلكس بكب' });
    const out = evaluateRules(input({ vehicles: [heavy, covered, pickup], operatingCards: [opCard({ sequenceNumber: covered.sequenceNumber })] }));
    expect(out.filter((x) => x.ruleCode === 'VEH_OPCARD_MISSING').map((x) => x.entityKey)).toEqual([heavy.sequenceNumber]);
  });

  it('flags insurance, restrictions, users abroad or with expired iqamas, and overloaded users', () => {
    const abroad = resident({ outsideKingdom: true });
    const expired = resident({ iqamaExpiry: '2026-10-01' });
    const vs = [
      vehicle({ insuranceStatus: 'غير ساري', actualUserId: abroad.iqamaNumber }),
      vehicle({ restrictionStatus: 'متحفظ عليها', actualUserId: expired.iqamaNumber }),
      vehicle({ actualUserId: null, actualUserName: null }),
      vehicle({ actualUserId: '2555555555' }),
      vehicle({ actualUserId: '2555555555' }),
    ];
    const out = codes(evaluateRules(input({ vehicles: vs, residents: [abroad, expired], operatingCards: vs.map((v) => opCard({ sequenceNumber: v.sequenceNumber })) })));
    for (const c of ['VEH_INSURANCE_INVALID', 'VEH_RESTRICTED', 'VEH_NO_USER', 'VEH_USER_OVERLOAD', 'X_VEHICLE_USER_ABROAD', 'X_VEHICLE_USER_IQAMA_EXPIRED']) expect(out).toContain(c);
  });

  it('regulated drivers: heavy truck drivers need a card, forklift drivers do not', () => {
    expect(isRegulatedDriverOccupation('سائق شاحنة ثقيلة', DEFAULT_SETTINGS)).toBe(true);
    expect(isRegulatedDriverOccupation('سائق رافعة شوكية', DEFAULT_SETTINGS)).toBe(false);
    const withCard = resident({ occupation: 'سائق شاحنة ثقيلة' });
    const without = resident({ occupation: 'سائق شاحنة ثقيلة' });
    const forklift = resident({ occupation: 'سائق رافعة شوكية' });
    const out = evaluateRules(input({ residents: [withCard, without, forklift], driverCards: [driverCard({ driverId: withCard.iqamaNumber })], imported: { residents: true, gosi: false, vehicles: false, operating_cards: false, driver_cards: true } }));
    expect(out.filter((x) => x.ruleCode === 'DRV_CARD_MISSING').map((x) => x.entityKey)).toEqual([without.iqamaNumber]);
  });
});

describe('documents', () => {
  it('uses the document reminder days as the window', () => {
    const out = evaluateRules(input({ documents: [doc({ expiryDate: '2026-12-25', alertDays: [120, 30] }), doc({ expiryDate: '2027-06-01' }), doc({ expiryDate: '2026-10-01', status: 'archived' })] }));
    expect(out.filter((x) => x.ruleCode === 'DOC_EXPIRY')).toHaveLength(1);
  });
});
