export const site = {
  origin: process.env.NEXT_PUBLIC_SITE_URL || "https://kriosity.in",
  basePath: "/blog",
  name: "Kriosity Blog",
  description:
    "Hands-on AI coverage from Kriosity: new models, real comparisons and what each release means for teams building in India. Every post lists its sources.",
};

export const blogUrl = (path = "") => `${site.origin}${site.basePath}${path}`;

/** Products a post may link to at the end. Keep in sync with kriosity.in/products. */
export const products: Record<string, { name: string; url: string; pitch: string }> = {
  paidtwice: { name: "PaidTwice", url: "https://kriosity.in/products/paidtwice", pitch: "Catch duplicate supplier payments before they leave your bank." },
  slotrecover: { name: "SlotRecover", url: "https://kriosity.in/products/slotrecover", pitch: "Fill cancelled appointments automatically." },
  mahina: { name: "Mahina", url: "https://kriosity.in/products/mahina", pitch: "Collect monthly fees on WhatsApp without chasing." },
  aegistra: { name: "Aegistra", url: "https://kriosity.in/products/aegistra", pitch: "Keep a register of the AI your company uses." },
  kriosityops: { name: "KriosityOps", url: "https://kriosity.in/products/kriosityops", pitch: "One place to run every app you've launched." },
  beamdrop: { name: "BeamDrop", url: "https://kriosity.in/products/beamdrop", pitch: "Send large files straight from browser to browser." },
};
