/**
 * Idempotent seed: admin user, business settings and (unless SEED_DEMO=false) a coherent demo
 * data set with dates relative to today (Asia/Jerusalem).
 *
 *   npm run db:seed            (repo root, loads .env)
 *   SEED_DEMO=false ...        admin + settings only (production)
 *
 * Every demo row has a fixed `seed_*` id and is upserted with `update: {}`: re-running creates
 * what is missing and never overwrites data (or the admin password) changed in the app. The only
 * exceptions are `migrateLegacyDemo()`, which once rewrites the demo rows of older seed versions,
 * and `migrateLegacySpelling()`, which once fixes the old spelling of the business name.
 * Demo documents write small placeholder files (PDF / PNG) into UPLOAD_DIR.
 * `npm run db:reset` drops everything and seeds again with fresh relative dates.
 */
import {
  CommissionMode,
  LedgerEntry,
  PaymentMethod,
  Prisma,
  PrismaClient,
  type LeaseSegment,
} from '@prisma/client';
import {
  addDays,
  addMonths,
  addPeriods,
  addWorkingDays,
  annualFeeDueDate,
  BUSINESS_NAME,
  BusinessNameSchema,
  computeCommission,
  createTransferChecklist,
  daysInMonth,
  DEFAULT_BUSINESS_TZ,
  DEFAULT_REMINDER_LEAD_DAYS,
  DEFAULT_RESPONSIBILITIES,
  fineReassignDeadline,
  HandoverChecklistSchema,
  ReturnChecklistSchema,
  isValidIsraeliId,
  maxIsoDate,
  minIsoDate,
  password as passwordPolicy,
  periodOf,
  prorate,
  todayInBusinessTz,
  TRANSFER_DUE_WORKING_DAYS,
} from '@renawi/shared';
import { resolve } from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { hashPassword } from '../src/auth/password';
import {
  penaltyAmount,
  planRentCharges,
  toBillingContract,
  toBillingSegments,
  unusedRentCredits,
} from '../src/leases/billing-plan';
import { allocateFifo } from '../src/ledger/allocation';
import { makeThumbnail } from '../src/documents/file-type';
import { LocalDiskStorage } from '../src/documents/storage/local-disk.storage';
import { thumbKeyOf } from '../src/documents/storage/storage.service';

const prisma = new PrismaClient();

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** `@db.Date` value for a `YYYY-MM-DD` string. */
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
/** Timestamp at a UTC clock time on a calendar date. */
const at = (iso: string, hhmm = '09:00'): Date => new Date(`${iso}T${hhmm}:00.000Z`);
/** Decimal(12,2) value. */
const ils = (amount: number): Prisma.Decimal => new Prisma.Decimal(amount.toFixed(2));

/** Israeli ID / company number: appends the check digit to 8 digits. */
function withCheckDigit(first8: string): string {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let n = Number(first8[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  const id = `${first8}${(10 - (sum % 10)) % 10}`;
  if (!isValidIsraeliId(id)) throw new Error(`Bad generated ID ${id}`);
  return id;
}

let created = 0;
let existing = 0;

/* Demo texts shared by the create data and the legacy migration. */
const OCTAVIA_LOCATION = 'תחנת המוניות — רכב רזרבי';
const OCTAVIA_NOTES = 'רכב מונית רזרבי של העסק — פנוי להשכרה';
const OCTAVIA_SERVICE_DESCRIPTION = 'טיפול גדול + מצמד — הכנה להשכרה';
const OCTAVIA_ODO_SOURCES = ['הכנה להשכרה', 'בדיקה במגרש'] as const;
const MIZRAHI_SWAP_REASON =
  'החלפת רכב: רכב הנהג במוסך אחרי תאונה — הרישיון הועבר לרכב החלופי של הנהג';

/** Create-only upsert by id (`update: {}`) that counts what happened. */
async function ensure<T>(find: () => Promise<unknown>, upsert: () => Promise<T>): Promise<T> {
  if (await find()) existing++;
  else created++;
  return upsert();
}

/* ------------------------------------------------------------------------------------------ */
/* Admin + settings (always)                                                                  */
/* ------------------------------------------------------------------------------------------ */

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const plain = process.env.ADMIN_PASSWORD;
  if (!email || !plain) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set (see .env)');
  const policy = passwordPolicy.safeParse(plain);
  if (!policy.success) {
    throw new Error('ADMIN_PASSWORD must be 8-128 characters with at least one letter and digit');
  }
  const found = await prisma.user.findUnique({ where: { email } });
  if (found) {
    existing++;
    return found;
  }
  created++;
  return prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME?.trim() || 'Elias Renawi',
      role: 'ADMIN',
      locale: 'he',
      theme: 'system',
      passwordHash: await hashPassword(plain),
    },
  });
}

const LEASE_CLAUSES = {
  he: [
    '1. השוכר משלם את דמי השכירות החודשיים מראש, עד יום התשלום הקבוע בחוזה.',
    '2. בתקופת השכירות השוכר אחראי לביטוח, לטסט, לתיקונים ולדוחות התנועה — למעט הרכב עצמו.',
    '3. הפיקדון יוחזר בתום החוזה בניכוי חובות פתוחים ונזקים.',
    '4. סיום מוקדם מחייב הודעה של 30 יום ופיצוי מוסכם בגובה דמי שכירות של חודש אחד.',
  ].join('\n'),
  ar: [
    '1. يدفع المستأجر الإيجار الشهري مسبقاً حتى يوم الدفع المحدد في العقد.',
    '2. يتحمّل المستأجر خلال فترة الإيجار التأمين والفحص السنوي والتصليحات والمخالفات المرورية، باستثناء السيارة نفسها.',
    '3. تُعاد الوديعة عند انتهاء العقد بعد خصم الديون المفتوحة والأضرار.',
    '4. الإنهاء المبكر يتطلب إشعاراً قبل 30 يوماً وتعويضاً متفقاً عليه بقيمة إيجار شهر واحد.',
  ].join('\n'),
  en: [
    '1. The lessee pays the monthly rent in advance, by the payment day set in the contract.',
    '2. During the lease the lessee is responsible for insurance, the annual test, repairs and traffic fines - except for the car itself.',
    '3. The deposit is returned at the end of the contract less open debts and damages.',
    "4. Early termination requires 30 days' notice and agreed compensation of one month's rent.",
  ].join('\n'),
};

async function seedSettings() {
  await ensure(
    () => prisma.settings.findUnique({ where: { id: 1 } }),
    () =>
      prisma.settings.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          businessName: { ...BUSINESS_NAME },
          legalId: withCheckDigit('51642718'),
          dealerLicenseNo: '2026-0417',
          address: 'רח׳ פאולוס השישי 45, נצרת',
          phone: '046001234',
          email: 'office@renawimotors.co.il',
          vatRate: new Prisma.Decimal('18.00'),
          reminderLeadDays: { ...DEFAULT_REMINDER_LEAD_DAYS },
          defaultLeaseTerms: {
            responsibilities: { ...DEFAULT_RESPONSIBILITIES },
            clauses: LEASE_CLAUSES,
          },
        },
      }),
  );
}

/** Demo taxi licences are held by the company. */
const LICENSE_HOLDER = `${BUSINESS_NAME.he} בע״מ`;

/**
 * Operating-licence renewal of the idle licence 40633, 80 days ahead: beyond the 60 lead days of
 * licence fees / renewals, so the feed lists it as "upcoming" in a 90-day window.
 */
const LICENSE_40633_RENEWAL = (T: string): string => addDays(T, 80);

/**
 * Older seed versions (and the app's defaults before November 2026) spelled the name רנאוי /
 * رناوي; the owner's spelling is רינאוי / ريناوي. Rewrites the word in the stored business name
 * (he/ar only; the rest of a name edited in the app is kept) and in the holder name of the demo
 * licences that still have the old seed value. No-op on fresh or already fixed data.
 */
async function migrateLegacySpelling(): Promise<void> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const name = BusinessNameSchema.safeParse(settings?.businessName);
  if (name.success) {
    const fixed = {
      ...name.data,
      he: name.data.he.replaceAll('רנאוי', 'רינאוי'),
      ar: name.data.ar.replaceAll('رناوي', 'ريناوي'),
    };
    if (fixed.he !== name.data.he || fixed.ar !== name.data.ar) {
      await prisma.settings.update({ where: { id: 1 }, data: { businessName: fixed } });
      console.log(`Fixed the business name spelling: ${fixed.he} / ${fixed.ar}.`);
    }
  }
  const licences = await prisma.taxiLicense.updateMany({
    where: { id: { startsWith: 'seed_tl_' }, holderName: 'רנאוי מוטורס בע״מ' },
    data: { holderName: LICENSE_HOLDER },
  });
  if (licences.count)
    console.log(`Fixed the holder name spelling on ${licences.count} demo licences.`);
}

/**
 * Milestone 4 deal rules applied to demo rows of earlier seed versions (no-op on fresh or already
 * fixed data; rows changed in the app are left alone): a consignment sale has VAT mode NONE and
 * the commission / payout of its cycle rule, and a car with a draft / pending sale is RESERVED.
 */
async function fixDemoDeals(consignment: { commission: number; payout: number }): Promise<void> {
  const rav4 = await prisma.deal.updateMany({
    where: {
      id: 'seed_deal_consign_rav4',
      status: { in: ['DRAFT', 'PENDING'] },
      OR: [{ vatMode: { not: 'NONE' } }, { commissionAmount: null }, { payoutAmount: null }],
    },
    data: {
      vatMode: 'NONE',
      commissionAmount: ils(consignment.commission),
      payoutAmount: ils(consignment.payout),
    },
  });
  const draft = await prisma.deal.findUnique({
    where: { id: 'seed_deal_draft_sportage' },
    select: { status: true },
  });
  const sportage =
    draft && (draft.status === 'DRAFT' || draft.status === 'PENDING')
      ? await prisma.vehicle.updateMany({
          where: { id: 'seed_v_kia_sportage', status: 'IN_STOCK' },
          data: { status: 'RESERVED' },
        })
      : { count: 0 };
  if (rav4.count || sportage.count) {
    console.log('Applied the deal rules to older demo deals (consignment VAT, reserved car).');
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Ledger FIFO allocation cache (the API's own rule: src/ledger/allocation.ts)                */
/* ------------------------------------------------------------------------------------------ */

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Deletes and rebuilds a driver's PaymentAllocation rows with the API's `allocateFifo`. */
async function reallocateDriver(driverId: string): Promise<void> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { driverId, voidedAt: null, type: { in: ['CHARGE', 'PAYMENT', 'CREDIT'] } },
  });
  const rows = allocateFifo(
    entries
      .filter((e) => e.type === 'CHARGE')
      .map((e) => ({
        id: e.id,
        amount: e.amount,
        date: isoDay(e.date),
        dueDate: e.dueDate ? isoDay(e.dueDate) : null,
      })),
    entries
      .filter((e) => e.type !== 'CHARGE')
      .map((e) => ({ id: e.id, amount: e.amount, date: isoDay(e.date), allocateTo: e.allocateTo })),
  );
  await prisma.$transaction([
    prisma.paymentAllocation.deleteMany({
      where: { OR: [{ payment: { driverId } }, { charge: { driverId } }] },
    }),
    prisma.paymentAllocation.createMany({
      data: rows.map((r) => ({
        paymentId: r.paymentId,
        chargeId: r.chargeId,
        amount: ils(r.amount),
      })),
    }),
  ]);
}

