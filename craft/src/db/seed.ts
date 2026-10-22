import './load-env';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { count, eq, sql } from 'drizzle-orm';
import { dammCheckDigit, generateReferralCode } from '@/lib/codes/damm';
import { encryptSecret } from '@/lib/crypto';
import { approveInvoice } from '@/lib/invoices/pipeline';
import { fulfillRedemption, redeem } from '@/lib/rewards/service';
import { DEFAULT_ECONOMICS } from '@/lib/settings/economics';
import { storage } from '@/lib/storage';
import { closeDb, getDb } from './index';
import {
  appSettings,
  brands,
  cities,
  craftsmen,
  dealerKeys,
  dealers,
  deviceSignals,
  fraudFlags,
  incentiveRules,
  invoices,
  leads,
  portfolioMedia,
  portfolioProjects,
  products,
  referrals,
  reviews,
  regions,
  rewards,
  trades,
  users,
  verificationDocuments,
  wallets,
} from './schema';
import { BRANDS, BUSINESS, CITIES, DEALERS, FACTORY_PRODUCTS, FIRST, PROJECTS, REGIONS, REVIEW_TEXTS, REVIEWERS, REWARDS, TRADES } from './seed-data';

const db = getDb();
const MEDIA_DIR = path.resolve(import.meta.dirname, '../../scripts/seed-media');
const DAY = 86_400_000;

/** Deterministic pseudo-random numbers, so every seed produces the same demo. */
let seed = 20261021;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const ago = (days: number, jitterHours = 0) => new Date(Date.now() - days * DAY - Math.floor(rand() * jitterHours * 3_600_000));
const token = () => randomBytes(18).toString('base64url');
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

const DEMO_CODE = `83921${dammCheckDigit('83921')}`;
const DEMO_PHONE = '+966500000010';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE || '+966500000001';
const REVIEWER_PHONE = '+966500000002';

async function storeFile(prefix: 'portfolio' | 'invoice' | 'document' | 'avatar' | 'product', file: string, mime = 'image/jpeg') {
  const body = await readFile(path.join(MEDIA_DIR, file));
  const now = new Date();
  const key = `${prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${token()}.jpg`;
  await storage().put(key, body, mime);
  return { key, sha: sha(body), bytes: body.length };
}

async function reset() {
  await db.execute(sql`
    DO $$ DECLARE stmt text;
    BEGIN
      SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' RESTART IDENTITY CASCADE' INTO stmt
      FROM pg_tables WHERE schemaname = 'public';
      IF stmt IS NOT NULL THEN EXECUTE stmt; END IF;
    END $$;
  `);
  console.log('Database emptied.');
}

