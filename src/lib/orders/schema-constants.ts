import { PAYMENT_METHODS } from "@/types";
import type { DisputeReason } from "@/types";

export { PAYMENT_METHODS };
export const DISPUTE_REASONS_LIST = ["PRINT_DEFECT", "WRONG_ITEM", "LATE", "DAMAGED", "OTHER"] as const satisfies readonly DisputeReason[];
