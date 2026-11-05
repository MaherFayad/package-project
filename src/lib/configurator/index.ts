/**
 * Configurator (owner: configuration + finishes). Pure TypeScript, shared by client and server.
 *
 *   const cfg = parseModelConfig(body);                 // zod-validated ModelConfig
 *   const ev = evaluateConfig(cfg, { artwork });        // options with ar/en reasons, issues
 *   const { config, removed } = sanitizeConfig(cfg);    // after a model / material change
 *   const req = toPricingRequest(cfg, { zone });        // -> quote(req.input, data) when req.instant
 *   vendorCanMake(cfg, vendor.capabilities, vendor.machines)
 *
 * 3D finishes (foil, spot UV, emboss masks) live in src/components/three/finishes.
 */
export * from "./catalog";
export * from "./schema";
export * from "./rules";
export * from "./pricing";
export * from "./defaults";