/* ------------------------------------------------------------------------------------------ */
/* Legacy demo data                                                                           */
/* ------------------------------------------------------------------------------------------ */

/**
 * Earlier seed versions put our Octavia on Avi Mizrahi's NUMBER_ONLY lease (segment 2, at car +
 * number rent) and registered licence 31952 on it. A NUMBER_ONLY segment may only point to the
 * driver's own THIRD_PARTY car, so the swap now uses his replacement Niro and the Octavia is an
 * idle reserve taxi. Rewrites those rows once and drops Mizrahi's seeded rent charges / payments
 * so they are regenerated from the corrected segments. No-op on fresh or already migrated data.
 */
async function migrateLegacyDemo(): Promise<void> {
  const segment = await prisma.leaseSegment.findUnique({ where: { id: 'seed_seg_mizrahi_2' } });
  if (segment?.vehicleId !== 'seed_v_taxi_octavia') return;
  await prisma.$transaction([
    prisma.paymentAllocation.deleteMany({ where: { payment: { driverId: 'seed_drv_mizrahi' } } }),
    prisma.ledgerEntry.deleteMany({
      where: {
        driverId: 'seed_drv_mizrahi',
        id: { startsWith: 'seed_le_mizrahi_' },
        type: { in: ['CHARGE', 'PAYMENT'] },
      },
    }),
    prisma.leaseSegment.update({
      where: { id: 'seed_seg_mizrahi_2' },
      data: {
        vehicleId: 'seed_v_mizrahi_niro',
        monthlyRent: ils(1_350),
        reason: MIZRAHI_SWAP_REASON,
      },
    }),
    prisma.leaseSegment.update({
      where: { id: 'seed_seg_mizrahi_1' },
      data: { vehicleId: 'seed_v_ioniq_driver' },
    }),
    prisma.taxiLicense.update({
      where: { id: 'seed_tl_31952' },
      data: { registeredVehicleId: 'seed_v_mizrahi_niro' },
    }),
    prisma.vehicle.update({
      where: { id: 'seed_v_taxi_octavia' },
      data: { status: 'IN_STOCK', location: OCTAVIA_LOCATION, notes: OCTAVIA_NOTES },
    }),
    prisma.vehicleExpense.update({
      where: { id: 'seed_exp_octavia_service' },
      data: { description: OCTAVIA_SERVICE_DESCRIPTION },
    }),
    prisma.odometerLog.update({
      where: { id: 'seed_odo_octavia_1' },
      data: { source: OCTAVIA_ODO_SOURCES[0] },
    }),
    prisma.odometerLog.update({
      where: { id: 'seed_odo_octavia_2' },
      data: { source: OCTAVIA_ODO_SOURCES[1] },
    }),
    prisma.insurancePolicy.updateMany({
      where: { id: { in: ['seed_ins_octavia', 'seed_ins_ioniq_driver'] } },
      data: { hasTaxiExtension: false },
    }),
  ]);
  console.log('Migrated legacy demo data: car swap now on the driver Niro, Octavia idle in stock.');
}

/* ------------------------------------------------------------------------------------------ */
/* Demo documents (placeholder files in UPLOAD_DIR)                                           */
/* ------------------------------------------------------------------------------------------ */

const YELLOW = rgb(0.961, 0.773, 0.094); // #F5C518
const INK = rgb(0.059, 0.059, 0.063); // #0F0F10
const GREY = rgb(0.45, 0.45, 0.48);

/** One-page A4 placeholder PDF (Latin text only: standard fonts have no Hebrew glyphs). */
async function placeholderPdf(title: string, lines: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fixedDate = new Date('2026-01-01T00:00:00.000Z');
  pdf.setTitle(title);
  pdf.setAuthor('Renawi Motors');
  pdf.setProducer('Renawi Motors demo seed');
  pdf.setCreator('Renawi Motors demo seed');
  pdf.setCreationDate(fixedDate);
  pdf.setModificationDate(fixedDate);
  const page = pdf.addPage([595.28, 841.89]);
  const { height, width } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: YELLOW });
  page.drawText('RENAWI MOTORS', { x: 48, y: height - 60, size: 26, font: bold, color: INK });
  page.drawText(title, { x: 48, y: height - 160, size: 20, font: bold, color: INK });
  lines.forEach((line, i) => {
    page.drawText(line, { x: 48, y: height - 205 - i * 24, size: 13, font: regular, color: INK });
  });
  page.drawText('Demo placeholder generated by the seed - not a real document.', {
    x: 48,
    y: 48,
    size: 9,
    font: regular,
    color: GREY,
  });
  return Buffer.from(await pdf.save());
}

/** 960x600 PNG "photo" of a car silhouette (shapes only, no fonts needed). */
function placeholderCarPng(bodyColor: string, sky: string): Promise<Buffer> {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">',
    '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="' + sky + '"/><stop offset="1" stop-color="#f4f4f5"/>',
    '</linearGradient></defs>',
    '<rect width="960" height="600" fill="url(#sky)"/>',
    '<rect y="430" width="960" height="170" fill="#3f3f46"/>',
    '<rect y="505" width="960" height="10" fill="#F5C518"/>',
    '<path d="M170 400 L230 300 Q250 270 290 265 L600 260 Q650 262 690 300 L760 360 Q800 365 815 385 L820 420 Q820 440 800 440 L160 440 Q140 440 140 420 L145 405 Q150 400 170 400 Z" fill="' +
      bodyColor +
      '" stroke="#18181b" stroke-width="6"/>',
    '<path d="M265 305 Q280 285 305 284 L440 282 L440 360 L235 362 Z" fill="#a5c8e4" stroke="#18181b" stroke-width="5"/>',
    '<path d="M465 282 L590 281 Q630 283 660 312 L700 358 L465 360 Z" fill="#a5c8e4" stroke="#18181b" stroke-width="5"/>',
    '<circle cx="290" cy="440" r="58" fill="#18181b"/><circle cx="290" cy="440" r="26" fill="#d4d4d8"/>',
    '<circle cx="680" cy="440" r="58" fill="#18181b"/><circle cx="680" cy="440" r="26" fill="#d4d4d8"/>',
    '</svg>',
  ].join('');
  return sharp(Buffer.from(svg)).png().toBuffer();
}

interface SeedDocument {
  id: string;
  kind: 'CAR_LICENSE' | 'INSURANCE' | 'PHOTO' | 'TAXI_PERMIT';
  /** Owner: a vehicle, or a driver when `driverId` is set. */
  vehicleId?: string;
  driverId?: string;
  title: string;
  fileName: string;
  lang: string | null;
  expiresAt: string | null;
  mime: 'application/pdf' | 'image/png';
  render: () => Promise<Buffer>;
}

/**
 * A few documents with real placeholder files so the vehicle file has something to show.
 * Missing files (e.g. a wiped upload folder) are regenerated under the same key.
 */
