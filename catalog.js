// Catalog snapshot / starter data. Verify product names against Ainayya's live website.
export const familySeries = [
  "PO Noora Raya Series",
  "Sylviora Series",
  "Keumala Series"
];

export const catalog = {
  "PO Noora Raya Series": [
    "PO Noora Dress", "PO Noora Kurung", "PO Noora One Set",
    "PO Noora Scarf", "PO Noora Koko", "PO Noora Koko Anak",
    "PO Noora Dress Anak", "PO Noora Sarimbit"
  ],
  "Sylviora Series": [
    "Sylviora Dress", "Sylviora Kurung", "Sylviora Blouse",
    "Sylviora Koko", "Sylviora Dress Anak", "Sylviora Koko Anak"
  ],
  "Keumala Series": [
    "Keumala Dress", "Keumala Kurung", "Keumala Dress Anak",
    "Keumala Koko", "Keumala Koko Anak", "Keumala Scarf"
  ],
  "Niskala Kurung": ["Niskala Kurung"],
  "Lana Kurung": ["Lana Kurung"],
  "Gamila Series": ["Gamila Series"],
  "Omah Nenek Series": ["Omah Nenek Series"],
  "Juwita Series": ["Juwita Series"],
  "Puspita Series": ["Puspita Series"],
  "Meutia Series": ["Meutia Series"],
  "Kayana Series": ["Kayana Series"],
  "Imara Series": ["Imara Series"],
  "Angsana Series": ["Angsana Series"],
  "Patrakomala Series": ["Patrakomala Series"],
  "Individual products": [
    "Evelyn Shoes", "Elara Bloom Cardigan", "Viona Shoes", "Elea Bag",
    "Velvée Premium Soft Paris", "Bloom Shirt", "Alyssa Blouse",
    "Pertiwi Sendja Blouse", "Elodie Blouse", "Allie Blouse",
    "Althea Blouse", "Kaia Set", "Elyse Set Outer"
  ]
};

export const otherCollections = Object.keys(catalog).filter(x => !familySeries.includes(x));
