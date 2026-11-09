import { afterEach, describe, expect, it, vi } from "vitest";
import { devFlag, devPagesEnabled, isDemoSite, isRealDeployment, otpDevEcho, otpIpLimits, resetDevFlagWarning } from "@/lib/env";
import { mockPaymentsEnabled } from "@/lib/payments/config";

const E2E = { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3100", OTP_DEV_ECHO: "1", ALLOW_MOCK_PAYMENTS: "1", ELBA_E2E: "1" };
const REAL = { ...E2E, NEXT_PUBLIC_SITE_URL: "https://elba.example", ELBA_DEV_PAGES: "1" };

describe("dev-only flags are ignored on a real (https) deployment", () => {
  afterEach(() => {
    resetDevFlagWarning();
    vi.restoreAllMocks();
  });

  it("detects a real deployment from an https:// site URL only", () => {
    expect(isRealDeployment({ NEXT_PUBLIC_SITE_URL: "https://elba.example" })).toBe(true);
    expect(isRealDeployment({ NEXT_PUBLIC_SITE_URL: "http://localhost:3100" })).toBe(false);
    expect(isRealDeployment({})).toBe(false);
  });

  it("keeps the flags working for e2e and local runs on http://localhost", () => {
    expect(otpDevEcho(E2E)).toBe(true);
    expect(mockPaymentsEnabled(E2E)).toBe(true);
    expect(devPagesEnabled(E2E)).toBe(true);
    expect(otpIpLimits(E2E).requestPerHour).toBe(5_000);
  });

  it("turns every flag off on https and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(otpDevEcho(REAL)).toBe(false);
    expect(mockPaymentsEnabled(REAL)).toBe(false);
    expect(devPagesEnabled(REAL)).toBe(false);
    expect(otpIpLimits(REAL).requestPerHour).toBe(20);
    expect(devFlag("ELBA_E2E", REAL)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("OTP_DEV_ECHO, ALLOW_MOCK_PAYMENTS, ELBA_E2E, ELBA_DEV_PAGES");
  });

  it("does not warn when no flag is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(otpDevEcho({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://elba.example" })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("demo site (ELBA_DEMO_SITE=1 on a *.workers.dev address)", () => {
  const DEMO = { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://elba-demo.someone.workers.dev", ELBA_DEMO_SITE: "1", OTP_DEV_ECHO: "1", ALLOW_MOCK_PAYMENTS: "1", ELBA_E2E: "1", ELBA_DEV_PAGES: "1" };
  afterEach(() => {
    resetDevFlagWarning();
    vi.restoreAllMocks();
  });

  it("keeps on-screen sign-in codes and the fake gateway, nothing else", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(isDemoSite(DEMO)).toBe(true);
    expect(otpDevEcho(DEMO)).toBe(true);
    expect(mockPaymentsEnabled(DEMO)).toBe(true);
    expect(devPagesEnabled(DEMO)).toBe(false);
    expect(otpIpLimits(DEMO).requestPerHour).toBe(20);
  });

  it("never applies on a custom domain, without the flag, or on a look-alike host", () => {
    for (const url of ["https://elba.eg", "https://workers.dev.elba.eg", "http://x.workers.dev", "not a url"]) {
      expect(isDemoSite({ ...DEMO, NEXT_PUBLIC_SITE_URL: url })).toBe(false);
    }
    expect(isDemoSite({ ...DEMO, ELBA_DEMO_SITE: undefined })).toBe(false);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(otpDevEcho({ ...DEMO, NEXT_PUBLIC_SITE_URL: "https://elba.eg" })).toBe(false);
    expect(mockPaymentsEnabled({ ...DEMO, NEXT_PUBLIC_SITE_URL: "https://elba.eg" })).toBe(false);
  });
});