async function seedDocuments(adminId: string, T: string): Promise<void> {
  const storage = new LocalDiskStorage(resolve(process.env.UPLOAD_DIR || './data/uploads'));
  storage.ensureRoot();
  const docs: SeedDocument[] = [
    {
      id: 'seed_doc_corolla_license',
      kind: 'CAR_LICENSE',
      vehicleId: 'seed_v_taxi_corolla',
      title: 'רישיון רכב — טויוטה קורולה',
      fileName: 'car-license-312-45-625.pdf',
      lang: 'he',
      expiresAt: addDays(T, 150),
      mime: 'application/pdf',
      render: () =>
        placeholderPdf('Vehicle licence', [
          'Plate: 312-45-625 (taxi)',
          'Toyota Corolla Hybrid Sun, 2023',
          'Valid until: ' + addDays(T, 150),
        ]),
    },
    {
      id: 'seed_doc_corolla_insurance',
      kind: 'INSURANCE',
      vehicleId: 'seed_v_taxi_corolla',
      title: 'פוליסת מקיף CMP-2026-118842',
      fileName: 'insurance-CMP-2026-118842.pdf',
      lang: 'he',
      expiresAt: addDays(T, 165),
      mime: 'application/pdf',
      render: () =>
        placeholderPdf('Insurance policy', [
          'Comprehensive with taxi extension',
          'Policy no. CMP-2026-118842',
          'Period: ' + addDays(T, -200) + ' - ' + addDays(T, 165),
        ]),
    },
    {
      id: 'seed_doc_octavia_license',
      kind: 'CAR_LICENSE',
      vehicleId: 'seed_v_taxi_octavia',
      title: 'רישיון רכב — סקודה אוקטביה (טסט חצי-שנתי)',
      fileName: 'car-license-84-731-26.pdf',
      lang: 'he',
      expiresAt: addDays(T, 25),
      mime: 'application/pdf',
      render: () =>
        placeholderPdf('Vehicle licence', [
          'Plate: 84-731-26 (taxi, semi-annual test)',
          'Skoda Octavia Ambition 1.6 TDI, 2016',
          'Valid until: ' + addDays(T, 25),
        ]),
    },
    {
      id: 'seed_doc_sportage_photo',
      kind: 'PHOTO',
      vehicleId: 'seed_v_kia_sportage',
      title: 'צד שמאל',
      fileName: 'sportage-side.png',
      lang: null,
      expiresAt: null,
      mime: 'image/png',
      render: () => placeholderCarPng('#71717a', '#bfdbfe'),
    },
    {
      id: 'seed_doc_rav4_photo',
      kind: 'PHOTO',
      vehicleId: 'seed_v_rav4_consigned',
      title: 'تصوير للإعلان',
      fileName: 'rav4-listing.png',
      lang: null,
      expiresAt: null,
      mime: 'image/png',
      render: () => placeholderCarPng('#fafafa', '#fde68a'),
    },
    {
      // Scan of the previous permit, expired 6 days ago -> reminders feed "overdue" (document).
      id: 'seed_doc_mizrahi_permit',
      kind: 'TAXI_PERMIT',
      driverId: 'seed_drv_mizrahi',
      title: 'היתר נהג מונית — אבי מזרחי (סריקה ישנה)',
      fileName: 'taxi-permit-TP-71033-old.pdf',
      lang: 'he',
      expiresAt: addDays(T, -6),
      mime: 'application/pdf',
      render: () =>
        placeholderPdf('Taxi driver permit', [
          'Driver: Avi Mizrahi, permit TP-71033',
          'Previous permit scan - renewed permit not uploaded yet',
          'Valid until: ' + addDays(T, -6),
        ]),
    },
  ];

  for (const d of docs) {
    const row = await prisma.document.findUnique({ where: { id: d.id } });
    const ext = d.mime === 'application/pdf' ? 'pdf' : 'png';
    const key = row?.fileKey ?? 'seed/' + d.id + '.' + ext;
    const isImage = d.mime !== 'application/pdf';
    let size = row?.size ?? 0;
    const fileMissing = !(await storage.exists(key));
    const thumbMissing = isImage && !(await storage.exists(thumbKeyOf(key)));
    if (fileMissing || thumbMissing) {
      const content = await d.render();
      await storage.put(content, key, d.mime);
      if (isImage) await storage.put(await makeThumbnail(content), thumbKeyOf(key), 'image/webp');
      size = content.length;
      if (row && (row.size !== size || row.hasThumb !== isImage)) {
        await prisma.document.update({ where: { id: d.id }, data: { size, hasThumb: isImage } });
      }
    }
    await ensure(
      () => Promise.resolve(row),
      () =>
        prisma.document.upsert({
          where: { id: d.id },
          update: {},
          create: {
            id: d.id,
            kind: d.kind,
            fileKey: key,
            fileName: d.fileName,
            mime: d.mime,
            size,
            hasThumb: isImage,
            title: d.title,
            lang: d.lang,
            expiresAt: d.expiresAt ? day(d.expiresAt) : null,
            vehicleId: d.driverId ? null : (d.vehicleId ?? null),
            driverId: d.driverId ?? null,
            uploadedById: adminId,
          },
        }),
    );
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Demo data                                                                                  */
/* ------------------------------------------------------------------------------------------ */

async function seedDemo(adminId: string, T: string): Promise<void> {
  const thisPeriod = periodOf(T);
  const notAfterToday = (iso: string) => minIsoDate(iso, T);

  /* ---------------------------------- Contacts ---------------------------------- */
  const contacts: Prisma.ContactUncheckedCreateInput[] = [
    {
      id: 'seed_c_garage_north',
      tags: ['GARAGE', 'SUPPLIER'],
      companyName: 'מוסך אבו סאלח',
      idNumber: withCheckDigit('51398762'),
      phones: ['046557812', '0523344551'],
      city: 'נצרת',
      address: 'אזור התעשייה ציפורית',
      preferredLang: 'ar',
      notes: 'מוסך קבוע למוניות; הנחה של 10% לעסק',
    },
    {
      id: 'seed_c_garage_haifa',
      tags: ['GARAGE'],
      companyName: 'פנצ׳רייה ומכון רישוי המפרץ',
      phones: ['048401177'],
      city: 'חיפה',
      preferredLang: 'he',
    },
    {
      id: 'seed_c_insurer',
      tags: ['INSURER'],
      companyName: 'גליל סוכנות לביטוח',
      firstName: 'נוי',
      lastName: 'שפירא',
      phones: ['046091010'],
      email: 'noy@galil-insurance.example',
      city: 'עפולה',
      preferredLang: 'he',
    },
    {
      id: 'seed_c_seller_private',
      tags: ['SELLER'],
      firstName: 'יוסי',
      lastName: 'כהן',
      idNumber: withCheckDigit('03741596'),
      phones: ['0541239876'],
      city: 'קריית אתא',
      preferredLang: 'he',
      source: 'yad2',
    },
    {
      id: 'seed_c_seller_leasing',
      tags: ['SELLER', 'SUPPLIER'],
      companyName: 'צפון ליסינג בע״מ',
      idNumber: withCheckDigit('51477203'),
      phones: ['048555900'],
      email: 'remarketing@north-leasing.example',
      city: 'חיפה',
      preferredLang: 'he',
      notes: 'עוסק מורשה — רכישה ממנו מחייבת מע״מ מלא במכירה',
    },
    {
      id: 'seed_c_buyer_halabi',
      tags: ['BUYER', 'SELLER'],
      firstName: 'محمد',
      lastName: 'حلبي',
      idNumber: withCheckDigit('20587341'),
      phones: ['0528876543'],
      city: 'دالية الكرمل',
      preferredLang: 'ar',
      source: 'הפניה',
    },
    {
      id: 'seed_c_buyer_levi',
      tags: ['BUYER'],
      firstName: 'רונית',
      lastName: 'לוי',
      idNumber: withCheckDigit('02995314'),
      phones: ['0507712345'],
      email: 'ronit.levi@example.com',
      city: 'נוף הגליל',
      preferredLang: 'he',
    },
    {
      id: 'seed_c_consignor_nassar',
      tags: ['CONSIGNOR'],
      firstName: 'سامر',
      lastName: 'نصار',
      idNumber: withCheckDigit('30412958'),
      phones: ['0549981122'],
      city: 'الناصرة',
      preferredLang: 'ar',
      notes: 'RAV4 בתיווך; מעדיף שיחה אחרי 17:00',
    },
    {
      id: 'seed_c_lead_dana',
      tags: ['LEAD'],
      firstName: 'דנה',
      lastName: 'אברהם',
      phones: ['0586612300'],
      city: 'מגדל העמק',
      preferredLang: 'he',
      source: 'yad2',
      notes: 'מחפשת SUV עד 110 אלף, מימון בנקאי',
      followUpAt: day(addDays(T, 3)),
    },
    {
      id: 'seed_c_lead_khoury',
      tags: ['LEAD'],
      firstName: 'أحمد',
      lastName: 'خوري',
      phones: ['0533456789'],
      city: 'كفر كنا',
      preferredLang: 'ar',
      source: 'Facebook',
      notes: 'מעוניין בהשכרת מספר בלבד לרכב שלו',
      followUpAt: day(addDays(T, -1)),
    },
    {
      // Follow-up due today -> reminders feed "due" (contact follow-ups have no lead days).
      id: 'seed_c_lead_salameh',
      tags: ['LEAD', 'SELLER'],
      firstName: 'وسيم',
      lastName: 'سلامة',
      phones: ['0547788120'],
      city: 'يافة الناصرة',
      preferredLang: 'ar',
      source: 'הפניה',
      notes: 'רוצה למכור קורולה 2018 ולקנות SUV — לתאם בדיקה במגרש',
      followUpAt: day(T),
    },
    {
      id: 'seed_c_drv_odeh',
      tags: ['DRIVER'],
      firstName: 'خالد',
      lastName: 'عودة',
      idNumber: withCheckDigit('03174528'),
      phones: ['0527345611'],
      city: 'الناصرة',
      address: 'حي الصفافرة 12',
      preferredLang: 'ar',
    },
    {
      id: 'seed_c_drv_mizrahi',
      tags: ['DRIVER'],
      firstName: 'אבי',
      lastName: 'מזרחי',
      idNumber: withCheckDigit('02866139'),
      phones: ['0502468013'],
      city: 'עפולה',
      address: 'רח׳ יהושע חנקין 8',
      preferredLang: 'he',
    },
    {
      id: 'seed_c_drv_haddad',
      tags: ['DRIVER'],
      firstName: 'رامي',
      lastName: 'حداد',
      idNumber: withCheckDigit('20954417'),
      phones: ['0546677889'],
      city: 'شفاعمرو',
      preferredLang: 'ar',
      notes: 'ממתין לרישיון פנוי',
    },
  ];
  for (const c of contacts) {
    await ensure(
      () => prisma.contact.findUnique({ where: { id: c.id as string } }),
      () => prisma.contact.upsert({ where: { id: c.id as string }, update: {}, create: c }),
    );
  }

  /* ---------------------------------- Lease timeline ---------------------------------- */
  // Lease A (car + number): started on the 16th three months ago -> prorated first month.
  const leaseAStart = `${addPeriods(thisPeriod, -3)}-16`;
  // Lease B (number only): started on the 1st eight months ago; car swap on the 12th of last month.
  const leaseBStart = `${addPeriods(thisPeriod, -8)}-01`;
  const swapDate = `${addPeriods(thisPeriod, -1)}-12`;
  // Lease C (car + number, Rami Haddad): our reserve Octavia + licence 40633 from the 1st five
  // months ago, terminated early by the driver on the 20th two months ago (credit for the unused
  // days, one month's rent penalty, deposit applied to the debt). The car was then serviced.
  const leaseCStart = `${addPeriods(thisPeriod, -5)}-01`;
  const leaseCEnd = `${addPeriods(thisPeriod, -2)}-20`;

  /* ---------------------------------- Drivers ---------------------------------- */
  const drivers: Prisma.DriverUncheckedCreateInput[] = [
    {
      id: 'seed_drv_odeh',
      contactId: 'seed_c_drv_odeh',
      licenseNo: '7834512',
      licenseExpiry: day(addDays(T, 910)),
      taxiPermitNo: 'TP-88412',
      // Expires within 30 days -> shows in the reminders feed (lead 60 days).
      taxiPermitExpiry: day(addDays(T, 18)),
      medicalExpiry: day(addDays(T, 210)),
      emergencyName: 'سلمى عودة',
      emergencyPhone: '0544123987',
      startedAt: day(leaseAStart),
      status: 'ACTIVE',
    },
    {
      id: 'seed_drv_mizrahi',
      contactId: 'seed_c_drv_mizrahi',
      licenseNo: '6120987',
      licenseExpiry: day(addDays(T, 1460)),
      taxiPermitNo: 'TP-71033',
      taxiPermitExpiry: day(addDays(T, 395)),
      medicalExpiry: day(addDays(T, 95)),
      emergencyName: 'שרית מזרחי',
      emergencyPhone: '0522223344',
      startedAt: day(leaseBStart),
      status: 'ACTIVE',
      notes: 'נהג ותיק, משלם בזמן',
    },
    {
      id: 'seed_drv_haddad',
      contactId: 'seed_c_drv_haddad',
      licenseNo: '8456120',
      licenseExpiry: day(addDays(T, 640)),
      taxiPermitNo: 'TP-90551',
      taxiPermitExpiry: day(addDays(T, 600)),
      medicalExpiry: day(addDays(T, 45)),
      status: 'ACTIVE',
      notes: 'מועמד לרישיון 40633',
    },
  ];
  for (const d of drivers) {
    await ensure(
      () => prisma.driver.findUnique({ where: { id: d.id as string } }),
      () => prisma.driver.upsert({ where: { id: d.id as string }, update: {}, create: d }),
    );
  }

  /* ---------------------------------- Vehicles ---------------------------------- */
  const purchase1Date = addDays(T, -120); // Mazda bought from a private seller
  const purchase2Date = addDays(T, -75); // Kia bought from a leasing company (VAT business)
  const saleDate = addDays(T, -4); // Mazda sold with a trade-in (i20)
  const consignStart = addDays(T, -30);

  const vehicles: Prisma.VehicleUncheckedCreateInput[] = [
    {
      id: 'seed_v_taxi_corolla',
      plateNo: '31245625',
      vin: 'JTNB23HE0P3012345',
      make: 'Toyota',
      model: 'Corolla',
      trim: 'Hybrid Sun',
      year: 2023,
      color: 'לבן',
      fuel: 'HYBRID',
      gearbox: 'AUTO',
      engineCc: 1798,
      hand: 1,
      isTaxi: true,
      status: 'LEASED',
      ownership: 'OWNED',
      currentKm: 128_400,
      registrationExpiry: day(addDays(T, 150)),
      meterSerial: 'MT-2023-48213',
      meterSealedAt: day(leaseAStart),
      location: 'תחנת המוניות, נצרת',
    },
    {
      id: 'seed_v_taxi_octavia',
      plateNo: '8473126',
      vin: 'TMBJG7NE5G0123987',
      make: 'Skoda',
      model: 'Octavia',
      trim: 'Ambition 1.6 TDI',
      year: 2016, // 10+ years: semi-annual test, taxi age limit in 2028
      color: 'לבן',
      fuel: 'DIESEL',
      gearbox: 'AUTO',
      engineCc: 1598,
      hand: 2,
      isTaxi: true,
      // Idle reserve taxi: in stock, own open OWNED cycle, not on any lease segment.
      status: 'IN_STOCK',
      ownership: 'OWNED',
      currentKm: 486_200,
      registrationExpiry: day(addDays(T, 25)),
      meterSerial: 'MT-2016-11870',
      meterSealedAt: day(swapDate),
      location: OCTAVIA_LOCATION,
      notes: OCTAVIA_NOTES,
    },
    {
      id: 'seed_v_kia_sportage',
      plateNo: '61278903',
      vin: 'U5YPG81ADML123456',
      make: 'Kia',
      model: 'Sportage',
      trim: 'Urban 1.6T',
      year: 2021,
      color: 'אפור מטאלי',
      fuel: 'PETROL',
      gearbox: 'AUTO',
      engineCc: 1598,
      hand: 2,
      // A draft sale (seed_deal_draft_sportage) reserves the car.
      status: 'RESERVED',
      ownership: 'OWNED',
      currentKm: 58_000,
      registrationExpiry: day(addDays(T, 200)),
      dealerRegisteredAt: day(purchase2Date),
      location: 'מגרש',
      listingPrice: ils(109_900),
    },
    {
      id: 'seed_v_mazda3',
      plateNo: '57466901',
      vin: 'JM1BP2HLAK1234567',
      make: 'Mazda',
      model: '3',
      trim: 'Spirit',
      year: 2019,
      color: 'אדום',
      fuel: 'PETROL',
      gearbox: 'AUTO',
      engineCc: 1998,
      hand: 3,
      status: 'SOLD',
      ownership: 'OWNED',
      currentKm: 87_500,
      registrationExpiry: day(addDays(T, 120)),
      dealerRegisteredAt: day(purchase1Date),
      listingPrice: ils(92_000),
    },
    {
      id: 'seed_v_i20_tradein',
      plateNo: '3268471',
      vin: 'KMHC851CGHU123456',
      make: 'Hyundai',
      model: 'i20',
      trim: 'Inspire',
      year: 2017,
      color: 'כסוף',
      fuel: 'PETROL',
      gearbox: 'AUTO',
      engineCc: 1368,
      hand: 2,
      status: 'IN_STOCK',
      ownership: 'OWNED',
      currentKm: 112_000,
      registrationExpiry: day(addDays(T, 60)),
      dealerRegisteredAt: day(saleDate),
      location: 'מגרש — ממתין להכנה',
      listingPrice: ils(46_900),
    },
    {
      id: 'seed_v_rav4_consigned',
      plateNo: '83920101',
      vin: 'JTMW43FV40D012345',
      make: 'Toyota',
      model: 'RAV4',
      trim: 'Hybrid Experience',
      year: 2020,
      color: 'לבן פנינה',
      fuel: 'HYBRID',
      gearbox: 'AUTO',
      engineCc: 2487,
      hand: 1,
      status: 'RESERVED',
      ownership: 'CONSIGNED',
      currentKm: 64_300,
      registrationExpiry: day(addDays(T, 240)),
      location: 'מגרש',
      listingPrice: ils(132_000),
      notes: 'רכב בתיווך — בעלים: سامر نصار',
    },
    {
      id: 'seed_v_ioniq_driver',
      plateNo: '50217425',
      vin: 'KMHC851CGMU654321',
      make: 'Hyundai',
      model: 'Ioniq',
      trim: 'Hybrid',
      year: 2021,
      color: 'לבן',
      fuel: 'HYBRID',
      gearbox: 'AUTO',
      engineCc: 1580,
      isTaxi: true,
      status: 'EXTERNAL',
      ownership: 'THIRD_PARTY',
      ownerDriverId: 'seed_drv_mizrahi',
      currentKm: 241_000,
      registrationExpiry: day(addDays(T, 70)),
      notes: 'הרכב של הנהג אבי מזרחי — במוסך אחרי תאונה',
    },
    {
      // The driver's replacement car: since the car swap licence 31952 is registered on it.
      id: 'seed_v_mizrahi_niro',
      plateNo: '72914326',
      vin: 'KNACC81CGN5123456',
      make: 'Kia',
      model: 'Niro',
      trim: 'Hybrid',
      year: 2022,
      color: 'לבן',
      fuel: 'HYBRID',
      gearbox: 'AUTO',
      engineCc: 1580,
      isTaxi: true,
      status: 'EXTERNAL',
      ownership: 'THIRD_PARTY',
      ownerDriverId: 'seed_drv_mizrahi',
      currentKm: 96_400,
      registrationExpiry: day(addDays(T, 290)),
      meterSerial: 'MT-2022-30417',
      meterSealedAt: day(swapDate),
      notes: 'רכב חלופי של הנהג אבי מזרחי — רישיון 31952 רשום עליו מאז החלפת הרכב',
    },
  ];
  for (const v of vehicles) {
    await ensure(
      () => prisma.vehicle.findUnique({ where: { id: v.id as string } }),
      () => prisma.vehicle.upsert({ where: { id: v.id as string }, update: {}, create: v }),
    );
  }

  /* ---------------------------------- Taxi licences ---------------------------------- */
  const feeDue = day(annualFeeDueDate(Number(T.slice(0, 4))));
  const licenses: Prisma.TaxiLicenseUncheckedCreateInput[] = [
    {
      id: 'seed_tl_24718',
      licenseNo: '24718',
      holderName: LICENSE_HOLDER,
      acquiredAt: day('2019-05-20'),
      acquisitionPrice: ils(215_000),
      annualFeeDueAt: feeDue,
      registeredVehicleId: 'seed_v_taxi_corolla',
    },
    {
      id: 'seed_tl_31952',
      licenseNo: '31952',
      holderName: LICENSE_HOLDER,
      acquiredAt: day('2021-02-11'),
      acquisitionPrice: ils(238_000),
      annualFeeDueAt: feeDue,
      // Moved from the driver's Ioniq to his replacement Niro at the car swap.
      registeredVehicleId: 'seed_v_mizrahi_niro',
    },
    {
      id: 'seed_tl_40633',
      licenseNo: '40633',
      holderName: LICENSE_HOLDER,
      acquiredAt: day(addDays(T, -200)),
      acquisitionPrice: ils(262_000),
      annualFeeDueAt: feeDue,
      renewalAt: day(LICENSE_40633_RENEWAL(T)),
      notes: 'פנוי להשכרה',
    },
  ];
  for (const l of licenses) {
    await ensure(
      () => prisma.taxiLicense.findUnique({ where: { id: l.id as string } }),
      () => prisma.taxiLicense.upsert({ where: { id: l.id as string }, update: {}, create: l }),
    );
  }
  // Databases seeded before the renewal date existed get it once (only while still unset).
  await prisma.taxiLicense.updateMany({
    where: { id: 'seed_tl_40633', renewalAt: null },
    data: { renewalAt: day(LICENSE_40633_RENEWAL(T)) },
  });

  await migrateLegacyDemo();

  /* ---------------------------------- Inventory cycles ---------------------------------- */
  const cycles: Prisma.InventoryCycleUncheckedCreateInput[] = [
    {
      id: 'seed_cyc_corolla',
      vehicleId: 'seed_v_taxi_corolla',
      kind: 'OWNED',
      startedAt: day('2023-03-15'),
    },
    {
      id: 'seed_cyc_octavia',
      vehicleId: 'seed_v_taxi_octavia',
      kind: 'OWNED',
      startedAt: day('2021-06-01'),
    },
    {
      id: 'seed_cyc_mazda3',
      vehicleId: 'seed_v_mazda3',
      kind: 'OWNED',
      startedAt: day(purchase1Date),
      endedAt: day(saleDate),
      endReason: 'SOLD',
      askingPrice: ils(92_000),
    },
    {
      id: 'seed_cyc_sportage',
      vehicleId: 'seed_v_kia_sportage',
      kind: 'OWNED',
      startedAt: day(purchase2Date),
      askingPrice: ils(109_900),
    },
    {
      id: 'seed_cyc_i20',
      vehicleId: 'seed_v_i20_tradein',
      kind: 'OWNED',
      startedAt: day(saleDate),
      askingPrice: ils(46_900),
    },
    {
      id: 'seed_cyc_rav4',
      vehicleId: 'seed_v_rav4_consigned',
      kind: 'CONSIGNED',
      startedAt: day(consignStart),
      consignorId: 'seed_c_consignor_nassar',
      askingPrice: ils(132_000),
      minNetToConsignor: ils(120_000),
      commissionMode: 'PERCENT',
      commissionValue: ils(5),
      agreementEndsAt: day(addDays(consignStart, 90)),
    },
  ];
  for (const c of cycles) {
    await ensure(
      () => prisma.inventoryCycle.findUnique({ where: { id: c.id as string } }),
      () => prisma.inventoryCycle.upsert({ where: { id: c.id as string }, update: {}, create: c }),
    );
  }

  /* ---------------------------------- Deals ---------------------------------- */
  const vatRate = new Prisma.Decimal('18.00');
  const rav4Cycle = cycles.find(
    (c) => c.id === 'seed_cyc_rav4',
  ) as Prisma.InventoryCycleUncheckedCreateInput;
  const consignmentPrice = 128_000;
  const consignment = computeCommission(
    rav4Cycle.commissionMode as CommissionMode,
    Number(rav4Cycle.commissionValue),
    consignmentPrice,
    Number(rav4Cycle.minNetToConsignor),
  );
  const saleChecklist = {
    ...createTransferChecklist(),
    idCopies: true,
    vehicleLicenseSigned: true,
    liensChecked: true,
    finesChecked: true,
  };

  const deals: Prisma.DealUncheckedCreateInput[] = [
    {
      id: 'seed_deal_buy_mazda',
      type: 'PURCHASE',
      status: 'COMPLETED',
      vehicleId: 'seed_v_mazda3',
      cycleId: 'seed_cyc_mazda3',
      counterpartyId: 'seed_c_seller_private',
      date: day(purchase1Date),
      price: ils(72_000),
      listPrice: ils(79_500),
      vatMode: 'NONE',
      vatRate,
      completedAt: at(purchase1Date, '11:30'),
      createdById: adminId,
      notes: 'קנייה מפרטי; נבדק במכון',
    },
    {
      id: 'seed_deal_buy_sportage',
      type: 'PURCHASE',
      status: 'COMPLETED',
      vehicleId: 'seed_v_kia_sportage',
      cycleId: 'seed_cyc_sportage',
      counterpartyId: 'seed_c_seller_leasing',
      date: day(purchase2Date),
      price: ils(92_000),
      listPrice: ils(101_000),
      vatMode: 'FULL',
      vatRate,
      sellerIsVatBusiness: true,
      completedAt: at(purchase2Date, '13:00'),
      createdById: adminId,
      notes: 'רכב יד 2 מליסינג — חשבונית מס',
    },
    {
      id: 'seed_deal_buy_i20_tradein',
      type: 'PURCHASE',
      status: 'COMPLETED',
      vehicleId: 'seed_v_i20_tradein',
      cycleId: 'seed_cyc_i20',
      counterpartyId: 'seed_c_buyer_halabi',
      date: day(saleDate),
      price: ils(38_000),
      listPrice: ils(42_000),
      vatMode: 'NONE',
      vatRate,
      isTradeIn: true,
      completedAt: at(saleDate, '12:00'),
      createdById: adminId,
      notes: 'טרייד-אין בעסקת המאזדה',
    },
    {
      id: 'seed_deal_sell_mazda',
      type: 'SALE',
      status: 'COMPLETED',
      vehicleId: 'seed_v_mazda3',
      cycleId: 'seed_cyc_mazda3',
      counterpartyId: 'seed_c_buyer_halabi',
      date: day(saleDate),
      price: ils(89_900),
      listPrice: ils(88_000),
      vatMode: 'MARGIN',
      vatRate,
      tradeInDealId: 'seed_deal_buy_i20_tradein',
      warrantyText: 'אחריות למנוע ולתיבת ההילוכים ל-3 חודשים או 5,000 ק״מ, המוקדם מביניהם.',
      disclosureSignedAt: at(addDays(saleDate, -1), '16:15'),
      transferStatus: 'IN_PROGRESS',
      transferChecklist: saleChecklist,
      transferDueAt: day(addWorkingDays(saleDate, TRANSFER_DUE_WORKING_DAYS)),
      completedAt: at(saleDate, '12:00'),
      createdById: adminId,
    },
    {
      id: 'seed_deal_consign_rav4',
      type: 'CONSIGNMENT_SALE',
      status: 'PENDING',
      vehicleId: 'seed_v_rav4_consigned',
      cycleId: 'seed_cyc_rav4',
      counterpartyId: 'seed_c_buyer_levi',
      date: day(addDays(T, -1)),
      price: ils(consignmentPrice),
      listPrice: ils(131_000),
      // The consignor keeps title: VAT is due on our commission at business level.
      vatMode: 'NONE',
      vatRate,
      commissionAmount: ils(consignment.commission),
      payoutAmount: ils(consignment.payout),
      disclosureSignedAt: at(addDays(T, -1), '10:40'),
      createdById: adminId,
      notes: 'מקדמה התקבלה; יתרה במימון בנקאי',
    },
    {
      id: 'seed_deal_draft_sportage',
      type: 'SALE',
      status: 'DRAFT',
      vehicleId: 'seed_v_kia_sportage',
      cycleId: 'seed_cyc_sportage',
      counterpartyId: 'seed_c_lead_dana',
      date: day(T),
      price: ils(107_500),
      listPrice: ils(108_000),
      // Bought from a VAT-registered business -> VAT on the full price.
      vatMode: 'FULL',
      vatRate,
      createdById: adminId,
      notes: 'הצעת מחיר — ממתינה לאישור מימון',
    },
  ];
  for (const d of deals) {
    await ensure(
      () => prisma.deal.findUnique({ where: { id: d.id as string } }),
      () => prisma.deal.upsert({ where: { id: d.id as string }, update: {}, create: d }),
    );
  }

  await fixDemoDeals(consignment);

  // Link cycles to their purchase / sale deals (idempotent update).
  const cycleLinks: [string, Prisma.InventoryCycleUncheckedUpdateInput][] = [
    [
      'seed_cyc_mazda3',
      { purchaseDealId: 'seed_deal_buy_mazda', saleDealId: 'seed_deal_sell_mazda' },
    ],
    ['seed_cyc_sportage', { purchaseDealId: 'seed_deal_buy_sportage' }],
    ['seed_cyc_i20', { purchaseDealId: 'seed_deal_buy_i20_tradein' }],
  ];
  for (const [id, data] of cycleLinks) await prisma.inventoryCycle.update({ where: { id }, data });

  const dealPayments: Prisma.DealPaymentUncheckedCreateInput[] = [
    {
      id: 'seed_dp_buy_mazda',
      dealId: 'seed_deal_buy_mazda',
      direction: 'OUT',
      contactId: 'seed_c_seller_private',
      date: day(purchase1Date),
      amount: ils(72_000),
      method: 'BANK_TRANSFER',
      reference: 'העברה 450129',
    },
    {
      id: 'seed_dp_buy_sportage',
      dealId: 'seed_deal_buy_sportage',
      direction: 'OUT',
      contactId: 'seed_c_seller_leasing',
      date: day(purchase2Date),
      amount: ils(92_000),
      method: 'BANK_TRANSFER',
      reference: 'העברה 451877',
    },
    // Trade-in: the same value appears as IN on the sale and OUT on the trade-in purchase.
    {
      id: 'seed_dp_sale_tradein_in',
      dealId: 'seed_deal_sell_mazda',
      direction: 'IN',
      contactId: 'seed_c_buyer_halabi',
      date: day(saleDate),
      amount: ils(38_000),
      method: 'TRADE_IN',
      notes: 'יונדאי i20 3268471',
    },
    {
      id: 'seed_dp_tradein_out',
      dealId: 'seed_deal_buy_i20_tradein',
      direction: 'OUT',
      contactId: 'seed_c_buyer_halabi',
      date: day(saleDate),
      amount: ils(38_000),
      method: 'TRADE_IN',
      notes: 'קוזז מול מחיר המאזדה',
    },
    {
      id: 'seed_dp_sale_deposit',
      dealId: 'seed_deal_sell_mazda',
      direction: 'IN',
      contactId: 'seed_c_buyer_halabi',
      date: day(addDays(saleDate, -2)),
      amount: ils(10_000),
      method: 'CASH',
      notes: 'מקדמה',
    },
    {
      id: 'seed_dp_sale_balance',
      dealId: 'seed_deal_sell_mazda',
      direction: 'IN',
      contactId: 'seed_c_buyer_halabi',
      date: day(saleDate),
      amount: ils(41_900),
      method: 'BANK_TRANSFER',
      reference: 'העברה 77812',
    },
    {
      id: 'seed_dp_consign_deposit',
      dealId: 'seed_deal_consign_rav4',
      direction: 'IN',
      contactId: 'seed_c_buyer_levi',
      date: day(addDays(T, -1)),
      amount: ils(5_000),
      method: 'CREDIT_CARD',
      reference: 'אישור 044812',
      notes: 'מקדמה',
    },
  ];
  for (const p of dealPayments) {
    await ensure(
      () => prisma.dealPayment.findUnique({ where: { id: p.id as string } }),
      () => prisma.dealPayment.upsert({ where: { id: p.id as string }, update: {}, create: p }),
    );
  }

  /* ---------------------------------- Expenses ---------------------------------- */
  const expenses: Prisma.VehicleExpenseUncheckedCreateInput[] = [
    {
      id: 'seed_exp_mazda_brakes',
      vehicleId: 'seed_v_mazda3',
      cycleId: 'seed_cyc_mazda3',
      category: 'REPAIR',
      date: day(addDays(purchase1Date, 6)),
      amount: ils(2_800),
      vendorId: 'seed_c_garage_north',
      description: 'רפידות ודיסקים קדמיים + טיפול 90,000',
    },
    {
      id: 'seed_exp_mazda_test',
      vehicleId: 'seed_v_mazda3',
      cycleId: 'seed_cyc_mazda3',
      category: 'TEST',
      date: day(addDays(purchase1Date, 9)),
      amount: ils(290),
      vendorId: 'seed_c_garage_haifa',
      description: 'טסט שנתי',
    },
    {
      id: 'seed_exp_mazda_detailing',
      vehicleId: 'seed_v_mazda3',
      cycleId: 'seed_cyc_mazda3',
      category: 'CLEANING',
      date: day(addDays(saleDate, -6)),
      amount: ils(350),
      description: 'פוליש וניקוי פנים לפני מכירה',
    },
    {
      id: 'seed_exp_sportage_tyres',
      vehicleId: 'seed_v_kia_sportage',
      cycleId: 'seed_cyc_sportage',
      category: 'PARTS',
      date: day(addDays(purchase2Date, 5)),
      amount: ils(1_650),
      vatReclaimable: true,
      vendorId: 'seed_c_garage_haifa',
      description: '4 צמיגים חדשים',
    },
    {
      id: 'seed_exp_corolla_meter',
      vehicleId: 'seed_v_taxi_corolla',
      cycleId: 'seed_cyc_corolla',
      category: 'METER',
      date: day(leaseAStart),
      amount: ils(450),
      description: 'איטום מונה בהעברה לנהג',
    },
    {
      id: 'seed_exp_corolla_tyres_driver',
      vehicleId: 'seed_v_taxi_corolla',
      cycleId: 'seed_cyc_corolla',
      category: 'REPAIR',
      date: day(`${addPeriods(thisPeriod, -1)}-05`),
      amount: ils(1_200),
      paidBy: 'DRIVER',
      vendorId: 'seed_c_garage_north',
      description: 'החלפת צמיגים — שולם ישירות ע״י הנהג',
    },
    {
      id: 'seed_exp_octavia_service',
      vehicleId: 'seed_v_taxi_octavia',
      cycleId: 'seed_cyc_octavia',
      category: 'REPAIR',
      date: day(addDays(swapDate, -2)),
      amount: ils(3_400),
      vendorId: 'seed_c_garage_north',
      description: OCTAVIA_SERVICE_DESCRIPTION,
    },
  ];
  for (const e of expenses) {
    await ensure(
      () => prisma.vehicleExpense.findUnique({ where: { id: e.id as string } }),
      () => prisma.vehicleExpense.upsert({ where: { id: e.id as string }, update: {}, create: e }),
    );
  }

  /* ---------------------------------- Insurance ---------------------------------- */
  const yearStart = `${T.slice(0, 4)}-01-01`;
  const policies: Prisma.InsurancePolicyUncheckedCreateInput[] = [
    {
      id: 'seed_ins_corolla',
      vehicleId: 'seed_v_taxi_corolla',
      type: 'COMPREHENSIVE',
      insurer: 'גליל סוכנות לביטוח',
      policyNo: 'CMP-2026-118842',
      startDate: day(addDays(T, -200)),
      endDate: day(addDays(T, 165)),
      premium: ils(21_400),
      paidBy: 'DRIVER',
      hasTaxiExtension: true,
    },
    {
      // Expiring soon -> reminders feed (lead 30 days).
      id: 'seed_ins_octavia',
      vehicleId: 'seed_v_taxi_octavia',
      type: 'THIRD_PARTY',
      insurer: 'גליל סוכנות לביטוח',
      policyNo: 'TP-2025-077310',
      startDate: day(addDays(T, -353)),
      endDate: day(addDays(T, 12)),
      premium: ils(16_800),
      paidBy: 'US',
      // The taxi extension exists only on comprehensive policies.
      hasTaxiExtension: false,
    },
    {
      id: 'seed_ins_ioniq_driver',
      vehicleId: 'seed_v_ioniq_driver',
      type: 'COMPULSORY',
      insurer: 'ביטוח ישיר (הנהג)',
      startDate: day(addDays(T, -295)),
      endDate: day(addDays(T, 70)),
      paidBy: 'DRIVER',
      hasTaxiExtension: false,
    },
    {
      // Business-level trade policy (ביטוח סחר) covering stock cars.
      id: 'seed_ins_trade',
      scope: 'BUSINESS',
      type: 'TRADE',
      insurer: 'גליל סוכנות לביטוח',
      policyNo: 'TRD-2026-0042',
      startDate: day(yearStart),
      endDate: day(`${T.slice(0, 4)}-12-31`),
      premium: ils(14_500),
      paidBy: 'US',
    },
  ];
  for (const p of policies) {
    await ensure(
      () => prisma.insurancePolicy.findUnique({ where: { id: p.id as string } }),
      () => prisma.insurancePolicy.upsert({ where: { id: p.id as string }, update: {}, create: p }),
    );
  }

  /* ---------------------------------- Odometer ---------------------------------- */
  const odometer: Prisma.OdometerLogUncheckedCreateInput[] = [
    {
      id: 'seed_odo_corolla_1',
      vehicleId: 'seed_v_taxi_corolla',
      km: 112_350,
      date: day(leaseAStart),
      source: 'מסירה לנהג',
    },
    {
      id: 'seed_odo_corolla_2',
      vehicleId: 'seed_v_taxi_corolla',
      km: 124_900,
      date: day(addDays(T, -30)),
      source: 'טיפול',
    },
    {
      id: 'seed_odo_corolla_3',
      vehicleId: 'seed_v_taxi_corolla',
      km: 128_400,
      date: day(addDays(T, -2)),
      source: 'דיווח נהג',
    },
    {
      id: 'seed_odo_octavia_1',
      vehicleId: 'seed_v_taxi_octavia',
      km: 481_900,
      date: day(swapDate),
      source: OCTAVIA_ODO_SOURCES[0],
    },
    {
      id: 'seed_odo_octavia_2',
      vehicleId: 'seed_v_taxi_octavia',
      km: 486_200,
      date: day(addDays(T, -3)),
      source: OCTAVIA_ODO_SOURCES[1],
    },
    {
      id: 'seed_odo_mazda_1',
      vehicleId: 'seed_v_mazda3',
      km: 86_900,
      date: day(purchase1Date),
      source: 'קנייה',
    },
    {
      id: 'seed_odo_mazda_2',
      vehicleId: 'seed_v_mazda3',
      km: 87_500,
      date: day(saleDate),
      source: 'מכירה',
    },
    {
      id: 'seed_odo_sportage_1',
      vehicleId: 'seed_v_kia_sportage',
      km: 58_000,
      date: day(purchase2Date),
      source: 'קנייה',
    },
    {
      id: 'seed_odo_i20_1',
      vehicleId: 'seed_v_i20_tradein',
      km: 112_000,
      date: day(saleDate),
      source: 'טרייד-אין',
    },
    {
      id: 'seed_odo_niro_1',
      vehicleId: 'seed_v_mizrahi_niro',
      km: 94_100,
      date: day(swapDate),
      source: 'החלפת רכב',
    },
    {
      id: 'seed_odo_niro_2',
      vehicleId: 'seed_v_mizrahi_niro',
      km: 96_400,
      date: day(addDays(T, -5)),
      source: 'דיווח נהג',
    },
  ];
  for (const o of odometer) {
    await ensure(
      () => prisma.odometerLog.findUnique({ where: { id: o.id as string } }),
      () => prisma.odometerLog.upsert({ where: { id: o.id as string }, update: {}, create: o }),
    );
  }

  /* ---------------------------------- Leases + segments ---------------------------------- */
  const handover = HandoverChecklistSchema.parse({
    date: leaseAStart,
    photosTaken: true,
    km: 112_350,
    fuelLevel: 'FULL',
    spareWheel: true,
    jack: true,
    docsInCar: true,
    damagesNoted: true,
    damages: 'שריטה קלה בפגוש האחורי',
    meterSealed: true,
  });
  const contracts: Prisma.LeaseContractUncheckedCreateInput[] = [
    {
      id: 'seed_lease_odeh',
      driverId: 'seed_drv_odeh',
      type: 'CAR_AND_NUMBER',
      status: 'ACTIVE',
      startDate: day(leaseAStart),
      endDate: day(addDays(addMonths(leaseAStart, 12), -1)),
      paymentDay: 10,
      depositAmount: ils(5_000),
      depositKind: 'CHECK',
      responsibilities: { ...DEFAULT_RESPONSIBILITIES },
      handoverChecklist: handover,
      signedAt: at(leaseAStart, '08:30'),
    },
    {
      id: 'seed_lease_mizrahi',
      driverId: 'seed_drv_mizrahi',
      type: 'NUMBER_ONLY',
      status: 'ACTIVE',
      startDate: day(leaseBStart),
      endDate: day(addDays(addMonths(leaseBStart, 24), -1)),
      paymentDay: 1,
      depositAmount: ils(3_000),
      depositKind: 'CASH',
      responsibilities: { ...DEFAULT_RESPONSIBILITIES },
      signedAt: at(leaseBStart, '09:00'),
      terms:
        'מספר בלבד על רכב הנהג; בזמן תיקון רכב הנהג העסק מעמיד רכב מונית חלופי בתוספת דמי שכירות.',
    },
    {
      id: 'seed_lease_haddad',
      driverId: 'seed_drv_haddad',
      type: 'CAR_AND_NUMBER',
      status: 'TERMINATED',
      startDate: day(leaseCStart),
      endDate: day(addDays(addMonths(leaseCStart, 12), -1)),
      actualEndDate: day(leaseCEnd),
      endReason: 'TERMINATED_BY_DRIVER',
      paymentDay: 5,
      earlyExitPenaltyMonths: new Prisma.Decimal(1),
      depositAmount: ils(4_000),
      depositKind: 'CASH',
      responsibilities: { ...DEFAULT_RESPONSIBILITIES },
      handoverChecklist: HandoverChecklistSchema.parse({
        date: leaseCStart,
        photosTaken: true,
        km: 468_300,
        fuelLevel: 'HALF',
        spareWheel: true,
        jack: true,
        docsInCar: true,
        damagesNoted: true,
        damages: 'שקע קטן בדלת האחורית הימנית',
        meterSealed: true,
      }),
      returnChecklist: ReturnChecklistSchema.parse({
        date: leaseCEnd,
        photosTaken: true,
        km: 481_700,
        fuelLevel: 'QUARTER',
        spareWheel: true,
        jack: true,
        docsInCar: true,
        damagesNoted: true,
        damages: 'שקע קטן בדלת האחורית הימנית (קיים מהמסירה); מצמד שחוק',
        meterSealed: true,
        keysReturned: true,
      }),
      signedAt: at(leaseCStart, '10:00'),
      terminationNote: 'הנהג עבר לעבוד כשכיר; הפיקדון קוזז מהחוב והיתרה נגבית בתשלומים',
    },
  ];
  for (const c of contracts) {
    await ensure(
      () => prisma.leaseContract.findUnique({ where: { id: c.id as string } }),
      () => prisma.leaseContract.upsert({ where: { id: c.id as string }, update: {}, create: c }),
    );
  }

  const segments: Prisma.LeaseSegmentUncheckedCreateInput[] = [
    {
      id: 'seed_seg_odeh_1',
      contractId: 'seed_lease_odeh',
      taxiLicenseId: 'seed_tl_24718',
      vehicleId: 'seed_v_taxi_corolla',
      monthlyRent: ils(6_500),
      startDate: day(leaseAStart),
    },
    {
      // NUMBER_ONLY segments point to the driver's own THIRD_PARTY car (or none).
      id: 'seed_seg_mizrahi_1',
      contractId: 'seed_lease_mizrahi',
      taxiLicenseId: 'seed_tl_31952',
      vehicleId: 'seed_v_ioniq_driver',
      monthlyRent: ils(1_350),
      startDate: day(leaseBStart),
      endDate: day(addDays(swapDate, -1)),
    },
    {
      // Car swap: the driver's Ioniq is in the garage; the licence moved to his replacement Niro
      // (same rent, so the swap month is split pro rata between the two segments).
      id: 'seed_seg_mizrahi_2',
      contractId: 'seed_lease_mizrahi',
      taxiLicenseId: 'seed_tl_31952',
      vehicleId: 'seed_v_mizrahi_niro',
      monthlyRent: ils(1_350),
      startDate: day(swapDate),
      reason: MIZRAHI_SWAP_REASON,
    },
    {
      id: 'seed_seg_haddad_1',
      contractId: 'seed_lease_haddad',
      taxiLicenseId: 'seed_tl_40633',
      vehicleId: 'seed_v_taxi_octavia',
      monthlyRent: ils(5_800),
      startDate: day(leaseCStart),
      endDate: day(leaseCEnd),
    },
  ];
  for (const s of segments) {
    await ensure(
      () => prisma.leaseSegment.findUnique({ where: { id: s.id as string } }),
      () => prisma.leaseSegment.upsert({ where: { id: s.id as string }, update: {}, create: s }),
    );
  }

  /* ---------------------------------- Ledger ---------------------------------- */
  const ledger: Prisma.LedgerEntryUncheckedCreateInput[] = [];

  /**
   * RENT charges of a contract up to `upto` (default: this month) with the API's billing plan
   * (`planRentCharges`: proration, due dates, swap months summing to the rent). `asBilledWhileOpen`
   * plans an ended contract as it was billed while it ran (full months; the end credit comes
   * separately). A month already billed by the running API (same segment + period) is skipped.
   */
  async function rentCharges(
    contractId: string,
    idPrefix: string,
    opts: { upto?: string; asBilledWhileOpen?: boolean } = {},
  ): Promise<LedgerEntry[]> {
    const contract = await prisma.leaseContract.findUniqueOrThrow({
      where: { id: contractId },
      include: { segments: { orderBy: { startDate: 'asc' } } },
    });
    const billing = toBillingContract(contract);
    const segments = toBillingSegments(contract.segments);
    if (opts.asBilledWhileOpen) {
      billing.actualEndDate = null;
      const last = segments[segments.length - 1];
      if (last) last.endDate = null;
    }
    const out: LedgerEntry[] = [];
    for (const p of planRentCharges(billing, segments, opts.upto ?? thisPeriod)) {
      const segIndex = contract.segments.findIndex((seg: LeaseSegment) => seg.id === p.segmentId);
      const id = `${idPrefix}_rent_${segIndex}_${p.rentPeriod}`;
      const taken = await prisma.ledgerEntry.findFirst({
        where: { segmentId: p.segmentId, rentPeriod: p.rentPeriod, NOT: { id } },
      });
      if (taken) {
        existing++;
        out.push(taken);
        continue;
      }
      const e: Prisma.LedgerEntryUncheckedCreateInput = {
        id,
        driverId: contract.driverId,
        contractId,
        segmentId: p.segmentId,
        type: 'CHARGE',
        chargeKind: 'RENT',
        rentPeriod: p.rentPeriod,
        date: day(p.date),
        dueDate: day(p.dueDate),
        amount: ils(p.amount),
        // NUMBER_ONLY rent is licence income; the segment car is the driver's own.
        vehicleId: p.vehicleId,
        taxiLicenseId: p.taxiLicenseId,
        description: `דמי שכירות ${p.rentPeriod}`,
        autoGenerated: true,
        createdById: adminId,
      };
      out.push(
        await ensure(
          () => prisma.ledgerEntry.findUnique({ where: { id } }),
          () => prisma.ledgerEntry.upsert({ where: { id }, update: {}, create: e }),
        ),
      );
    }
    return out;
  }

  // Lease A (Khaled Odeh): partial payments -> last month's rent partly overdue, this month open.
  await rentCharges('seed_lease_odeh', 'seed_le_odeh');
  const pA = (n: number) => addPeriods(thisPeriod, n);
  const paymentsA: [string, string, number, PaymentMethod, string | null][] = [
    [
      'seed_le_odeh_pay_1',
      leaseAStart,
      prorate(6_500, 16, daysInMonth(pA(-3))),
      'BANK_TRANSFER',
      'העברה 88123',
    ],
    ['seed_le_odeh_pay_2', `${pA(-2)}-09`, 6_500, 'CASH', null],
    ['seed_le_odeh_pay_3', `${pA(-1)}-12`, 2_500, 'BIT', 'ביט 5521'],
    ['seed_le_odeh_pay_4', notAfterToday(`${pA(0)}-02`), 2_000, 'CHECK', 'צ׳ק 004512'],
  ];
  ledger.push({
    id: 'seed_le_odeh_deposit',
    driverId: 'seed_drv_odeh',
    contractId: 'seed_lease_odeh',
    type: 'DEPOSIT_IN',
    date: day(leaseAStart),
    amount: ils(5_000),
    method: 'CHECK',
    reference: 'צ׳ק ביטחון 0011223',
    description: 'פיקדון',
    createdById: adminId,
  });
  for (const [id, date, amount, method, reference] of paymentsA) {
    ledger.push({
      id,
      driverId: 'seed_drv_odeh',
      contractId: 'seed_lease_odeh',
      type: 'PAYMENT',
      date: day(date),
      amount: ils(amount),
      method,
      reference,
      description: 'תשלום דמי שכירות',
      createdById: adminId,
    });
  }

  // Lease B (Avi Mizrahi): pays every charge the day after it is due -> balance 0.
  const chargesB = await rentCharges('seed_lease_mizrahi', 'seed_le_mizrahi');
  const methodsB: PaymentMethod[] = ['BANK_TRANSFER', 'BIT', 'CASH'];
  ledger.push({
    id: 'seed_le_mizrahi_deposit',
    driverId: 'seed_drv_mizrahi',
    contractId: 'seed_lease_mizrahi',
    type: 'DEPOSIT_IN',
    date: day(leaseBStart),
    amount: ils(3_000),
    method: 'CASH',
    description: 'פיקדון',
    createdById: adminId,
  });
  chargesB.forEach((charge, i) => {
    const due = (charge.dueDate ?? charge.date).toISOString().slice(0, 10);
    ledger.push({
      id: `seed_le_mizrahi_pay_${charge.rentPeriod}_${i}`,
      driverId: 'seed_drv_mizrahi',
      contractId: 'seed_lease_mizrahi',
      type: 'PAYMENT',
      date: day(notAfterToday(addDays(due, 1))),
      amount: charge.amount,
      method: methodsB[i % methodsB.length] as PaymentMethod,
      description: `תשלום ${charge.rentPeriod}`,
      createdById: adminId,
    });
  });

  // Lease C (Rami Haddad, terminated): billed in full while it ran, then the end-of-contract
  // entries exactly as POST /leases/:id/end creates them.
  const chargesC = await rentCharges('seed_lease_haddad', 'seed_le_haddad', {
    upto: periodOf(leaseCEnd),
    asBilledWhileOpen: true,
  });
  const leaseC = await prisma.leaseContract.findUniqueOrThrow({
    where: { id: 'seed_lease_haddad' },
    include: { segments: true },
  });
  const creditsC = unusedRentCredits(
    toBillingContract(leaseC),
    toBillingSegments(leaseC.segments),
    chargesC.map((c) => ({
      id: c.id,
      segmentId: c.segmentId,
      rentPeriod: c.rentPeriod ?? '',
      amount: c.amount,
    })),
  );
  const fineChargeDate = `${addPeriods(thisPeriod, -3)}-28`;
  const C = {
    driverId: 'seed_drv_haddad',
    contractId: 'seed_lease_haddad',
    createdById: adminId,
  } as const;
  ledger.push({
    ...C,
    id: 'seed_le_haddad_deposit',
    type: 'DEPOSIT_IN',
    date: day(leaseCStart),
    amount: ils(4_000),
    method: 'CASH',
    description: 'פיקדון',
  });
  // Paid the first three months in full, the fourth only in part.
  chargesC.forEach((charge, i) => {
    const due = (charge.dueDate ?? charge.date).toISOString().slice(0, 10);
    const full = i < chargesC.length - 1;
    ledger.push({
      ...C,
      id: `seed_le_haddad_pay_${i + 1}`,
      type: 'PAYMENT',
      date: day(full ? addDays(due, 1) : addDays(due, 2)),
      amount: full ? charge.amount : ils(3_000),
      method: i % 2 ? 'CASH' : 'BANK_TRANSFER',
      description: `תשלום ${charge.rentPeriod}`,
    });
  });
  // Parking fine on the Octavia that we paid and passed on (see the fine + expense below).
  ledger.push({
    ...C,
    id: 'seed_le_haddad_fine',
    type: 'CHARGE',
    chargeKind: 'FINE',
    date: day(fineChargeDate),
    dueDate: day(fineChargeDate),
    amount: ils(750),
    reference: '71-308812',
    description: 'דוח חניה — עיריית נצרת',
    vehicleId: 'seed_v_taxi_octavia',
    taxiLicenseId: 'seed_tl_40633',
  });
  for (const credit of creditsC) {
    ledger.push({
      ...C,
      id: `seed_le_haddad_credit_${credit.rentPeriod}`,
      type: 'CREDIT',
      date: day(leaseCEnd),
      amount: ils(credit.amount),
      description: `${credit.from} – ${credit.to}`,
      vehicleId: 'seed_v_taxi_octavia',
      taxiLicenseId: 'seed_tl_40633',
      autoGenerated: true,
    });
  }
  ledger.push({
    ...C,
    id: 'seed_le_haddad_penalty',
    type: 'CHARGE',
    chargeKind: 'PENALTY',
    date: day(leaseCEnd),
    dueDate: day(leaseCEnd),
    amount: ils(penaltyAmount(1, 5_800)),
    description: '1 x 5800.00',
    vehicleId: 'seed_v_taxi_octavia',
    taxiLicenseId: 'seed_tl_40633',
  });
  // Deposit applied to the debt: DEPOSIT_APPLIED + PAYMENT(OFFSET), linked through `reference`.
  ledger.push(
    {
      ...C,
      id: 'seed_le_haddad_dep_applied',
      type: 'DEPOSIT_APPLIED',
      date: day(leaseCEnd),
      amount: ils(4_000),
      reference: 'seed_le_haddad_offset',
      description: 'קיזוז פיקדון',
    },
    {
      ...C,
      id: 'seed_le_haddad_offset',
      type: 'PAYMENT',
      method: 'OFFSET',
      date: day(leaseCEnd),
      amount: ils(4_000),
      reference: 'seed_le_haddad_dep_applied',
      description: 'קיזוז פיקדון',
    },
    {
      ...C,
      id: 'seed_le_haddad_pay_after',
      type: 'PAYMENT',
      date: day(`${addPeriods(thisPeriod, -1)}-15`),
      amount: ils(1_000),
      method: 'BIT',
      reference: 'ביט 7713',
      description: 'תשלום על חשבון החוב',
    },
  );

  for (const e of ledger) {
    await ensure(
      () => prisma.ledgerEntry.findUnique({ where: { id: e.id as string } }),
      () => prisma.ledgerEntry.upsert({ where: { id: e.id as string }, update: {}, create: e }),
    );
  }
  for (const d of drivers) await reallocateDriver(d.id as string);

  /* ---------------------------------- Traffic fine ---------------------------------- */
  const fineReceived = `${addPeriods(thisPeriod, -1)}-28`;
  await ensure(
    () => prisma.trafficFine.findUnique({ where: { id: 'seed_fine_corolla_speed' } }),
    () =>
      prisma.trafficFine.upsert({
        where: { id: 'seed_fine_corolla_speed' },
        update: {},
        create: {
          id: 'seed_fine_corolla_speed',
          vehicleId: 'seed_v_taxi_corolla',
          driverId: 'seed_drv_odeh',
          contractId: 'seed_lease_odeh',
          fineNo: '52-4471209',
          authority: 'משטרת ישראל — אגף התנועה',
          offenceAt: at(`${addPeriods(thisPeriod, -1)}-14`, '18:42'),
          receivedAt: day(fineReceived),
          amount: ils(250),
          status: 'REASSIGN_SUBMITTED',
          reassignDeadline: day(fineReassignDeadline(fineReceived)),
          notes: 'מהירות; נשלחה בקשת הסבה לנהג',
        },
      }),
  );
  // Red light on the Corolla, not yet reassigned: the 90-day deadline is under 14 days away.
  const redLightAt = maxIsoDate(leaseAStart, addDays(T, -79));
  const redLightReceived = addDays(redLightAt, 1);
  await ensure(
    () => prisma.trafficFine.findUnique({ where: { id: 'seed_fine_corolla_redlight' } }),
    () =>
      prisma.trafficFine.upsert({
        where: { id: 'seed_fine_corolla_redlight' },
        update: {},
        create: {
          id: 'seed_fine_corolla_redlight',
          vehicleId: 'seed_v_taxi_corolla',
          driverId: 'seed_drv_odeh',
          contractId: 'seed_lease_odeh',
          fineNo: '52-4490017',
          authority: 'משטרת ישראל — מצלמת רמזור',
          offenceAt: at(redLightAt, '06:55'),
          receivedAt: day(redLightReceived),
          amount: ils(1_000),
          status: 'NEW',
          reassignDeadline: day(fineReassignDeadline(redLightReceived)),
          notes: 'יש להגיש בקשת הסבה לנהג',
        },
      }),
  );
  // Parking fine during lease C: we paid it and charged the driver (expense + FINE charge).
  const parkingReceived = `${addPeriods(thisPeriod, -3)}-25`;
  await ensure(
    () => prisma.vehicleExpense.findUnique({ where: { id: 'seed_exp_octavia_parking_fine' } }),
    () =>
      prisma.vehicleExpense.upsert({
        where: { id: 'seed_exp_octavia_parking_fine' },
        update: {},
        create: {
          id: 'seed_exp_octavia_parking_fine',
          vehicleId: 'seed_v_taxi_octavia',
          cycleId: 'seed_cyc_octavia',
          category: 'FINE',
          date: day(fineChargeDate),
          amount: ils(750),
          paidBy: 'US',
          rebilledEntryId: 'seed_le_haddad_fine',
          description: 'דוח חניה 71-308812 — חויב לנהג רמי חדאד',
        },
      }),
  );
  await ensure(
    () => prisma.trafficFine.findUnique({ where: { id: 'seed_fine_octavia_parking' } }),
    () =>
      prisma.trafficFine.upsert({
        where: { id: 'seed_fine_octavia_parking' },
        update: {},
        create: {
          id: 'seed_fine_octavia_parking',
          vehicleId: 'seed_v_taxi_octavia',
          driverId: 'seed_drv_haddad',
          contractId: 'seed_lease_haddad',
          fineNo: '71-308812',
          authority: 'עיריית נצרת — פיקוח חניה',
          offenceAt: at(`${addPeriods(thisPeriod, -3)}-11`, '14:20'),
          receivedAt: day(parkingReceived),
          amount: ils(750),
          status: 'PAID_BY_US',
          reassignDeadline: day(fineReassignDeadline(parkingReceived)),
          chargeEntryId: 'seed_le_haddad_fine',
          notes: 'שולם על ידינו וחויב לנהג',
        },
      }),
  );

  /* ---------------------------------- Reminders ---------------------------------- */
  const reminders: Prisma.ReminderUncheckedCreateInput[] = [
    {
      id: 'seed_rem_license_fee',
      title: 'לשלם אגרה שנתית לרישיונות המוניות (שובר דצמבר)',
      dueAt: day(`${T.slice(0, 4)}-12-01`),
      entityType: 'TAXI_LICENSE',
      entityId: 'seed_tl_24718',
    },
    {
      id: 'seed_rem_call_consignor',
      title: 'להתקשר לסאמר נסאר — עדכון על המקדמה ל-RAV4',
      dueAt: day(addDays(T, 2)),
      entityType: 'CONTACT',
      entityId: 'seed_c_consignor_nassar',
    },
    {
      id: 'seed_rem_buyer_id_copy',
      title: 'לסרוק צילום ת״ז של הקונה (מאזדה 3)',
      dueAt: day(addDays(T, -3)),
      entityType: 'DEAL',
      entityId: 'seed_deal_sell_mazda',
      doneAt: at(addDays(T, -3), '14:00'),
    },
    {
      // Due today -> reminders feed "due" (manual reminders have no lead days).
      id: 'seed_rem_meter_seal',
      title: 'לתאם חידוש חותמת מונה לסקודה אוקטביה (84-731-26)',
      dueAt: day(T),
      entityType: 'VEHICLE',
      entityId: 'seed_v_taxi_octavia',
      notes: 'מעבדת מונים מוסמכת — להביא את רישיון הרכב ואת אישור הכיול האחרון',
    },
  ];
  for (const r of reminders) {
    await ensure(
      () => prisma.reminder.findUnique({ where: { id: r.id as string } }),
      () => prisma.reminder.upsert({ where: { id: r.id as string }, update: {}, create: r }),
    );
  }

  /* ---------------------------------- Documents ---------------------------------- */
  await seedDocuments(adminId, T);
}

/* ------------------------------------------------------------------------------------------ */

interface BalanceRow {
  driverId: string;
  charged: Prisma.Decimal;
  paid: Prisma.Decimal;
  credited: Prisma.Decimal;
  balance: Prisma.Decimal;
  deposit_held: Prisma.Decimal;
}
interface AgeingRow {
  driverId: string;
  current: Prisma.Decimal;
  d1_30: Prisma.Decimal;
  d31_60: Prisma.Decimal;
  d61_90: Prisma.Decimal;
  d90_plus: Prisma.Decimal;
  total: Prisma.Decimal;
}

async function main(): Promise<void> {
  const tz = process.env.BUSINESS_TZ || DEFAULT_BUSINESS_TZ;
  const today = todayInBusinessTz(tz);
  const admin = await seedAdmin();
  await seedSettings();
  await migrateLegacySpelling();

  const demo = !['false', '0', 'no'].includes((process.env.SEED_DEMO ?? 'true').toLowerCase());
  if (demo) await seedDemo(admin.id, today);

  console.log(`Seed done (today ${today} ${tz}): ${created} created, ${existing} already present.`);
  console.log(`Admin: ${admin.email}${demo ? '' : ' (demo data skipped: SEED_DEMO=false)'}`);
  if (demo) {
    const balances = await prisma.$queryRaw<BalanceRow[]>`
      SELECT "driverId", charged, paid, credited, balance, deposit_held FROM driver_balance_v ORDER BY "driverId"`;
    const ageing = await prisma.$queryRaw<AgeingRow[]>`
      SELECT "driverId", "current", d1_30, d31_60, d61_90, d90_plus, total FROM driver_ageing_v ORDER BY "driverId"`;
    console.table(
      balances.map((b) => ({
        driver: b.driverId,
        charged: Number(b.charged),
        paid: Number(b.paid),
        credited: Number(b.credited),
        balance: Number(b.balance),
        deposit: Number(b.deposit_held),
      })),
    );
    console.table(
      ageing.map((a) => ({
        driver: a.driverId,
        current: Number(a.current),
        d1_30: Number(a.d1_30),
        d31_60: Number(a.d31_60),
        d61_90: Number(a.d61_90),
        d90_plus: Number(a.d90_plus),
        total: Number(a.total),
      })),
    );
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
