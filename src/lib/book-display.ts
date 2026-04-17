type BookType = "KINDLE" | "AUDIBLE" | "TECHNICAL";
type Owner = "tverkon" | "dverkon";

const TYPE_LABEL: Record<BookType, string> = {
  KINDLE: "Kindle",
  AUDIBLE: "Audible",
  TECHNICAL: "Technical",
};

const TYPE_BADGE: Record<BookType, string> = {
  KINDLE: "bg-blue-100 text-blue-700",
  AUDIBLE: "bg-orange-100 text-orange-700",
  TECHNICAL: "bg-emerald-100 text-emerald-700",
};

const TYPE_CARD_BG: Record<BookType, string> = {
  KINDLE: "bg-card-kindle",
  AUDIBLE: "bg-card-audible",
  TECHNICAL: "bg-card-technical",
};

const OWNER_LABEL: Record<Owner, string> = {
  tverkon: "Tom",
  dverkon: "Denise",
};

function isBookType(v: string): v is BookType {
  return v === "KINDLE" || v === "AUDIBLE" || v === "TECHNICAL";
}

function isOwner(v: string): v is Owner {
  return v === "tverkon" || v === "dverkon";
}

export function typeLabel(v: string): string {
  return isBookType(v) ? TYPE_LABEL[v] : v;
}

export function typeBadgeClass(v: string): string {
  return isBookType(v) ? TYPE_BADGE[v] : "bg-gray-100 text-gray-700";
}

export function typeCardBgClass(v: string): string {
  return isBookType(v) ? TYPE_CARD_BG[v] : "bg-white";
}

export function ownerLabel(v: string): string {
  return isOwner(v) ? OWNER_LABEL[v] : v;
}
