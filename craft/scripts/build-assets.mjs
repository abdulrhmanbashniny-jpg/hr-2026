/**
 * Renders the static assets that ship with the app: PWA icons, the Open Graph image, and the
 * illustrated before/after room scenes used by the demo seed. Needs Playwright with Chromium:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/build-assets.mjs
 * The outputs are committed, so this only runs when the artwork changes.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');

const LOGO = `<svg viewBox="6 8 44 44" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="8" width="44" height="44" rx="12" fill="#102A43"/><path d="M18 20a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2v-6Z" fill="#FBBF24"/><path d="M28 28v8a2 2 0 0 1-2 2h-2" stroke="#FBBF24" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="24" cy="40" r="2" fill="#F59E0B"/><path d="M34 23H22" stroke="#102A43" stroke-width="1.5" stroke-linecap="round"/></svg>`;

const icon = (size, maskable) => `<html><body style="margin:0;background:${maskable ? '#102A43' : 'transparent'}">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center">
<div style="width:${maskable ? size * 0.72 : size}px;height:${maskable ? size * 0.72 : size}px">${LOGO.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`;

const og = `<html><head><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet"></head>
<body style="margin:0;overflow:hidden"><div style="width:1200px;height:630px;font-family:'IBM Plex Sans Arabic';direction:rtl;overflow:hidden;background:radial-gradient(130% 140% at 0% 0%,#243b53 0%,#102a43 50%,#0a1b2c 100%);color:#fff;position:relative">
<div style="position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.05) 1px,transparent 1px);background-size:28px 28px"></div>
<div style="position:absolute;left:-120px;top:-160px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.35),transparent 65%)"></div>
<div style="position:absolute;right:80px;top:90px;display:flex;align-items:center;gap:22px"><div style="width:92px;height:92px">${LOGO.replace('<svg ', '<svg width="100%" height="100%" ')}</div><div style="font-size:54px;font-weight:700">منصة معلمي الدهانات</div></div>
<div style="position:absolute;right:80px;top:240px;font-size:58px;font-weight:700;line-height:1.25;max-width:760px">بطاقة عضوية معتمدة<br>لكل معلم دهان</div>
<div style="position:absolute;right:80px;bottom:80px;font-size:26px;color:rgba(255,255,255,.75)">مجتمع فنيي الدهانات وطلاء المباني · نقاط ومكافآت على كل شراء</div>
<div style="position:absolute;left:80px;top:150px;width:400px;height:252px;border-radius:24px;background:linear-gradient(135deg,#334e68,#102a43);box-shadow:0 30px 60px rgba(0,0,0,.45);transform:rotate(-8deg);border:1px solid rgba(255,255,255,.12)">
<div style="position:absolute;left:28px;bottom:28px;font:700 40px 'Space Grotesk',monospace;letter-spacing:6px;color:#FBBF24;direction:ltr">839 218</div>
<div style="position:absolute;right:28px;top:26px;width:46px;height:34px;border-radius:7px;background:linear-gradient(135deg,#fde68a,#f59e0b 55%,#b45309)"></div></div>
</div></body></html>`;

/** An illustrated room. `state` is before (tired, stained, patched) or after (fresh paint, warm light). */
function room({ wall, accent, floor, state, kind }) {
  const before = state === 'before';
  const w = before ? '#b9b2a6' : wall;
  const a = before ? '#a9a296' : accent;
  const stains = before
    ? Array.from({ length: 14 }, (_, i) => {
        const x = (i * 137) % 1180;
        const y = 80 + ((i * 89) % 420);
        const r = 40 + ((i * 53) % 90);
        return `<div style="position:absolute;left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 1.4}px;border-radius:50%;background:radial-gradient(closest-side,rgba(110,95,70,.28),transparent);filter:blur(4px)"></div>`;
      }).join('') +
      `<svg style="position:absolute;inset:0" viewBox="0 0 1280 720"><path d="M220 90 l30 60 l-18 40 l34 70" stroke="rgba(60,50,40,.35)" stroke-width="2.5" fill="none"/><path d="M930 120 l-24 50 l20 36 l-30 64 l14 40" stroke="rgba(60,50,40,.3)" stroke-width="2" fill="none"/></svg>` +
      `<div style="position:absolute;left:520px;top:210px;width:170px;height:110px;background:#d9d4c9;border-radius:6px;transform:rotate(-3deg);opacity:.85"></div><div style="position:absolute;left:760px;top:330px;width:120px;height:70px;background:#cfc9bd;border-radius:6px;transform:rotate(4deg);opacity:.8"></div>`
    : '';
  const light = before ? 'rgba(0,0,0,.12)' : 'rgba(255,244,214,.45)';
  const furniture =
    kind === 'living'
      ? `<div style="position:absolute;left:330px;bottom:120px;width:620px;height:150px;border-radius:26px 26px 12px 12px;background:${before ? '#6d6a64' : '#2f4a63'};box-shadow:0 30px 40px rgba(0,0,0,.25)"></div>
         <div style="position:absolute;left:300px;bottom:150px;width:70px;height:170px;border-radius:22px;background:${before ? '#5e5b55' : '#243b53'}"></div>
         <div style="position:absolute;left:910px;bottom:150px;width:70px;height:170px;border-radius:22px;background:${before ? '#5e5b55' : '#243b53'}"></div>
         <div style="position:absolute;left:470px;bottom:330px;width:340px;height:180px;border:10px solid ${before ? '#8b857a' : '#d9b46a'};background:${before ? '#9c968a' : 'linear-gradient(135deg,#f4d58d,#e07a5f 60%,#3d405b)'};box-shadow:0 10px 30px rgba(0,0,0,.2)"></div>`
      : kind === 'bedroom'
        ? `<div style="position:absolute;left:360px;bottom:110px;width:560px;height:260px;border-radius:18px 18px 0 0;background:${before ? '#6f6a60' : '#7a5c43'}"></div>
           <div style="position:absolute;left:380px;bottom:110px;width:520px;height:120px;border-radius:12px;background:${before ? '#8a857c' : '#f3efe6'};box-shadow:0 30px 40px rgba(0,0,0,.2)"></div>
           <div style="position:absolute;left:420px;bottom:200px;width:160px;height:60px;border-radius:16px;background:${before ? '#9a958b' : '#e9dfcf'}"></div><div style="position:absolute;left:700px;bottom:200px;width:160px;height:60px;border-radius:16px;background:${before ? '#9a958b' : '#e9dfcf'}"></div>`
        : kind === 'kitchen'
          ? `<div style="position:absolute;left:120px;right:120px;bottom:110px;height:200px;background:${before ? '#7b776f' : '#f7f4ee'};border-top:14px solid ${before ? '#55524c' : '#2d3e50'}"></div>
             ${Array.from({ length: 6 }, (_, i) => `<div style="position:absolute;left:${150 + i * 170}px;bottom:130px;width:150px;height:150px;border:3px solid ${before ? '#66625b' : '#d8d2c6'};border-radius:6px"></div>`).join('')}
             <div style="position:absolute;left:120px;right:120px;top:120px;height:150px;background:${before ? '#7b776f' : '#f7f4ee'};border-radius:4px"></div>`
          : `<div style="position:absolute;left:200px;right:200px;bottom:110px;height:430px;background:${before ? '#bdb6aa' : wall};box-shadow:0 40px 60px rgba(0,0,0,.25)"></div>
             ${[0, 1, 2].map((i) => `<div style="position:absolute;left:${290 + i * 260}px;bottom:300px;width:150px;height:160px;background:${before ? '#5f5b55' : '#2f4a63'};border:10px solid ${before ? '#a39d92' : accent}"></div>`).join('')}
             <div style="position:absolute;left:560px;bottom:110px;width:160px;height:200px;background:${before ? '#4c4842' : '#6b4f3a'};border:10px solid ${before ? '#a39d92' : accent}"></div>`;
  const exterior = kind === 'facade';
  return `<html><body style="margin:0;width:1280px;height:960px;overflow:hidden;position:relative;background:${exterior ? (before ? 'linear-gradient(#c9c6bd,#e3dfd4)' : 'linear-gradient(#7fb3e0,#cfe6f7 70%)') : w}">
  ${exterior ? '' : `<div style="position:absolute;inset:0 0 240px 0;background:${w}"></div><div style="position:absolute;left:0;top:0;width:200px;height:720px;background:${a};clip-path:polygon(0 0,100% 12%,100% 88%,0 100%)"></div><div style="position:absolute;right:0;top:0;width:200px;height:720px;background:${a};clip-path:polygon(0 12%,100% 0,100% 100%,0 88%)"></div>`}
  ${exterior ? '' : `<div style="position:absolute;left:820px;top:120px;width:240px;height:300px;background:${before ? '#c8c3b8' : 'linear-gradient(160deg,#fff7e0,#ffe2a8)'};border:12px solid ${before ? '#9b958a' : '#fff'};box-shadow:inset 0 0 0 6px ${before ? '#8d877c' : '#f2e8d5'}"></div>`}
  <div style="position:absolute;inset:0;background:radial-gradient(70% 60% at 70% 25%,${light},transparent 70%)"></div>
  ${stains}
  <div style="position:absolute;left:0;right:0;bottom:0;height:${exterior ? 110 : 240}px;background:${exterior ? (before ? '#8f8a80' : '#5d6b5a') : floor};"></div>
  ${exterior ? '' : `<div style="position:absolute;left:0;right:0;bottom:240px;height:16px;background:${before ? '#8c867b' : '#fff'}"></div>`}
  ${exterior ? '' : `<div style="position:absolute;left:0;right:0;bottom:0;height:240px;background:repeating-linear-gradient(90deg,rgba(0,0,0,.07) 0 2px,transparent 2px 160px);opacity:.8"></div>`}
  ${furniture}
  ${before ? '<div style="position:absolute;inset:0;background:rgba(80,70,55,.12);mix-blend-mode:multiply"></div>' : ''}
  </body></html>`;
}

