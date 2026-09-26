import { LehengaOutfit } from '../types';

export function updateDocumentMetaForOutfit(outfit: LehengaOutfit | null) {
  const baseUrl = window.location.origin;

  if (!outfit) {
    const defaultTitle =
      "LOL: Lehenga On Lease By Sanjeevani | Indore's Gen Z Designer Rental Vault";
    const defaultDesc =
      "Stop buying outfits you'll only wear once for Instagram. Rent it, flex it, return it. No commitment, just vibes. By Sanjeevani in Indore.";
    const defaultImage = `${baseUrl}/images/lehenga-orange-zardosi.jpg`;

    document.title = defaultTitle;
    setMetaTag('name', 'description', defaultDesc);
    setMetaTag('property', 'og:title', defaultTitle);
    setMetaTag('property', 'og:description', defaultDesc);
    setMetaTag('property', 'og:image', defaultImage);
    setMetaTag('property', 'og:url', baseUrl);
    setMetaTag('name', 'twitter:title', defaultTitle);
    setMetaTag('name', 'twitter:description', defaultDesc);
    setMetaTag('name', 'twitter:image', defaultImage);
    injectProductJsonLd(null, baseUrl);
    return;
  }

  const title = `${outfit.title} (₹${outfit.pricePerDay.toLocaleString('en-IN')}/day) | LOL: Lehenga On Lease`;
  const description = `${outfit.ogHumorTagline || outfit.description} • Code: ${outfit.code} • Rent in Indore by Sanjeevani.`;
  const imageUrl = outfit.mediaUrl.startsWith('http')
    ? outfit.mediaUrl
    : `${baseUrl}${outfit.mediaUrl.startsWith('/') ? '' : '/'}${outfit.mediaUrl}`;
  const shareUrl = `${baseUrl}/?outfit=${encodeURIComponent(outfit.id)}`;

  document.title = title;
  setMetaTag('name', 'description', description);
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:image', imageUrl);
  setMetaTag('property', 'og:url', shareUrl);
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setMetaTag('name', 'twitter:image', imageUrl);

  injectProductJsonLd(outfit, baseUrl);
}

function setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function injectProductJsonLd(outfit: LehengaOutfit | null, baseUrl: string) {
  const scriptId = 'lol-dynamic-jsonld';
  let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = scriptId;
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }

  if (!outfit) {
    scriptEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ClothingStore',
      name: 'LOL: Lehenga On Lease By Sanjeevani',
      description:
        "Stop buying outfits you'll only wear once for Instagram. Rent it, flex it, return it. No commitment, just vibes.",
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Indore',
        addressRegion: 'MP',
        addressCountry: 'IN',
      },
      telephone: '+917000861465',
      url: baseUrl,
    });
    return;
  }

  const imageUrl = outfit.mediaUrl.startsWith('http')
    ? outfit.mediaUrl
    : `${baseUrl}${outfit.mediaUrl.startsWith('/') ? '' : '/'}${outfit.mediaUrl}`;

  scriptEl.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: outfit.title,
    sku: outfit.code,
    image: [imageUrl],
    description: outfit.ogHumorTagline || outfit.description,
    brand: {
      '@type': 'Brand',
      name: 'LOL: Lehenga On Lease By Sanjeevani',
    },
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/?outfit=${encodeURIComponent(outfit.id)}`,
      priceCurrency: 'INR',
      price: outfit.pricePerDay,
      availability: outfit.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  });
}

export function buildWhatsAppShareUrl(outfit: LehengaOutfit): string {
  const shareLink = `${window.location.origin}/?outfit=${encodeURIComponent(outfit.id)}`;
  const message = [
    `Bestie look at this Lehenga before someone else books it! 😍🔥`,
    ``,
    `✨ *${outfit.title}* (${outfit.code})`,
    `💸 *Lease Price:* ₹${outfit.pricePerDay.toLocaleString('en-IN')}/day (Retail: ₹${outfit.retailPrice.toLocaleString('en-IN')})`,
    `💬 "${outfit.ogHumorTagline || outfit.description}"`,
    ``,
    `Peep the fit on LOL: Lehenga On Lease By Sanjeevani 👇`,
    shareLink,
  ].join('\n');

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppBookingUrl(params: {
  lehengaNameAndId: string;
  selectedDate: string;
  selectedTime: string;
  userPhone: string;
}): { url: string; formattedMessage: string } {
  const formattedMessage = `Hey LOL Team! 👋 I want to lock this look in. \n✨ Lehenga: ${params.lehengaNameAndId}\n📅 Date: ${params.selectedDate}\n⏰ Pickup Time: ${params.selectedTime}\n📱 My Contact: ${params.userPhone}\nLet's secure the drip! 🔥`;

  const url = `https://wa.me/917000861465?text=${encodeURIComponent(formattedMessage)}`;
  return { url, formattedMessage };
}
