/** What the AI reader saw on the photo. Every field is optional because receipts vary. */
export interface InvoiceExtraction {
  isTaxInvoice: boolean;
  sellerName: string | null;
  sellerVat: string | null;
  invoiceNumber: string | null;
  issuedAt: string | null;
  total: number | null;
  vat: number | null;
  currency: string | null;
  paintLineItems: number | null;
  editingSuspected: boolean;
  notes: string | null;
  model: string;
}
