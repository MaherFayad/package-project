/**
 * Company invoice details entered at checkout (B-13). Egyptian Tax Authority registration
 * numbers (RIN, "رقم التسجيل الضريبي") are 9 digits, often written 123-456-789. Arabic-Indic
 * digits are accepted. The commercial register number is free text (office + number).
 */
export interface CompanyInvoice {
  name: string;
  taxId: string;
  commercialRegister: string;
}

export function normalizeTaxId(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\s\-–.]/g, "");
}

export function isValidTaxId(raw: string): boolean {
  return /^\d{9}$/.test(normalizeTaxId(raw));
}

/** Display form: 123-456-789. */
export function formatTaxId(raw: string): string {
  const d = normalizeTaxId(raw);
  return /^\d{9}$/.test(d) ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : raw;
}
