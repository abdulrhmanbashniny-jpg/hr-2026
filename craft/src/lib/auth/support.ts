import { normalizeSaudiMobile } from '@/lib/phone';
import { getBrand } from '@/lib/products/service';

/** The team's WhatsApp number from the factory settings, as wa.me expects it (digits only), if it is a mobile. */
export async function supportWhatsapp(): Promise<string | null> {
  const brand = await getBrand();
  const phone = normalizeSaudiMobile(brand.phone ?? '');
  return phone ? phone.slice(1) : null;
}
