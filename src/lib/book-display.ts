type BookType = "KINDLE" | "AUDIBLE" | "TECHNICAL";
type Owner = "tverkon" | "dverkon";

const TYPE_LABEL: Record<BookType, string> = {
  KINDLE: "Kindle",
  AUDIBLE: "Audible",
  TECHNICAL: "Technical",
};

const TYPE_BADGE: Record<BookType, string> = {
  KINDLE: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  AUDIBLE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  TECHNICAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
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
  return isBookType(v) ? TYPE_BADGE[v] : "bg-muted text-muted-foreground";
}

export function typeCardBgClass(v: string): string {
  return isBookType(v) ? TYPE_CARD_BG[v] : "bg-card";
}

export function ownerLabel(v: string): string {
  return isOwner(v) ? OWNER_LABEL[v] : v;
}
