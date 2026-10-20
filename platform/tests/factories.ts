import type { DocumentRow, DriverCardRow, GosiRow, OperatingCardRow, ResidentRow, RulesInput, VehicleRow } from '@/lib/rules/engine';
import { DEFAULT_SETTINGS } from '@/lib/settings';

let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const life = () => ({ recordStatus: 'active' as const, missingSince: null, archivedAt: null, archiveReason: null, lastImportId: null, manuallyUpdatedAt: null, createdAt: new Date(), updatedAt: new Date(), tenantId: 'tenant' });

export const resident = (p: Partial<ResidentRow> = {}): ResidentRow => ({
  id: uid(), iqamaNumber: `2${String(100000000 + n)}`, name: 'Test Resident', gender: 'ذكر', nationality: 'مصر', occupation: 'محاسب', passportNumber: 'A1',
  passportExpiry: '2030-01-01', iqamaIssueDate: '2020-01-01', iqamaExpiry: '2028-01-01', birthDate: '1990-01-01', outsideKingdom: false, iqamaExpiryHijri: null, employerNumber: null,
  ...life(), ...p,
});

export const gosi = (p: Partial<GosiRow> = {}): GosiRow => ({
  id: uid(), nationalId: `1${String(100000000 + n)}`, name: 'Test Subscriber', nationality: 'السعودية', isSaudi: true, gender: 'ذكر', birthDate: '1990-01-01',
  basicWage: 6000, housingAllowance: 1500, commissions: 0, otherAllowances: 0, totalWage: 7500, contributoryWage: 7500, occupation: 'محاسب', joinDate: '2020-01-01',
  newSystemEligible: false, probationDays: null, probationReviewedAt: null, ...life(), ...p,
});

export const vehicle = (p: Partial<VehicleRow> = {}): VehicleRow => ({
  id: uid(), sequenceNumber: String(100000000 + ++n), plateNumber: 'أ ب ج 1', registrationType: 'نقل خاص', branch: null, make: 'مرسيدس', model: 'أكتروس شاحنة ثقيلة', manufactureYear: 2020,
  chassisNumber: null, color: null, vehicleStatus: 'صالحة', ownershipDate: null, ownershipDateHijri: null, licenseExpiry: '2028-01-01', licenseExpiryHijri: null, inspectionExpiry: '2028-01-01',
  inspectionExpiryHijri: null, actualUserId: '2999999999', actualUserName: 'X', inspectionStatus: 'ساري', insuranceStatus: 'ساري المفعول', restrictionStatus: 'غير متحفظ',
  formIssueDate: null, formIssueDateHijri: null, bodyType: 'شاحنة', operatingCardRequirement: 'auto', ...life(), ...p,
});

export const opCard = (p: Partial<OperatingCardRow> = {}): OperatingCardRow => ({
  id: uid(), cardNumber: `33-${String(10000000 + ++n)}`, sequenceNumber: null, activity: 'نقل', issueDate: '2026-01-01', expiryDate: '2027-06-01', cardStatus: 'نشط', ...life(), ...p,
});

export const driverCard = (p: Partial<DriverCardRow> = {}): DriverCardRow => ({
  id: uid(), cardNumber: `33.${String(10000000 + ++n)}`, driverId: '2000000000', firstName: 'A', lastName: 'B', activity: 'نقل', issueDate: '2026-01-01', expiryDate: '2027-06-01',
  cardClass: 'سنوية', requestStatus: 'نشط', ...life(), ...p,
});

export const doc = (p: Partial<DocumentRow> = {}): DocumentRow => ({
  id: uid(), tenantId: 'tenant', title: 'السجل التجاري', authorityId: null, referenceNumber: null, issueDate: null, expiryDate: '2027-01-01', issueDateHijri: null, expiryDateHijri: null,
  enteredCalendar: 'gregorian', alertDays: [60, 30, 15, 4], responsibleContactId: null, renewalFee: null, fileKey: null, fileName: null, fileMime: null, fileSize: null,
  externalUrl: null, notes: null, status: 'active', createdBy: null, createdAt: new Date(), updatedAt: new Date(), authority: null, ...p,
});

export function input(p: Partial<RulesInput> = {}): RulesInput {
  return {
    today: '2026-10-20',
    settings: DEFAULT_SETTINGS,
    residents: [],
    gosi: [],
    vehicles: [],
    operatingCards: [],
    driverCards: [],
    documents: [],
    imported: { residents: true, gosi: true, vehicles: true, operating_cards: true, driver_cards: true },
    ...p,
  };
}
