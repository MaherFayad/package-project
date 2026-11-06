// Dump the model library (code, source, kind, group, standard, defaults) as JSON for the capture harness.
import { MODELS } from "@/lib/library";
const out = MODELS.map((m) =>
  m.kind === "box"
    ? { kind: m.kind, source: m.source, group: m.group, code: m.code, slug: m.slug, standard: m.standard, name: m.name.en, shape: m.shape, fidelity: m.fidelity, materials: m.materials, dims: m.defaultDims }
    : { kind: m.kind, source: m.source, group: m.group, code: m.code, slug: m.slug, standard: m.standard, name: m.name.en, render: m.render, coreKind: m.coreKind, containers: m.containers.map((c) => c.code), closures: m.closures.map((c) => c.code), surfaces: m.surfaces },
);
console.log(JSON.stringify(out));
