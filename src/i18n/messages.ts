import { homeEn, homeRw, homeSw } from "./home";

export const LANGS = ["rw", "en", "sw"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABEL: Record<Lang, string> = {
  rw: "Kinyarwanda",
  en: "English",
  sw: "Kiswahili",
};

export const LOCALE: Record<Lang, string> = { rw: "rw", en: "en", sw: "sw" };

const en = {
  ...homeEn,
  "lang.label": "Language",

  "nav.personal": "Personal Use",
  "nav.business": "Business Use (coming soon)",
  "nav.providers": "Transport Providers",

  "offers.title": "What we move",
  "offers.sub": "Each service is priced by its own rule, shown up front. No account is needed to book.",
  "offers.book": "Book {name}",
  "offers.unsure_title": "Not sure which you need?",
  "offers.unsure_text": "Start a general booking and compare the price of every vehicle that can serve your route before you choose.",
  "offers.cta": "Book or order",

  "footer.about": "About Us",
  "footer.about_text": "TikTak Rwanda connects riders and senders with nearby taxi drivers for people and goods transport across Kigali, with live tracking and Mobile Money payments.",
  "footer.services": "Services",
  "footer.book_taxi": "Book a Taxi",
  "footer.parcel": "Parcel Delivery",
  "footer.large": "Large Item Delivery",
  "footer.truck": "Truck & Van Delivery",
  "footer.drive": "Drive with TikTak",
  "footer.quick": "Quick Links",
  "footer.home": "Home",
  "footer.how": "How It Works",
  "footer.faq": "FAQ",
  "footer.become": "Become a Driver",
  "footer.contact": "Contact Us",
  "footer.hours": "Daily: 6:00 AM - 11:00 PM",
  "footer.location": "Kigali, Rwanda",
};

export type MsgKey = keyof typeof en;
type Dict = Record<MsgKey, string>;

const rw: Dict = {
  ...homeRw,
  "lang.label": "Ururimi",

  "nav.personal": "Gukoresha bwite",
  "nav.business": "Ubucuruzi (buzaza vuba)",
  "nav.providers": "Abatanga serivisi z'ubwikorezi",

  "offers.title": "Ibyo dutwara",
  "offers.sub": "Buri serivisi ifite uko igiciro cyayo kibarwa, kigaragazwa mbere. Nta konti ikenewe kugira ngo utegure.",
  "offers.book": "Tegura {name}",
  "offers.unsure_title": "Ntuzi icyo ukeneye?",
  "offers.unsure_text": "Tangira gutegura muri rusange, ugereranye igiciro cy'ibinyabiziga byose bishobora gukora urugendo rwawe mbere yo guhitamo.",
  "offers.cta": "Tegura cyangwa Tumiza",

  "footer.about": "Abo turi bo",
  "footer.about_text": "TikTak Rwanda ihuza abagenzi n'abohereza ibintu n'abamotari n'abashoferi ba tagisi bari hafi, mu gutwara abantu n'ibintu muri Kigali, hamwe no gukurikirana urugendo kuri murandasi no kwishyura na Mobile Money.",
  "footer.services": "Serivisi",
  "footer.book_taxi": "Tegura Tagisi",
  "footer.parcel": "Kohereza Amapaki",
  "footer.large": "Kohereza Ibintu Binini",
  "footer.truck": "Kohereza n'Ikamyo cyangwa Van",
  "footer.drive": "Ba umushoferi wa TikTak",
  "footer.quick": "Amahuza y'ingenzi",
  "footer.home": "Ahabanza",
  "footer.how": "Uko bikora",
  "footer.faq": "Ibibazo bikunze kubazwa",
  "footer.become": "Iyandikishe nk'umushoferi",
  "footer.contact": "Twandikire",
  "footer.hours": "Buri munsi: 6:00 - 23:00",
  "footer.location": "Kigali, u Rwanda",
};

const sw: Dict = {
  ...homeSw,
  "lang.label": "Lugha",

  "nav.personal": "Matumizi Binafsi",
  "nav.business": "Matumizi ya Biashara (yanakuja hivi karibuni)",
  "nav.providers": "Watoa Huduma za Usafiri",

  "offers.title": "Tunachosafirisha",
  "offers.sub": "Kila huduma ina kanuni yake ya bei, inayoonyeshwa mapema. Hakuna akaunti inayohitajika kuweka nafasi.",
  "offers.book": "Weka nafasi ya {name}",
  "offers.unsure_title": "Huna uhakika unahitaji nini?",
  "offers.unsure_text": "Anza kuweka nafasi ya jumla, kisha linganisha bei ya kila gari linaloweza kuhudumia njia yako kabla ya kuchagua.",
  "offers.cta": "Weka nafasi au Agiza",

  "footer.about": "Kuhusu Sisi",
  "footer.about_text": "TikTak Rwanda inawaunganisha abiria na wasafirishaji na madereva wa teksi walio karibu kwa usafiri wa watu na mizigo kote Kigali, kukiwa na ufuatiliaji wa moja kwa moja na malipo ya Mobile Money.",
  "footer.services": "Huduma",
  "footer.book_taxi": "Weka Nafasi ya Teksi",
  "footer.parcel": "Uwasilishaji wa Vifurushi",
  "footer.large": "Uwasilishaji wa Vitu Vikubwa",
  "footer.truck": "Uwasilishaji kwa Lori na Van",
  "footer.drive": "Endesha na TikTak",
  "footer.quick": "Viungo vya Haraka",
  "footer.home": "Mwanzo",
  "footer.how": "Jinsi Inavyofanya Kazi",
  "footer.faq": "Maswali Yanayoulizwa Mara kwa Mara",
  "footer.become": "Kuwa Dereva",
  "footer.contact": "Wasiliana Nasi",
  "footer.hours": "Kila siku: 6:00 asubuhi - 11:00 usiku",
  "footer.location": "Kigali, Rwanda",
};

export const dictionaries: Record<Lang, Dict> = { en, rw, sw };