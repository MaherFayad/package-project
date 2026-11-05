"use client";

import {
  Amphora,
  Archive,
  Camera,
  CupSoda,
  FlaskConical,
  GlassWater,
  Milk,
  Pause,
  Pipette,
  Play,
  RotateCcw,
  ShoppingBag,
  SprayCan,
  TestTube,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLOSURE_COLORS,
  CLOSURE_NAMES,
  LABEL_FINISHES,
  LABEL_STOCKS,
  LIQUIDS,
  VESSELS,
  VESSEL_KINDS,
  VESSEL_MATERIALS,
  describeVessel,
  finishesForStock,
  labelRun,
  labelSvg,
  presetFor,
  type ClosureColorCode,
  type ClosureKind,
  type LabelFinishCode,
  type LabelSpec,
  type LabelStockCode,
  type LiquidCode,
  type PrintSurfaceKind,
  type VesselDims,
  type VesselKind,
  type VesselMaterialCode,
} from "@/lib/vessels";
import { ViewControls, VesselSceneLazy, paintLabel, type LabelArtStyle, type VesselLabel, type VesselQuality, type VesselSceneHandle } from "@/components/three";
import { downloadBlob } from "@/components/three/screenshot";
import { Badge, Banner, BlockStack, Button, ButtonGroup, Card, Checkbox, InlineStack, MetricsStrip, RangeSlider, Select, Tabs, Text } from "@/components/ui";
import styles from "./vessels.module.css";

const ICONS: Record<VesselKind, LucideIcon> = {
  ROUND_BOTTLE: GlassWater,
  BOSTON_ROUND: FlaskConical,
  DROPPER_BOTTLE: Pipette,
  PUMP_BOTTLE: Milk,
  PERFUME_SQUARE: SprayCan,
  WIDE_JAR: Amphora,
  CAN: CupSoda,
  ROUND_TIN: Archive,
  STAND_UP_POUCH: ShoppingBag,
  SQUEEZE_TUBE: TestTube,
};

const SURFACE_LABEL: Record<PrintSurfaceKind, string> = {
  WRAP: "Wrap-around",
  FRONT: "Front",
  BACK: "Back",
  SHRINK_SLEEVE: "Shrink sleeve",
  NECK: "Neck",
  LID: "Lid",
};

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("en-US");