const SCENES = [
  { file: 'living', kind: 'living', wall: '#d8c9b0', accent: '#b98b5e', floor: '#a47551' },
  { file: 'bedroom', kind: 'bedroom', wall: '#a7c4bc', accent: '#6f9c94', floor: '#b08968' },
  { file: 'kitchen', kind: 'kitchen', wall: '#e9e2d0', accent: '#c9b98f', floor: '#8d6e52' },
  { file: 'facade', kind: 'facade', wall: '#efe3c8', accent: '#c69c54', floor: '#5d6b5a' },
  { file: 'majlis', kind: 'living', wall: '#c6b4d8', accent: '#8f74ad', floor: '#7d5a44' },
  { file: 'office', kind: 'kitchen', wall: '#cbd8e6', accent: '#5f7d9c', floor: '#6f7d8c' },
];

const browser = await chromium.launch();
async function shoot(html, out, w, h, type = 'png', omitBackground = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, await page.screenshot({ type, quality: type === 'jpeg' ? 78 : undefined, omitBackground }));
  await page.close();
  console.log('wrote', path.relative(root, out));
}

await shoot(icon(192), path.join(root, 'public/icons/icon-192.png'), 192, 192, 'png', true);
await shoot(icon(512), path.join(root, 'public/icons/icon-512.png'), 512, 512, 'png', true);
await shoot(icon(512, true), path.join(root, 'public/icons/maskable-512.png'), 512, 512);
await shoot(icon(180, true), path.join(root, 'src/app/apple-icon.png'), 180, 180);
await shoot(og, path.join(root, 'public/og.png'), 1200, 630);
const lqip = {};
const onlyBrand = process.env.ONLY_BRAND === '1';
for (const s of onlyBrand ? [] : SCENES) {
  for (const state of ['before', 'after']) {
    const name = `${s.file}-${state}`;
    const html = room({ ...s, state });
    await shoot(html, path.join(root, `scripts/seed-media/${name}.jpg`), 1280, 960, 'jpeg');
    // Thumbnail (720 px) and a 24 px blur-up placeholder, the same way the browser does on upload.
    const scaled = (w) => `<html><body style="margin:0;overflow:hidden"><div style="width:1280px;height:960px;transform:scale(${w / 1280});transform-origin:0 0">${html.replace(/<\/?(html|body)[^>]*>/g, '')}</div></body></html>`;
    await shoot(scaled(720), path.join(root, `scripts/seed-media/${name}-thumb.jpg`), 720, 540, 'jpeg');
    const page = await browser.newPage({ viewport: { width: 24, height: 18 } });
    await page.setContent(scaled(24));
    lqip[name] = `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 50 })).toString('base64')}`;
    await page.close();
  }
}
// A sample simplified tax invoice (fictional dealer) for seeded invoices, and an ID placeholder.
const QRCode = require('qrcode');
const tlv = (tag, v) => { const b = Buffer.from(v, 'utf8'); return Buffer.concat([Buffer.from([tag, b.length]), b]); };
const qrPayload = Buffer.concat([tlv(1, 'معرض الصحراء للدهانات'), tlv(2, '310000000100003'), tlv(3, '2026-10-18T16:42:00+03:00'), tlv(4, '1897.50'), tlv(5, '247.50')]).toString('base64');
const qrSvg = await QRCode.toString(qrPayload, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
const line = (a, b) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${a}</span><span style="font-family:'IBM Plex Mono',monospace">${b}</span></div>`;
const receipt = `<html><head><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#d9dde2;display:grid;place-items:center;width:720px;height:1080px">
<div style="width:520px;background:#fffdf8;padding:36px 34px;font-family:'IBM Plex Sans Arabic';direction:rtl;color:#1d232b;font-size:19px;line-height:1.7;box-shadow:0 20px 40px rgba(0,0,0,.18);transform:rotate(-1.2deg)">
<div style="text-align:center;font-weight:700;font-size:26px">معرض الصحراء للدهانات</div>
<div style="text-align:center;font-size:16px;color:#555">فاتورة ضريبية مبسطة · Simplified Tax Invoice</div>
<div style="text-align:center;font-size:16px">الرقم الضريبي: <span style="font-family:'IBM Plex Mono'">310000000100003</span></div>
<div style="border-top:2px dashed #999;margin:14px 0"></div>
${line('رقم الفاتورة', 'INV-2026-004812')}${line('التاريخ', '2026-10-18 16:42')}
<div style="border-top:2px dashed #999;margin:14px 0"></div>
${line('دهان داخلي مطفي 18 لتر × 2', '960.00')}${line('أساس مائي 18 لتر × 1', '390.00')}${line('رول احترافي 9 بوصة × 3', '150.00')}${line('شريط لاصق × 6', '150.00')}
<div style="border-top:2px dashed #999;margin:14px 0"></div>
${line('الإجمالي غير شامل الضريبة', '1,650.00')}${line('ضريبة القيمة المضافة 15٪', '247.50')}
<div style="display:flex;justify-content:space-between;font-weight:700;font-size:24px"><span>الإجمالي</span><span style="font-family:'IBM Plex Mono'">1,897.50 ر.س</span></div>
<div style="margin:22px auto 6px;width:220px">${qrSvg}</div>
<div style="text-align:center;font-size:14px;color:#666">شكراً لتسوقكم — عينة لأغراض العرض</div>
</div></body></html>`;
if (!onlyBrand) await shoot(receipt, path.join(root, 'scripts/seed-media/receipt.jpg'), 720, 1080, 'jpeg');
const idSample = `<html><head><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#cfd6dd;display:grid;place-items:center;width:960px;height:640px"><div style="width:760px;height:480px;border-radius:24px;background:linear-gradient(135deg,#e7efe9,#cfe0d6);box-shadow:0 20px 40px rgba(0,0,0,.2);font-family:'IBM Plex Sans Arabic';direction:rtl;position:relative;color:#1f3b2d">
<div style="position:absolute;right:40px;top:36px;font-size:30px;font-weight:700">وثيقة تعريف — عينة</div>
<div style="position:absolute;right:40px;top:90px;font-size:20px;opacity:.7">صورة توضيحية لأغراض العرض فقط</div>
<div style="position:absolute;left:40px;top:120px;width:200px;height:250px;border-radius:16px;background:#b8c9bf"></div>
${[0, 1, 2, 3].map((i) => `<div style="position:absolute;right:40px;top:${170 + i * 60}px;width:${380 - i * 50}px;height:22px;border-radius:11px;background:rgba(31,59,45,.18)"></div>`).join('')}
</div></body></html>`;
if (!onlyBrand) {
  await shoot(idSample, path.join(root, 'scripts/seed-media/id-sample.jpg'), 960, 640, 'jpeg');
  await writeFile(path.join(root, 'scripts/seed-media/lqip.json'), JSON.stringify(lqip, null, 1) + '\n');
}
await writeFile(path.join(root, 'src/app/icon.svg'), LOGO);
await browser.close();
