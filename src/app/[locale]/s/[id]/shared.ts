import { cache } from "react";
import { loadSharedDesign } from "@/components/designer/server";

/** One share-token lookup per request, shared by the [id] layout guard, metadata and the page (R5-PL-26). */
export const getShared = cache((token: string) => loadSharedDesign(token));
