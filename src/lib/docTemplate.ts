/**
 * Receipt / invoice template engine. The code lives in supabase/functions/_shared so the edge function (which validates
 * designs and generates the stored CSS) and the browser (designer preview, receipt and invoice pages) run the SAME code.
 */
export * from "../../supabase/functions/_shared/docTemplate.ts";
