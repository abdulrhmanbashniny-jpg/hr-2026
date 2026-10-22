/**
 * Renders the illustrated factory product shots used by the demo seed and the reward artwork used
 * by the rewards store. Needs Playwright with Chromium:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/build-catalogue.mjs
 * The outputs are committed; replace them with real product photography when it is available.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">`;
const MARK = `<svg viewBox="6 8 44 44" width="100%" height="100%"><rect x="6" y="8" width="44" height="44" rx="12" fill="#102A43"/><path d="M18 20a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2v-6Z" fill="#FBBF24"/><path d="M28 28v8a2 2 0 0 1-2 2h-2" stroke="#FBBF24" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="24" cy="40" r="2" fill="#F59E0B"/><path d="M34 23H22" stroke="#102A43" stroke-width="1.5" stroke-linecap="round"/></svg>`;

export const PRODUCTS = [
  { file: 'interior-matt', ar: 'مطفي فاخر', sub: 'دهان داخلي', swatch: '#E9DDC9', size: '18 L' },
  { file: 'interior-silk', ar: 'حرير قابل للغسيل', sub: 'دهان داخلي', swatch: '#C7D5E0', size: '18 L' },
  { file: 'exterior-acrylic', ar: 'أكريليك مقاوم', sub: 'دهان خارجي', swatch: '#D6BE9C', size: '18 L' },
  { file: 'exterior-thermal', ar: 'عازل حراري', sub: 'دهان خارجي', swatch: '#F3EEE5', size: '18 L' },
  { file: 'primer', ar: 'أساس مائي', sub: 'برايمر', swatch: '#FFFFFF', size: '18 L' },
  { file: 'waterproofing', ar: 'عازل مائي للأسطح', sub: 'عوازل', swatch: '#A9B1BC', size: '20 KG' },
  { file: 'decorative-marble', ar: 'تأثير الرخام', sub: 'دهان ديكوري', swatch: '#B9AA99', size: '5 L' },
  { file: 'enamel', ar: 'ورنيش ومينا', sub: 'أخشاب ومعادن', swatch: '#8A3B1A', size: '3.6 L' },
];

const bucket = (p) => `<html><head>${FONTS}</head><body style="margin:0">
<div style="width:800px;height:800px;position:relative;overflow:hidden;background:radial-gradient(90% 90% at 70% 20%, ${p.swatch} 0%, #f2f4f6 62%, #e6e8ea 100%);font-family:'IBM Plex Sans Arabic';direction:rtl">
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-46%);width:430px;height:500px">
    <!-- handle -->
    <div style="position:absolute;left:30px;right:30px;top:-60px;height:150px;border:10px solid #94a3b8;border-bottom:none;border-radius:200px 200px 0 0"></div>
    <!-- lid -->
    <div style="position:absolute;left:-12px;right:-12px;top:6px;height:46px;border-radius:14px;background:linear-gradient(180deg,#e2e8f0,#94a3b8);box-shadow:0 6px 0 #64748b"></div>
    <!-- body -->
    <div style="position:absolute;left:0;right:0;top:44px;bottom:0;border-radius:10px 10px 28px 28px;background:linear-gradient(90deg,#cbd5e1 0%,#f8fafc 22%,#ffffff 40%,#e2e8f0 75%,#94a3b8 100%);box-shadow:0 40px 60px -20px rgba(16,42,67,.45)">
      <div style="position:absolute;left:0;right:0;top:46px;height:300px;background:linear-gradient(135deg,#102A43 0%,#00152a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff">
        <div style="width:70px;height:70px">${MARK}</div>
        <div style="font-size:20px;color:#b0c9e8;font-weight:500">${p.sub}</div>
        <div style="font-size:40px;font-weight:700;line-height:1.2;text-align:center;padding:0 24px">${p.ar}</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
          <span style="width:34px;height:34px;border-radius:50%;background:${p.swatch};border:3px solid rgba(255,255,255,.7)"></span>
          <span style="font-family:'Space Grotesk';font-size:26px;font-weight:700;color:#FBBF24;letter-spacing:.06em;direction:ltr">${p.size}</span>
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;top:346px;height:10px;background:linear-gradient(90deg,#F59E0B,#FBBF24)"></div>
    </div>
  </div>
  <!-- paint swatch blob -->
  <div style="position:absolute;right:46px;bottom:52px;width:180px;height:110px;border-radius:60% 40% 55% 45%/55% 50% 50% 45%;background:${p.swatch};box-shadow:inset 0 -10px 20px rgba(0,0,0,.08),0 12px 24px rgba(16,42,67,.18)"></div>
</div></body></html>`;

const REWARD_ART = {
  fuel_voucher: { bg: ['#102A43', '#00152a'], glyph: `<svg viewBox="0 0 24 24" width="230" height="230" fill="none" stroke="#FBBF24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22h12"/><path d="M4 9h10"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`, label: 'FUEL' },
  supplier_discount: { bg: ['#795900', '#3c2300'], glyph: `<svg viewBox="0 0 24 24" width="230" height="230" fill="none" stroke="#FFDF9F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="m9 15 6-6"/><circle cx="9.5" cy="9.5" r=".8" fill="#FFDF9F"/><circle cx="14.5" cy="14.5" r=".8" fill="#FFDF9F"/></svg>`, label: '%' },
  tool: { bg: ['#314863', '#102A43'], glyph: `<svg viewBox="0 0 24 24" width="230" height="230" fill="none" stroke="#FBBF24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="6" x="2" y="2" rx="2"/><path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect width="4" height="6" x="8" y="16" rx="1"/></svg>`, label: 'PRO' },
  cash_out: { bg: ['#065f46', '#022c22'], glyph: `<svg viewBox="0 0 24 24" width="230" height="230" fill="none" stroke="#6EE7B7" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`, label: 'SAR' },
  other: { bg: ['#7c2d12', '#431407'], glyph: `<svg viewBox="0 0 24 24" width="230" height="230" fill="none" stroke="#FED7AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>`, label: 'GIFT' },
};

const reward = (a) => `<html><head>${FONTS}</head><body style="margin:0">
<div style="width:800px;height:520px;position:relative;overflow:hidden;background:radial-gradient(80% 110% at 85% 0%, ${a.bg[0]} 0%, ${a.bg[1]} 75%)">
  <div style="position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.05) 1px,transparent 1px);background-size:32px 32px"></div>
  <div style="position:absolute;right:-90px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.28),transparent 65%)"></div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-6deg);filter:drop-shadow(0 30px 40px rgba(0,0,0,.45))">${a.glyph}</div>
  <div style="position:absolute;left:36px;bottom:30px;font-family:'Space Grotesk';font-weight:700;font-size:64px;letter-spacing:.12em;color:rgba(255,255,255,.12)">${a.label}</div>
  <div style="position:absolute;right:30px;top:30px;width:56px;height:56px">${MARK}</div>
</div></body></html>`;

const browser = await chromium.launch();
async function shoot(html, out, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, await page.screenshot({ type: 'jpeg', quality: 82 }));
  await page.close();
  console.log('wrote', path.relative(root, out));
}

for (const p of PRODUCTS) await shoot(bucket(p), path.join(root, `scripts/seed-media/products/${p.file}.jpg`), 800, 800);
for (const [kind, a] of Object.entries(REWARD_ART)) await shoot(reward(a), path.join(root, `public/rewards/${kind}.jpg`), 800, 520);
await browser.close();
