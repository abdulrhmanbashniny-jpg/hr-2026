/**
 * Writes synthetic workbooks that reproduce the exact layout of each government export — including
 * GOSI's merged cells and blank columns, Tamm's Hijri dates and duplicate column, and Logisti's
 * driver card numbers stored as decimals — so the importer can be tested end-to-end.
 */
import ExcelJS from 'exceljs';
import type { SeedDataset } from '@/db/seed-data';
import { toHijri } from '@/lib/dates';
import type { TemplateKey } from './types';

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export async function buildSampleWorkbook(template: TemplateKey, data: SeedDataset): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  switch (template) {
    case 'residents': {
      const ws = wb.addWorksheet('المقيمين النشطين');
      ws.addRow(['رقم الاقامة', 'الاسم', 'الجنس', 'الجنسية', 'المهنة', 'رقم الجواز', 'تاريخ انتهاء الجواز', 'تاريخ اصدار الاقامة', 'تاريخ انتهاء الاقامة', 'تاريخ الميلاد', 'خارج المملكه', 'تاريخ انتهاء الاقامة بالهجري', 'رقم صاحب العمل']);
      for (const r of data.residents) {
        ws.addRow([r.iqamaNumber, r.name, r.gender, r.nationality, r.occupation, r.passportNumber, r.passportExpiry, r.iqamaIssueDate, r.iqamaExpiry, r.birthDate, r.outsideKingdom ? 'نعم' : 'لا', r.iqamaExpiryHijri, r.employerNumber]);
      }
      break;
    }
    case 'gosi': {
      const ws = wb.addWorksheet('قائمة المشتركين النشطين');
      // 19 physical columns: E, I, L, O and S are blank halves of merged cells.
      ws.addRow(['اسم المشترك', 'رقم الهوية', 'الجنسية', 'الجنس', null, 'تاريخ الميلاد', 'الأجر الأساسي', 'السكن', null, 'العمولات', 'البدلات الأخرى', null, 'إجمالي الأجر', 'الاجر الخاضع للاشتراك', null, 'المهنة', 'تاريخ الإلتحاق', 'الاهلية لنظام التأمينات الاجتماعية 1445هـ', null]);
      for (const g of data.gosi) {
        const row = ws.addRow([
          g.name,
          Number(g.nationalId),
          g.isSaudi ? 'السعودية ' : `${g.nationality} `,
          g.gender,
          null,
          isoToDate(g.birthDate),
          String(g.basicWage),
          String(g.housingAllowance),
          null,
          String(g.commissions),
          String(g.otherAllowances),
          null,
          String(g.totalWage),
          String(g.contributoryWage),
          null,
          g.occupation,
          isoToDate(g.joinDate),
          g.newSystemEligible ? 'نعم' : 'لا',
          null,
        ]);
        row.getCell(6).numFmt = 'yyyy\\-mm\\-dd';
        row.getCell(17).numFmt = 'yyyy\\-mm\\-dd';
      }
      const last = data.gosi.length + 1;
      for (let r = 1; r <= last + 6; r++) {
        for (const [a, b] of [['D', 'E'], ['H', 'I'], ['K', 'L'], ['N', 'O'], ['R', 'S']]) ws.mergeCells(`${a}${r}:${b}${r}`);
      }
      for (let r = last + 7; r <= last + 9; r++) ws.mergeCells(`A${r}:K${r}`);
      break;
    }
    case 'vehicles': {
      const ws = wb.addWorksheet('vehicle_list');
      ws.addRow(['رقم اللوحة', 'نوع التسجيل', 'الفرع', 'الماركة', 'الطراز', 'سنة الصنع', 'الرقم التسلسلي', 'رقم الهيكل', 'اللون الأساسي', 'وضع المركبة', 'تاريخ الملكية', 'تاريخ انتهاء رخصة السير', 'تاريخ انتهاء الفحص', 'رقم هوية المستخدم الفعلي', 'اسم المستخدم الفعلي', 'حالة الفحص', 'حالة التأمين', 'حالة التحفظ', 'تاريخ إصدار الاستمارة', 'وضع المركبة', 'نوع الهيكل']);
      for (const v of data.vehicles) {
        ws.addRow([
          v.plateNumber,
          v.registrationType,
          v.branch ?? '-',
          v.make,
          v.model,
          String(v.manufactureYear),
          Number(v.sequenceNumber),
          v.chassisNumber,
          v.color,
          v.vehicleStatus,
          v.ownershipDate ? toHijri(v.ownershipDate) : '-',
          toHijri(v.licenseExpiry),
          toHijri(v.inspectionExpiry),
          v.actualUserId ? Number(v.actualUserId) : '-',
          v.actualUserName ?? '-',
          v.inspectionStatus,
          v.insuranceStatus,
          v.restrictionStatus,
          toHijri(v.formIssueDate),
          v.vehicleStatus,
          v.bodyType,
        ]);
      }
      break;
    }
    case 'operating_cards': {
      const ws = wb.addWorksheet('ورقة1');
      ws.addRow(['رقم البطاقة', 'الرقم التسلسلي', 'النشاط', 'تاريخ الإصدار ', 'تاريخ الانتهاء', 'الحالة']);
      for (const c of data.operatingCards) {
        const row = ws.addRow([c.cardNumber, Number(c.sequenceNumber), c.activity, isoToDate(c.issueDate), isoToDate(c.expiryDate), c.cardStatus]);
        row.getCell(4).numFmt = 'mm-dd-yy';
        row.getCell(5).numFmt = 'mm-dd-yy';
      }
      break;
    }
    case 'driver_cards': {
      const ws = wb.addWorksheet('ورقة1');
      ws.addRow(['هوية السائق', 'الاسم الأول', 'اسم العائلة', 'رقم البطاقة ', 'النشاط', 'تاريخ الإصدار ', 'تاريخ الانتهاء ', 'تصنيف البطاقة', 'حالة الطلب']);
      data.driverCards.forEach((c, i) => {
        // Some exports store the card number as a decimal; alternate to exercise both shapes.
        const card = i % 2 === 0 ? Number(c.cardNumber) : c.cardNumber;
        const row = ws.addRow([Number(c.driverId), c.firstName, c.lastName, card, c.activity, isoToDate(c.issueDate), isoToDate(c.expiryDate), c.cardClass, c.requestStatus]);
        row.getCell(4).numFmt = '@';
        row.getCell(6).numFmt = 'mm-dd-yy';
        row.getCell(7).numFmt = 'mm-dd-yy';
      });
      break;
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const SAMPLE_FILE_NAMES: Record<TemplateKey, string> = {
  residents: 'المقيمين النشطين.xlsx',
  gosi: 'gosi.xlsx',
  vehicles: 'vehicle_list.xlsx',
  operating_cards: 'بطاقات التشغيل.xlsx',
  driver_cards: 'بطاقات السائقين.xlsx',
};