async function main() {
  if (process.argv.includes('--reset')) await reset();
  const [{ n }] = await db.select({ n: count() }).from(craftsmen);
  if (n > 0) {
    console.log('Already seeded. Run `npm run db:seed -- --reset` to rebuild the demo.');
    return;
  }
  const lqip = JSON.parse(await readFile(path.join(MEDIA_DIR, 'lqip.json'), 'utf8')) as Record<string, string>;

  // ── Reference data ──────────────────────────────────────
  await db.insert(regions).values(REGIONS).onConflictDoNothing();
  await db.insert(cities).values(CITIES).onConflictDoNothing();
  await db.insert(trades).values(TRADES).onConflictDoNothing();
  await db.insert(appSettings).values({ key: 'economics', value: DEFAULT_ECONOMICS }).onConflictDoNothing();
  const regionOf = Object.fromEntries(CITIES.map((c) => [c.id, c.regionCode]));

  const brandIds: Record<string, string> = {};
  for (const b of BRANDS) {
    const [row] = await db.insert(brands).values({ name: b.name, nameAr: b.nameAr }).returning({ id: brands.id });
    brandIds[b.key] = row.id;
  }

  // Dealers. The "signed" ones issue Phase 2 invoices; their device keys are known to the platform.
  const dealerRows: { id: string; key: string; cityId: string; signed: boolean; publicKey: string | null; name: string; vat: string }[] = [];
  const demoKeys: Record<string, string> = {};
  for (const d of DEALERS) {
    const [row] = await db.insert(dealers).values({ brandId: brandIds[d.brand], name: d.name, vatNumber: d.vat, cityId: d.cityId }).returning({ id: dealers.id });
    let publicKey: string | null = null;
    if (d.signed) {
      const { privateKey, publicKey: pub } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      publicKey = pub.export({ format: 'der', type: 'spki' }).toString('base64');
      await db.insert(dealerKeys).values({ dealerId: row.id, publicKey, label: 'POS-01' });
      demoKeys[d.vat] = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    }
    dealerRows.push({ id: row.id, key: d.key, cityId: d.cityId, signed: d.signed, publicKey, name: d.name, vat: d.vat });
  }
  // Private keys of the fictional demo dealers, used only by the demo receipt generator.
  await db.insert(appSettings).values({ key: 'demo_signing_keys', value: Object.fromEntries(Object.entries(demoKeys).map(([k, v]) => [k, encryptSecret(v)])) });

  await db.insert(rewards).values(
    REWARDS.map((r, i) => ({
      kind: r.kind,
      titleAr: r.titleAr,
      titleEn: r.titleEn,
      partnerName: r.partnerName,
      pointsCost: r.pointsCost,
      valueSar: r.valueSar,
      accent: r.accent,
      stock: 'stock' in r ? r.stock : null,
      minTier: 'minTier' in r ? r.minTier : null,
      sortOrder: i,
    })),
  );

  // ── The factory's catalogue ─────────────────────────────
  const productIds: string[] = [];
  for (const [i, pr] of FACTORY_PRODUCTS.entries()) {
    const img = await storeFile('product', `products/${pr.file}.jpg`);
    const [row] = await db
      .insert(products)
      .values({
        nameAr: pr.nameAr,
        nameEn: pr.nameEn,
        category: pr.category,
        descriptionAr: pr.descriptionAr,
        descriptionEn: pr.descriptionEn,
        finishAr: pr.finishAr,
        finishEn: pr.finishEn,
        coverageSqmPerLiter: pr.coverage,
        sizes: [...pr.sizes],
        swatch: pr.swatch,
        imageKey: img.key,
        isFeatured: pr.featured,
        sortOrder: i,
      })
      .returning({ id: products.id });
    productIds.push(row.id);
  }

  // ── Staff ───────────────────────────────────────────────
  const [admin] = await db.insert(users).values({ phone: ADMIN_PHONE, name: 'مدير المنصة', role: 'super_admin' }).returning();
  await db.insert(users).values({ phone: REVIEWER_PHONE, name: 'مراجع الفواتير', role: 'reviewer' });

  await db.insert(incentiveRules).values([
    { name: 'حملة الرياض الشتوية — نقاط مضاعفة', target: 'invoice', scope: 'city', cityId: 'riyadh', multiplier: 2, flatBonus: 0, startsAt: ago(10), endsAt: new Date(Date.now() + 20 * DAY), createdBy: admin.id },
    { name: 'بونص إحالات المنطقة الشرقية', target: 'referral_bonus', scope: 'region', regionCode: 'EAS', multiplier: 1.5, flatBonus: 50, startsAt: ago(5), endsAt: new Date(Date.now() + 40 * DAY), createdBy: admin.id },
    { name: 'أسبوع الدهانات الوطني', target: 'invoice', scope: 'national', multiplier: 1.2, flatBonus: 25, startsAt: ago(60), endsAt: ago(53), createdBy: admin.id },
  ]);

  // ── Craftsmen ───────────────────────────────────────────
  const cityPool = ['riyadh', 'riyadh', 'riyadh', 'riyadh', 'jeddah', 'jeddah', 'jeddah', 'dammam', 'dammam', 'khobar', 'makkah', 'madinah', 'buraidah', 'abha', 'khamis', 'tabuk', 'hail', 'taif', 'ahsa', 'jubail', 'kharj', 'jazan', 'najran', 'yanbu'];
  interface Seeded {
    id: string;
    userId: string;
    cityId: string;
    tier: 'A' | 'B' | 'C';
    createdAt: Date;
    name: string;
  }
  const people: Seeded[] = [];
  const TOTAL = 30;
  for (let i = 0; i < TOTAL; i++) {
    const demo = i === 0;
    const name = demo ? 'سالم عبدالله العتيبي' : `${FIRST[i % FIRST.length]} ${BUSINESS[i % BUSINESS.length]}`;
    const cityId = demo ? 'riyadh' : i < 7 ? pick(['riyadh', 'riyadh', 'kharj']) : pick(cityPool);
    const tier = demo ? 'A' : i % 9 === 1 ? 'A' : i % 3 === 0 ? 'B' : 'C';
    const createdAt = demo ? ago(420) : ago(between(3, 380), 20);
    const phone = demo ? DEMO_PHONE : `+9665000001${String(i).padStart(2, '0')}`;
    const [u] = await db.insert(users).values({ phone, name, createdAt, lastLoginAt: ago(between(0, 6)) }).returning();
    const verified = demo || tier !== 'C' || rand() < 0.3;
    const [c] = await db
      .insert(craftsmen)
      .values({
        userId: u.id,
        referralCode: demo ? DEMO_CODE : generateReferralCode(rand),
        displayName: name,
        bio: demo
          ? 'خبرة 14 عاماً في الدهانات الداخلية والخارجية والديكورية للفلل والمجالس. فريق من 5 فنيين، التزام بالمواعيد، وضمان مكتوب على كل مشروع. نعمل في شمال وشرق الرياض.'
          : rand() < 0.5
            ? 'دهانات داخلية وخارجية بجودة عالية، مع معالجة الرطوبة والتشققات قبل الدهان.'
            : null,
        cityId,
        district: demo ? 'حي النرجس' : null,
        declaredTier: tier,
        trades: demo ? ['interior', 'decorative', 'exterior', 'waterproofing'] : [pick(TRADES).id, pick(TRADES).id].filter((v, k, a) => a.indexOf(v) === k),
        yearsExperience: demo ? 14 : between(1, 22),
        tier,
        tierAssignedAt: tier !== 'C' ? createdAt : null,
        tierAssignedBy: tier !== 'C' ? admin.id : null,
        availability: demo ? 'available' : pick(['available', 'available', 'busy', 'away'] as const),
        whatsapp: phone,
        warrantyMonths: demo ? 24 : pick([6, 12, 12, 18]),
        identityStatus: verified ? 'verified' : 'unverified',
        nationalIdLast4: verified ? String(between(1000, 9999)) : null,
        licenseStatus: demo || tier === 'A' ? 'verified' : 'unverified',
        licenseNumber: demo || tier === 'A' ? `FL-${between(100000, 999999)}` : null,
        consent: { version: '2026-10', acceptedAt: createdAt.toISOString() },
        createdAt,
      })
      .returning();
    await db.insert(wallets).values({ craftsmanId: c.id });
    await db.insert(deviceSignals).values({ userId: u.id, event: 'signup', deviceId: `seed-device-${i}`, ipHash: `seed-ip-${i}`, ipPrefixHash: `seed-net-${i % 11}`, createdAt });
    people.push({ id: c.id, userId: u.id, cityId, tier, createdAt, name });
  }
  const demo = people[0];
  const demoPhoto = await storeFile('avatar', 'avatar-demo.jpg');
  await db.update(craftsmen).set({ avatarKey: demoPhoto.key }).where(eq(craftsmen.id, demo.id));

  // Referral tree: the demo craftsman invited six colleagues; three of them invited others (level 2).
  const tree: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
    [1, 7], [1, 8], [2, 9],
    [10, 11], [10, 12], [13, 14],
  ];
  for (const [a, b] of tree) {
    await db.update(craftsmen).set({ referredById: people[a].id }).where(eq(craftsmen.id, people[b].id));
    await db.insert(referrals).values({ referrerId: people[a].id, refereeId: people[b].id, status: 'pending', createdAt: people[b].createdAt });
  }

  // ── Portfolios ──────────────────────────────────────────
  const projectPlan: [number, number[], boolean[]][] = [
    [0, [0, 2, 3], [true, true, false]],
    ...people.slice(1).flatMap((p, k): [number, number[], boolean[]][] => (p.tier !== 'C' || k % 4 === 0 ? [[k + 1, [between(0, PROJECTS.length - 1)], [rand() < 0.3]]] : [])),
  ];
  for (const [who, list, verified] of projectPlan) {
    for (const [j, pi] of list.entries()) {
      const pr = PROJECTS[pi];
      const p = people[who];
      const [proj] = await db
        .insert(portfolioProjects)
        .values({
          craftsmanId: p.id,
          title: pr.title,
          description: pr.description,
          cityId: p.cityId,
          district: pr.district,
          completedOn: ago(between(15, 300)).toISOString().slice(0, 10),
          areaSqm: pr.area,
          brandId: brandIds[pick(BRANDS).key],
          colors: [...pr.colors],
          productIds: [productIds[[0, 1, 6, 2, 1, 0][pi]], ...(rand() < 0.5 ? [productIds[4]] : [])],
          verification: verified[j] ? 'field_verified' : 'self',
          verifiedBy: verified[j] ? admin.id : null,
          verifiedAt: verified[j] ? ago(between(1, 60)) : null,
          warrantyMonths: 12,
          sortOrder: j,
        })
        .returning({ id: portfolioProjects.id });
      for (const [k, role] of (['before', 'after'] as const).entries()) {
        const full = await storeFile('portfolio', `${pr.scene}-${role}.jpg`);
        const thumb = await storeFile('portfolio', `${pr.scene}-${role}-thumb.jpg`);
        await db.insert(portfolioMedia).values({
          projectId: proj.id,
          craftsmanId: p.id,
          kind: 'image',
          role,
          storageKey: full.key,
          thumbKey: thumb.key,
          mime: 'image/jpeg',
          bytes: full.bytes,
          width: 1280,
          height: 960,
          lqip: lqip[`${pr.scene}-${role}`] ?? null,
          sha256: full.sha,
          sortOrder: k,
        });
      }
    }
  }

  // ── Client reviews ──────────────────────────────────────
  for (const [idx, p] of people.entries()) {
    const n = idx === 0 ? 6 : p.tier === 'C' ? between(0, 1) : between(1, 4);
    for (let k = 0; k < n; k++) {
      const r = REVIEW_TEXTS[(idx + k) % REVIEW_TEXTS.length];
      await db.insert(reviews).values({
        craftsmanId: p.id,
        authorName: REVIEWERS[(idx * 3 + k) % REVIEWERS.length],
        rating: r.rating,
        body: r.body,
        projectLabel: r.project,
        status: 'approved',
        contactedViaPlatform: rand() < 0.8,
        moderatedBy: admin.id,
        moderatedAt: ago(between(1, 90)),
        createdAt: ago(between(2, 120)),
      });
    }
  }
  // A few waiting for moderation.
  for (const [k, who] of [3, 5, 8].entries()) {
    await db.insert(reviews).values({ craftsmanId: people[who].id, authorName: REVIEWERS[(k + 4) % REVIEWERS.length], rating: [5, 4, 2][k], body: ['شغل ممتاز وسريع، أنصح فيه.', 'جيد لكن احتاج متابعة في التنظيف.', 'تأخر كثير عن الموعد ولم يرد على الاتصالات.'][k], projectLabel: 'شقة', createdAt: ago(k) });
  }

  // ── Invoices, approved through the real pipeline ────────
  const receipt = await storeFile('invoice', 'receipt.jpg');
  const reviewer = admin.id;
  const queueNotes = ['الصورة غير واضحة، أعد التصوير بإضاءة أفضل', 'المورد خارج شبكة الموردين المعتمدين'];
  let made = 0;
  for (const [idx, p] of people.entries()) {
    const howMany = idx === 0 ? 12 : idx <= 9 ? between(1, 6) : rand() < 0.6 ? between(0, 4) : 0;
    for (let k = 0; k < howMany; k++) {
      const local = dealerRows.filter((d) => d.cityId === p.cityId);
      const dealer = local.length && rand() < 0.8 ? pick(local) : pick(dealerRows);
      const createdAt = ago(between(0, 40), 20);
      const total = Math.round(((idx === 0 ? between(400, 2600) : between(350, 6200)) + rand()) * 100) / 100;
      const vat = Math.round((total - total / 1.15) * 100) / 100;
      const roll = rand();
      const status = idx === 0 ? (k < 10 ? 'approve' : k === 10 ? 'pending' : 'reject') : roll < 0.72 ? 'approve' : roll < 0.84 ? 'pending' : roll < 0.92 ? 'flagged' : 'reject';
      const flagged = status === 'flagged';
      const [inv] = await db
        .insert(invoices)
        .values({
          craftsmanId: p.id,
          dealerId: dealer.id,
          status: flagged ? 'flagged' : 'pending',
          imageKey: receipt.key,
          imageSha256: sha(`${p.id}:${k}:${createdAt.getTime()}`),
          qrPayload: null,
          qrPhase: dealer.signed ? 2 : 1,
          qrSignature: flagged ? 'invalid' : dealer.signed ? 'valid' : 'unsigned',
          qrPublicKey: dealer.publicKey,
          sellerName: dealer.name,
          sellerVat: dealer.vat,
          invoiceNumber: `INV-2026-${between(100000, 999999)}`,
          issuedAt: new Date(createdAt.getTime() - between(1, 30) * 3_600_000),
          totalAmount: flagged ? Math.round(total * 3.1) : total,
          vatAmount: vat,
          declaredAmount: total,
          fingerprint: sha(`fp:${dealer.vat}:${p.id}:${k}:${createdAt.getTime()}`),
          riskScore: flagged ? between(62, 90) : dealer.signed ? between(0, 15) : between(10, 35),
          riskReasons: flagged
            ? [
                { code: 'signature_invalid', weight: 45 },
                { code: 'ai_total_mismatch', weight: 35, detail: { qr: Math.round(total * 3.1), photo: total } },
              ]
            : dealer.signed
              ? []
              : [{ code: 'qr_phase1', weight: 10 }],
          cityId: p.cityId,
          deviceId: `seed-device-${idx}`,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: invoices.id });
      if (status === 'approve') await approveInvoice(inv.id, dealer.signed && rand() < 0.7 ? null : reviewer);
      if (status === 'reject') await db.update(invoices).set({ status: 'rejected', reviewedBy: reviewer, reviewedAt: createdAt, reviewNote: pick(queueNotes), fingerprint: null }).where(eq(invoices.id, inv.id));
      made++;
    }
  }
  // Payouts happened when each invoice was approved, not all today: move their timestamps back.
  await db.execute(sql`update invoices set reviewed_at = created_at + interval '3 hours' where status = 'approved'`);
  await db.execute(sql`
    update points_ledger l set created_at = i.created_at + interval '3 hours' + (random() * interval '20 minutes')
    from invoices i where l.ref_type = 'invoice' and l.ref_id = i.id`);
  await db.execute(sql`
    update points_ledger l set created_at = c.activated_at from craftsmen c where l.kind = 'welcome_bonus' and l.craftsman_id = c.id`);
  await db.execute(sql`
    update craftsmen c set activated_at = sub.first from (select craftsman_id, min(created_at) + interval '3 hours' as first from invoices where status = 'approved' group by craftsman_id) sub
    where c.id = sub.craftsman_id`);
  await db.execute(sql`
    update referrals r set activated_at = c.activated_at from craftsmen c where r.referee_id = c.id and r.status = 'activated'`);
  await db.execute(sql`
    update points_ledger l set created_at = r.activated_at from referrals r where l.kind = 'referral_bonus' and l.ref_id = r.id`);

  // ── Redemptions ─────────────────────────────────────────
  const rewardRows = await db.select().from(rewards);
  const fuel = rewardRows.find((r) => r.pointsCost === 2000)!;
  const kit = rewardRows.find((r) => r.pointsCost === 3000)!;
  const cash = rewardRows.find((r) => r.pointsCost === 4000)!;
  try {
    const r1 = await redeem(demo.id, 'A', fuel.id, 'seed-demo-fuel');
    await fulfillRedemption(r1.id, admin.id, `SV-${between(10000000, 99999999)}`, null);
    await redeem(demo.id, 'A', kit.id, 'seed-demo-kit');
  } catch (err) {
    console.warn('demo redemptions skipped:', err instanceof Error ? err.message : err);
  }
  for (const p of people.slice(1, 8)) {
    try {
      await redeem(p.id, p.tier, cash.id, `seed-cash-${p.id}`, '0551234567');
    } catch {
      // Not enough points yet.
    }
  }

  // ── Leads (client interest this month) ──────────────────
  const leadRows: (typeof leads.$inferInsert)[] = [];
  for (const [i, p] of people.entries()) {
    const volume = i === 0 ? 140 : p.tier === 'A' ? 40 : p.tier === 'B' ? 18 : 6;
    for (let k = 0; k < volume; k++) {
      const r = rand();
      leadRows.push({
        craftsmanId: p.id,
        channel: r < 0.6 ? 'profile_view' : r < 0.8 ? 'whatsapp' : r < 0.88 ? 'call' : r < 0.95 ? 'estimate' : 'vcard',
        source: pick(['qr', 'qr', 'nfc', 'search', 'link', 'direct', 'wallet'] as const),
        createdAt: ago(between(0, 27), 23),
      });
    }
  }
  await db.insert(leads).values(leadRows);
  await db.execute(sql`update craftsmen c set profile_views = (select count(*) from leads l where l.craftsman_id = c.id and l.channel = 'profile_view')`);

  // ── A referral ring for the fraud console ───────────────
  const ring: Seeded[] = [];
  for (let i = 0; i < 4; i++) {
    const createdAt = ago(2, 10);
    const name = `${pick(FIRST)} ${pick(BUSINESS)}`;
    const [u] = await db.insert(users).values({ phone: `+96650000090${i}`, name, createdAt }).returning();
    const [c] = await db
      .insert(craftsmen)
      .values({ userId: u.id, referralCode: generateReferralCode(rand), displayName: name, cityId: 'jeddah', trades: ['interior'], yearsExperience: between(1, 3), whatsapp: `+96650000090${i}`, consent: { version: '2026-10', acceptedAt: createdAt.toISOString() }, createdAt })
      .returning();
    await db.insert(wallets).values({ craftsmanId: c.id });
    await db.insert(deviceSignals).values([
      { userId: u.id, event: 'signup', deviceId: 'ring-device-7f3a', ipHash: 'ring-ip', ipPrefixHash: 'ring-net', createdAt },
      { userId: u.id, event: 'login', deviceId: 'ring-device-7f3a', ipHash: 'ring-ip', ipPrefixHash: 'ring-net', createdAt },
    ]);
    ring.push({ id: c.id, userId: u.id, cityId: 'jeddah', tier: 'C', createdAt, name });
  }
  for (const r of ring.slice(1)) {
    await db.update(craftsmen).set({ referredById: ring[0].id }).where(eq(craftsmen.id, r.id));
    const [ref] = await db
      .insert(referrals)
      .values({
        referrerId: ring[0].id,
        refereeId: r.id,
        status: 'held',
        riskScore: 100,
        riskReasons: [
          { code: 'same_device_as_referrer', weight: 80 },
          { code: 'same_network_recent', weight: 30 },
          { code: 'adjacent_phone', weight: 15 },
        ],
        createdAt: r.createdAt,
      })
      .returning({ id: referrals.id });
    await db.insert(fraudFlags).values({ subjectType: 'referral', subjectId: ref.id, craftsmanId: ring[0].id, rule: 'same_device_as_referrer', score: 100, details: { reasons: ['same_device_as_referrer', 'same_network_recent', 'adjacent_phone'] }, createdAt: r.createdAt });
  }
  const flaggedInvoices = await db.select({ id: invoices.id, craftsmanId: invoices.craftsmanId, score: invoices.riskScore, createdAt: invoices.createdAt }).from(invoices).where(eq(invoices.status, 'flagged'));
  for (const f of flaggedInvoices)
    await db.insert(fraudFlags).values({ subjectType: 'invoice', subjectId: f.id, craftsmanId: f.craftsmanId, rule: 'signature_invalid', score: f.score, details: { reasons: ['signature_invalid', 'ai_total_mismatch'] }, createdAt: f.createdAt });

  // ── Verification requests waiting for staff ─────────────
  const pendingDocs = people.filter((p) => p.tier === 'C').slice(0, 4);
  for (const [i, p] of pendingDocs.entries()) {
    const doc = await storeFile('document', 'id-sample.jpg');
    const kind = i === 3 ? 'freelance_license' : 'national_id';
    await db.insert(verificationDocuments).values({ craftsmanId: p.id, kind, storageKey: doc.key, mime: 'image/jpeg', createdAt: ago(i, 8) });
    await db
      .update(craftsmen)
      .set(kind === 'national_id' ? { identityStatus: 'pending', nationalIdEnc: encryptSecret(`10${between(10000000, 99999999)}`), nationalIdLast4: String(between(1000, 9999)) } : { licenseStatus: 'pending', licenseNumber: `FL-${between(100000, 999999)}` })
      .where(eq(craftsmen.id, p.id));
  }

  // Notifications: spread over the last week, older ones read.
  await db.execute(sql`update notifications set created_at = now() - (random() * interval '7 days')`);
  await db.execute(sql`update notifications set read_at = created_at + interval '1 hour' where created_at < now() - interval '2 days'`);

  const [{ approved }] = await db.select({ approved: count() }).from(invoices).where(eq(invoices.status, 'approved'));
  console.log(`Seeded ${people.length + ring.length} craftsmen, ${made} invoices (${approved} approved), ${leadRows.length} leads.`);
  console.log('');
  console.log('  Super admin   ', ADMIN_PHONE);
  console.log('  Reviewer      ', REVIEWER_PHONE);
  console.log('  Demo craftsman', DEMO_PHONE, `(member ${DEMO_CODE}, tier A, Riyadh)`);
  console.log('  Sign in with the phone number; with SMS_DRIVER=console the code is printed in the server log and shown on screen in development.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
