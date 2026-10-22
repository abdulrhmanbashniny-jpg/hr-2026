import { importPKCS8, SignJWT } from 'jose';
import { env } from '@/lib/env';

export function googleWalletConfigured(): boolean {
  return !!(env.googleWallet.issuerId && env.googleWallet.serviceAccountEmail && env.googleWallet.privateKey);
}

export interface PassInput {
  code: string;
  displayName: string;
  tierLabel: string;
  city: string;
  profileUrl: string;
}

/**
 * A "Save to Google Wallet" link for a generic pass. The JWT carries both the class and the object,
 * so the first save creates the class; later saves update the craftsman's object in place.
 */
export async function googleWalletSaveUrl(p: PassInput): Promise<string> {
  const issuer = env.googleWallet.issuerId;
  const classId = `${issuer}.hirfa_member`;
  const objectId = `${issuer}.member_${p.code}`;
  const key = await importPKCS8(env.googleWallet.privateKey, 'RS256');
  const jwt = await new SignJWT({
    iss: env.googleWallet.serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    origins: [env.appUrl],
    payload: {
      genericClasses: [{ id: classId }],
      genericObjects: [
        {
          id: objectId,
          classId,
          state: 'ACTIVE',
          hexBackgroundColor: '#102A43',
          logo: { sourceUri: { uri: `${env.appUrl}/icons/icon-192.png` }, contentDescription: { defaultValue: { language: 'ar', value: 'منصة معلمي الدهانات' } } },
          cardTitle: { defaultValue: { language: 'ar', value: 'منصة معلمي الدهانات · بطاقة العضوية المعتمدة' } },
          subheader: { defaultValue: { language: 'ar', value: p.tierLabel } },
          header: { defaultValue: { language: 'ar', value: p.displayName } },
          textModulesData: [
            { id: 'code', header: 'رقم العضوية', body: p.code },
            { id: 'city', header: 'المدينة', body: p.city },
          ],
          barcode: { type: 'QR_CODE', value: `${p.profileUrl}?src=wallet`, alternateText: p.code },
          linksModuleData: { uris: [{ uri: p.profileUrl, description: 'الملف المهني الموثق' }] },
        },
      ],
    },
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