function resolveFont() {
  if (typeof document === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
  return v ? `${v}, system-ui, sans-serif` : "Inter, system-ui, sans-serif";
}

interface SurfaceChoice {
  stock: LabelStockCode;
  finish: LabelFinishCode;
}

function warningText(w: string): string {
  const [code, value] = w.split(":");
  switch (code) {
    case "sleeve.shrinkTooHigh":
      return `This sleeve must shrink ${value}% at its narrowest point. PETG is reliable up to 70%: end the sleeve lower on the neck, or choose a wrap label.`;
    case "sleeve.distortionZone":
      return `The sleeve shrinks ${value}% at the neck. Keep text and logos away from that zone, or turn on pre-distortion.`;
    case "wrap.tooShortUnderLid":
      return `The lid skirt (${value} mm) covers most of the wall. Use a lid label, or a taller tin.`;
    default:
      return w;
  }
}

/** Swatch radio group (single pointer, keyboard: arrows move within the group). */
function Swatches<T extends string>({ legend, name, options, value, onChange }: { legend: string; name: string; options: { value: T; hex: string; label: string; metal?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset className={styles.swatches}>
      <legend className={styles.legend}>
        {legend} <span className={styles.legendValue}>{options.find((o) => o.value === value)?.label}</span>
      </legend>
      <div className={styles.swatchRow}>
        {options.map((o) => (
          <label key={o.value} className={styles.swatch} title={o.label}>
            <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span className={styles.swatchDot} data-metal={o.metal ? "" : undefined} style={{ ["--swatch" as string]: o.hex }} aria-hidden="true" />
            <span className={styles.srOnly}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function VesselsDevSection() {
  const [kind, setKind] = useState<VesselKind>("WIDE_JAR");
  const def = VESSELS[kind];
  const [presetId, setPresetId] = useState(def.defaultPresetId);
  const preset = presetFor(kind, presetId);
  const [dims, setDims] = useState<VesselDims>(preset.dims);
  const [material, setMaterial] = useState<VesselMaterialCode>(def.defaultMaterial);
  const [closure, setClosure] = useState<ClosureKind>(def.defaultClosure);
  const [closureColor, setClosureColor] = useState<ClosureColorCode>("GOLD");
  const [liquid, setLiquid] = useState<LiquidCode>(def.defaultLiquid);
  const [fill, setFill] = useState(def.defaultFill);
  const [surfaces, setSurfaces] = useState<PrintSurfaceKind[]>(def.defaultSurfaces);
  const [choices, setChoices] = useState<Partial<Record<PrintSurfaceKind, SurfaceChoice>>>({});
  const [style, setStyle] = useState<LabelArtStyle>("sample");
  const [preDistort, setPreDistort] = useState(true);
  const [open, setOpen] = useState(false);
  const [turntable, setTurntable] = useState(true);
  const [quality, setQuality] = useState<VesselQuality | "auto">("auto");
  const [tab, setTab] = useState(0);
  const [replay, setReplay] = useState(0);
  const viewRef = useRef<VesselSceneHandle>(null);

  const selectKind = (k: VesselKind) => {
    const d = VESSELS[k];
    setKind(k);
    setPresetId(d.defaultPresetId);
    setDims(presetFor(k).dims);
    setMaterial(d.defaultMaterial);
    setClosure(d.defaultClosure);
    setLiquid(d.defaultLiquid);
    setFill(d.defaultFill);
    setSurfaces(d.defaultSurfaces);
    setOpen(false);
    setTab(0);
    setClosureColor(k === "PERFUME_SQUARE" || k === "WIDE_JAR" ? "GOLD" : k === "ROUND_BOTTLE" ? "BLUE" : k === "CAN" ? "SILVER" : k === "ROUND_TIN" ? "SILVER" : "WHITE");
  };
  const selectPreset = (id: string) => {
    setPresetId(id);
    setDims(presetFor(kind, id).dims);
  };

  const description = useMemo(() => describeVessel({ kind, dims, neck: preset.neck, surfaces }), [kind, dims, preset.neck, surfaces]);
  const specs = description.labels;
  const choiceFor = (spec: LabelSpec): SurfaceChoice => {
    const c = choices[spec.kind];
    if (c && spec.stocks.includes(c.stock)) return c;
    return { stock: spec.defaultStock, finish: spec.kind === "SHRINK_SLEEVE" ? "NONE" : "GLOSS_VARNISH" };
  };

  // one canvas per print surface, painted in flat print space
  const canvases = useRef(new Map<string, HTMLCanvasElement>());
  const [artVersion, setArtVersion] = useState(0);
  const [painted, setPainted] = useState<VesselLabel[]>([]);
  useEffect(() => {
    const font = resolveFont();
    const next: VesselLabel[] = specs.map((spec) => {
      let c = canvases.current.get(spec.id);
      if (!c) {
        c = document.createElement("canvas");
        canvases.current.set(spec.id, c);
      }
      const ch = choiceFor(spec);
      paintLabel(c, spec, { style, kind, transparent: LABEL_STOCKS[ch.stock].transparent && spec.kind !== "SHRINK_SLEEVE", preDistort, font, maxPx: 2048 });
      return { spec, canvas: c, stock: ch.stock, finish: ch.finish };
    });
    setPainted(next);
    setArtVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs, style, preDistort, kind, JSON.stringify(choices)]);

  // mount three.js only when the section scrolls into view
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const toggleSurface = (s: PrintSurfaceKind, on: boolean) => {
    setSurfaces((cur) => {
      let next = on ? [...cur, s] : cur.filter((x) => x !== s);
      // a sleeve and a wrap label cannot share the same wall
      if (on && s === "SHRINK_SLEEVE") next = next.filter((x) => x === "SHRINK_SLEEVE" || x === "LID");
      if (on && (s === "WRAP" || s === "FRONT" || s === "BACK" || s === "NECK")) next = next.filter((x) => x !== "SHRINK_SLEEVE");
      if (on && s === "WRAP") next = next.filter((x) => x !== "FRONT" && x !== "BACK");
      if (on && (s === "FRONT" || s === "BACK")) next = next.filter((x) => x !== "WRAP");
      return def.surfaces.filter((x) => next.includes(x));
    });
    setTab(0);
  };

  const screenshot = async () => {
    const blob = await viewRef.current?.screenshot({ width: 2048, height: 2048 });
    if (blob) downloadBlob(blob, `elba-${kind.toLowerCase()}-${presetId}.png`);
  };

  const limits = def.limits;
  const activeSpec = specs[Math.min(tab, Math.max(0, specs.length - 1))];
  const hasSleeve = specs.some((s) => s.kind === "SHRINK_SLEEVE");
  const canOpen = !["ZIP_SEAL", "FLIP_TOP", "SCREW_TUBE_CAP"].includes(closure);
  const transparent = VESSEL_MATERIALS[material].transparent;
  const env = description.envelope;

  // picture of the painted artwork for the flat template preview
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const activeId = activeSpec?.id;
  useEffect(() => {
    const c = activeId ? canvases.current.get(activeId) : undefined;
    setArtUrl(c && c.width > 2 ? c.toDataURL("image/png") : null);
  }, [artVersion, activeId]);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="vessels-title">
      <header className={styles.header}>
        <div>
          <Text as="h2" variant="headingLg" id="vessels-title">
            Bottles, jars and labels
          </Text>
          <Text as="p" tone="subdued">
            Parametric containers from real catalogue sizes. Every label, sleeve and lid label is a flat print area in mm with bleed and safe zone, mapped onto the 3D model without distortion.
          </Text>
        </div>
        <InlineStack gap="200" wrap>
          <Badge tone="info">{`${VESSEL_KINDS.length} containers`}</Badge>
          <Badge tone="success">Print-accurate UVs</Badge>
        </InlineStack>
      </header>

      <div className={styles.kinds} role="group" aria-label="Container">
        {VESSEL_KINDS.map((k) => {
          const Icon = ICONS[k];
          const d = VESSELS[k];
          const caps = d.presets.map((p) => p.name.en).join(" · ");
          return (
            <button key={k} type="button" className={styles.kind} aria-pressed={k === kind} onClick={() => selectKind(k)}>
              <span className={styles.kindIcon} aria-hidden="true">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <span className={styles.kindName}>{d.name.en}</span>
              <span className={styles.kindMeta}>{caps}</span>
            </button>
          );
        })}
      </div>

      <MetricsStrip
        accessibilityLabel="Container summary"
        metrics={[
          { label: "Brimful", value: description.brimfulMl ? `${fmt(description.brimfulMl, 0)} ml` : "n/a", trend: `nominal ${preset.capacityMl} ml` },
          { label: "Envelope", value: `${fmt(env.width)} × ${fmt(env.depth)} × ${fmt(env.height)} mm`, trend: "box inner size" },
          { label: "Neck finish", value: preset.neck?.code ?? (kind === "STAND_UP_POUCH" ? "Zip seal" : kind === "SQUEEZE_TUBE" ? "Tube nozzle" : "Slip lid") },
          { label: "Print surfaces", value: `${specs.length}`, trend: specs.map((s) => SURFACE_LABEL[s.kind]).join(", ") || "none" },
        ]}
      />

      <div className={styles.layout}>
        <div className={styles.stageCol}>
          <div className={styles.stage} data-kind={kind}>
            {visible ? (
              <VesselSceneLazy
                kind={kind}
                dims={dims}
                profile={description.profile}
                envelope={env}
                material={material}
                closure={closure}
                closureColor={closureColor}
                liquid={liquid}
                fill={fill}
                labels={painted.filter((l) => specs.includes(l.spec))}
                artworkVersion={artVersion}
                quality={quality}
                open={open}
                turntable={turntable}
                replayKey={`${kind}:${presetId}:${replay}`}
                handleRef={viewRef}
                onInteract={() => setTurntable(false)}
                ariaLabel={`3D preview: ${def.name.en}, ${preset.name.en}`}
              />
            ) : (
              <div className={styles.placeholder} aria-hidden="true" />
            )}
            <div className={styles.hudTop}>
              <span key={`${kind}-${presetId}`} className={styles.hudTitle}>
                <strong>{def.name.en}</strong>
                <span>
                  {preset.name.en} · {VESSEL_MATERIALS[material].name.en}
                </span>
              </span>
              <div className={styles.hudActions}>
                {canOpen ? (
                  <Button size="slim" pressed={open} onClick={() => setOpen((o) => !o)}>
                    {open ? "Close" : "Open"}
                  </Button>
                ) : null}
                <Button size="slim" icon={turntable ? Pause : Play} accessibilityLabel={turntable ? "Stop turntable" : "Start turntable"} onClick={() => setTurntable((t) => !t)} />
                <Button size="slim" icon={RotateCcw} accessibilityLabel="Replay animations" onClick={() => setReplay((r) => r + 1)} />
                <Button size="slim" icon={Camera} accessibilityLabel="Download PNG 2048 × 2048" onClick={screenshot} />
              </div>
            </div>
            <div className={styles.hudBottom}>
              <ViewControls handle={viewRef} />
            </div>
          </div>
        </div>

        <div className={styles.side}>
          <Card title="Size">
            <BlockStack gap="300">
              <div className={styles.segmented} role="radiogroup" aria-label="Preset size">
                {def.presets.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p.id === presetId} className={styles.segment} onClick={() => selectPreset(p.id)}>
                    {p.name.en}
                  </button>
                ))}
              </div>
              <Text as="p" variant="bodySm" tone="subdued">
                {preset.source}
              </Text>
              <RangeSlider label={kind === "STAND_UP_POUCH" ? "Width" : kind === "PERFUME_SQUARE" ? "Width" : "Diameter"} value={dims.D} min={limits.D.min} max={limits.D.max} step={0.5} output suffix="mm" onChange={(v) => setDims({ ...dims, D: v })} />
              <RangeSlider label={kind === "SQUEEZE_TUBE" ? "Length" : "Height"} value={dims.H} min={limits.H.min} max={limits.H.max} step={0.5} output suffix="mm" onChange={(v) => setDims({ ...dims, H: v })} />
              {limits.G ? (
                <RangeSlider label={kind === "STAND_UP_POUCH" ? "Bottom gusset" : "Depth"} value={dims.G ?? dims.D} min={limits.G.min} max={limits.G.max} step={0.5} output suffix="mm" onChange={(v) => setDims({ ...dims, G: v })} />
              ) : null}
              {limits.taper ? <RangeSlider label="Taper" value={dims.taper ?? 0} min={limits.taper.min} max={limits.taper.max} step={0.5} output suffix="mm" onChange={(v) => setDims({ ...dims, taper: v })} /> : null}
            </BlockStack>
          </Card>

          <Card title="Container">
            <BlockStack gap="300">
              <Select label="Material" options={def.materials.map((m) => ({ value: m, label: VESSEL_MATERIALS[m].name.en }))} value={material} onChange={(v) => setMaterial(v as VesselMaterialCode)} />
              {def.closures.length > 1 ? (
                <Select label="Closure" options={def.closures.map((c) => ({ value: c, label: CLOSURE_NAMES[c].en }))} value={closure} onChange={(v) => setClosure(v as ClosureKind)} />
              ) : (
                <Text as="p" variant="bodySm" tone="subdued">
                  {`Closure: ${CLOSURE_NAMES[closure].en}`}
                </Text>
              )}
              {closure !== "ZIP_SEAL" ? (
                <Swatches
                  legend="Closure colour"
                  name="closure-colour"
                  value={closureColor}
                  onChange={setClosureColor}
                  options={(Object.keys(CLOSURE_COLORS) as ClosureColorCode[]).map((c) => ({ value: c, hex: CLOSURE_COLORS[c].hex, label: CLOSURE_COLORS[c].name.en, metal: CLOSURE_COLORS[c].metal }))}
                />
              ) : null}
            </BlockStack>
          </Card>

          {def.fillable && transparent ? (
            <Card title="Product">
              <BlockStack gap="300">
                <Swatches
                  legend="Fill"
                  name="liquid"
                  value={liquid}
                  onChange={setLiquid}
                  options={(Object.keys(LIQUIDS) as LiquidCode[]).map((l) => ({ value: l, hex: LIQUIDS[l].hex, label: LIQUIDS[l].name.en }))}
                />
                <RangeSlider label="Fill level" value={Math.round(fill * 100)} min={0} max={100} step={1} output suffix="%" onChange={(v) => setFill(v / 100)} />
              </BlockStack>
            </Card>
          ) : null}

          <Card title="Print surfaces">
            <BlockStack gap="200">
              {def.surfaces.map((s) => (
                <Checkbox key={s} label={SURFACE_LABEL[s]} checked={surfaces.includes(s)} onChange={(on) => toggleSurface(s, on)} />
              ))}
              <div className={styles.divider} />
              <div className={styles.segmented} role="radiogroup" aria-label="Artwork">
                {(["sample", "guides"] as const).map((st) => (
                  <button key={st} type="button" role="radio" aria-checked={style === st} className={styles.segment} onClick={() => setStyle(st)}>
                    {st === "sample" ? "Sample artwork" : "Print guides"}
                  </button>
                ))}
              </div>
              {hasSleeve ? <Checkbox label="Pre-distort sleeve artwork" helpText="Stretches artwork where the sleeve shrinks, so it looks right on the bottle." checked={preDistort} onChange={setPreDistort} /> : null}
              <Select
                label="Render quality"
                options={[
                  { value: "auto", label: "Auto (low on phones)" },
                  { value: "high", label: "High: glass transmission" },
                  { value: "low", label: "Low: mobile fallback" },
                ]}
                value={quality}
                onChange={(v) => setQuality(v as VesselQuality | "auto")}
              />
            </BlockStack>
          </Card>
        </div>
      </div>

      {specs.length && activeSpec ? (
        <Card title="Print areas">
          <Tabs tabs={specs.map((s) => ({ id: `spec-${s.id}`, content: SURFACE_LABEL[s.kind] }))} selected={Math.min(tab, specs.length - 1)} onSelect={setTab}>
            <SpecPanel key={activeSpec.id} spec={activeSpec} artUrl={artUrl} choice={choiceFor(activeSpec)} onChoice={(c) => setChoices((cur) => ({ ...cur, [activeSpec.kind]: c }))} />
          </Tabs>
        </Card>
      ) : (
        <Card>
          <Text as="p" tone="subdued">
            No print surface selected. Pick one under Print surfaces.
          </Text>
        </Card>
      )}
    </section>
  );
}

function SpecPanel({ spec, artUrl, choice, onChoice }: { spec: LabelSpec; artUrl: string | null; choice: SurfaceChoice; onChoice: (c: SurfaceChoice) => void }) {
  const svg = useMemo(() => labelSvg(spec, { title: `${spec.name.en} template`, overlay: !!artUrl }), [spec, artUrl]);
  const runs = [1000, 5000, 10000].map((q) => ({ q, run: labelRun(spec, q) }));
  const finishes = finishesForStock(choice.stock);
  const rows: [string, string][] = [
    ["Shape", spec.shape === "sector" ? "Arc (cone frustum, unrolled)" : spec.shape === "circle" ? "Circle" : "Rectangle"],
    ["Trim size", `${fmt(spec.trimWidthMm)} × ${fmt(spec.trimHeightMm)} mm`],
    ["Print size (with bleed)", `${fmt(spec.printWidthMm)} × ${fmt(spec.printHeightMm)} mm`],
    ["Bleed / safe zone", `${spec.bleedMm} mm / ${spec.safeMm} mm`],
    ["Label area", `${fmt(spec.trimAreaM2 * 1e4, 2)} cm²`],
  ];
  if (spec.overlapMm && spec.kind === "WRAP") rows.push(["Overlap", `${spec.overlapMm} mm`]);
  if (spec.sector) rows.push(["Arc radii", `${fmt(spec.sector.innerRadiusMm)} / ${fmt(spec.sector.outerRadiusMm)} mm, ${fmt((spec.sector.angle * 180) / Math.PI)}°`]);
  if (spec.sleeve)
    rows.push(
      ["Lay-flat width", `${fmt(spec.sleeve.layFlatMm)} mm`],
      ["Cut height", `${fmt(spec.sleeve.cutHeightMm)} mm`],
      ["Seam", `${spec.sleeve.seamMm} mm`],
      ["Max. shrink", `${fmt(spec.sleeve.maxShrink * 100, 0)}% (PETG limit 70%)`],
    );
  return (
    <div className={styles.spec}>
      <div className={styles.template}>
        <div className={styles.templateSvg}>
          <div className={styles.templateArt} style={{ aspectRatio: `${spec.printWidthMm} / ${spec.printHeightMm}` }}>
            {artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artUrl} alt="" className={styles.templateImg} />
            ) : null}
            <div className={styles.templateGuides} dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </div>
        <p className={styles.templateLegend}>
          <span className={styles.keyTrim} /> Trim <span className={styles.keyBleed} /> Bleed <span className={styles.keySafe} /> Safe zone
          {spec.overlapMm ? (
            <>
              <span className={styles.keyOverlap} /> {spec.kind === "SHRINK_SLEEVE" ? "Seam" : "Overlap"}
            </>
          ) : null}
        </p>
      </div>
      <BlockStack gap="400">
        {spec.warnings.map((w) => (
          <Banner key={w} tone="warning" inCard>
            {warningText(w)}
          </Banner>
        ))}
        <InlineStack gap="300" wrap>
          <div className={styles.grow}>
            <Select
              label="Label stock"
              options={spec.stocks.map((s) => ({ value: s, label: LABEL_STOCKS[s].name.en }))}
              value={choice.stock}
              helpText={LABEL_STOCKS[choice.stock].bestFor.en}
              onChange={(v) => {
                const stock = v as LabelStockCode;
                const fs = finishesForStock(stock);
                onChoice({ stock, finish: fs.includes(choice.finish) ? choice.finish : "NONE" });
              }}
            />
          </div>
          <div className={styles.grow}>
            <Select label="Finish" options={finishes.map((f) => ({ value: f, label: LABEL_FINISHES[f].name.en }))} value={finishes.includes(choice.finish) ? choice.finish : "NONE"} onChange={(v) => onChoice({ ...choice, finish: v as LabelFinishCode })} />
          </div>
        </InlineStack>
        <dl className={styles.specList}>
          {rows.map(([k, v]) => (
            <div key={k} className={styles.specRow}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.runs}>
          <Text as="h3" variant="headingSm">
            Roll run on a 330 mm web
          </Text>
          <table className={styles.runTable}>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Across</th>
                <th scope="col">Labels / m</th>
                <th scope="col">Linear m</th>
                <th scope="col">Stock m²</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(({ q, run }) => (
                <tr key={q}>
                  <td>{q.toLocaleString("en-US")}</td>
                  <td>{run.fits ? run.across : "Too wide"}</td>
                  <td>{run.fits ? fmt(run.labelsPerMeter) : "n/a"}</td>
                  <td>{run.fits ? run.linearMeters.toLocaleString("en-US") : "n/a"}</td>
                  <td>{run.fits ? fmt(run.stockAreaM2, 2) : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Text as="p" variant="bodySm" tone="subdued">
            {`Die: ${runs[0].run.die === "CUSTOM" ? "custom shape" : runs[0].run.die === "STOCK_ROUND" ? "standard round" : runs[0].run.die === "NONE" ? "none (sleeve cut from tube)" : "standard rectangle"}. Includes 40 m make-ready (sleeves 60 m) and 4% running waste.`}
          </Text>
        </div>
        <ButtonGroup>
          <Button
            size="slim"
            onClick={() => {
              const blob = new Blob([labelSvg(spec, { title: spec.name.en })], { type: "image/svg+xml" });
              downloadBlob(blob, `elba-${spec.id}-template.svg`);
            }}
          >
            Download SVG template
          </Button>
        </ButtonGroup>
      </BlockStack>
    </div>
  );
}
