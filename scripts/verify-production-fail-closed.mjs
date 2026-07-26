#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const moduleSource = await readFile(
  new URL("../lib/runtime-config.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(moduleSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function loadPolicy(environment) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    process: { env: environment },
    URL,
    Error,
  });
  return module.exports;
}

function evaluate(environment) {
  return loadPolicy(environment).evaluateRuntimeConfig(environment);
}

const productionMissing = evaluate({
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_ALLOW_DEMO_DATA: "false",
});
assert(productionMissing.configurationError, "Production must reject a missing API URL.");
assert(!productionMissing.demoDataEnabled, "Production must not enable demo data.");

const productionDemo = evaluate({
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_API_URL: "https://example.test/api",
  EXPO_PUBLIC_ALLOW_DEMO_DATA: "true",
});
assert(productionDemo.configurationError, "Production must reject an enabled demo flag.");
assert(!productionDemo.demoDataEnabled, "Production demo data must remain disabled.");

const productionHttp = evaluate({
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_API_URL: "http://example.test/api",
  EXPO_PUBLIC_ALLOW_DEMO_DATA: "false",
});
assert(productionHttp.configurationError, "Production must reject a non-HTTPS API URL.");

const productionValid = evaluate({
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_API_URL: "https://example.test/api/",
  EXPO_PUBLIC_ALLOW_DEMO_DATA: "false",
});
assert(!productionValid.configurationError, "Valid production configuration was rejected.");
assert(productionValid.apiUrl === "https://example.test/api", "API URL was not normalized.");
assert(!productionValid.demoDataEnabled, "Valid production unexpectedly enabled demo data.");

const previewImplicit = evaluate({
  EXPO_PUBLIC_APP_ENV: "preview",
  EXPO_PUBLIC_ALLOW_DEMO_DATA: "false",
});
assert(previewImplicit.configurationError, "Preview must not enable fixtures implicitly.");
assert(!previewImplicit.demoDataEnabled, "Preview fixtures require explicit opt-in.");

const previewExplicit = evaluate({
  EXPO_PUBLIC_APP_ENV: "preview",
  EXPO_PUBLIC_ALLOW_DEMO_DATA: "true",
});
assert(!previewExplicit.configurationError, "Explicit preview mode should be valid.");
assert(previewExplicit.demoDataEnabled, "Explicit preview mode did not enable fixtures.");

const eas = JSON.parse(await readFile(new URL("../eas.json", import.meta.url), "utf8"));
for (const profileName of ["private-beta", "production"]) {
  const env = eas.build?.[profileName]?.env ?? {};
  const result = evaluate(env);
  assert(!result.configurationError, `${profileName} EAS configuration is invalid.`);
  assert(!result.demoDataEnabled, `${profileName} EAS profile permits demo data.`);
  assert(result.isProduction, `${profileName} EAS profile is not production.`);
}

const preview = evaluate(eas.build?.preview?.env ?? {});
assert(preview.demoDataEnabled, "The preview EAS profile must opt in to demo data.");

const hooks = await readFile(new URL("../hooks/use-vedic-data.ts", import.meta.url), "utf8");
assert(
  !hooks.includes("!isApiConfigured ||"),
  "Fixture fallback still activates implicitly when the API URL is missing.",
);
assert(
  hooks.includes("runtimeConfig.demoDataEnabled"),
  "Fixture fallback is not controlled by the central runtime policy.",
);

const provider = await readFile(
  new URL("../providers/app-provider.tsx", import.meta.url),
  "utf8",
);
assert(
  provider.includes("requirePreviewMode();"),
  "Local OTP/profile/trial paths are not guarded by explicit preview mode.",
);
assert(
  provider.includes('savedToken?.startsWith("local.")') &&
    provider.includes("!runtimeConfig.demoDataEnabled"),
  "A production-like build can restore a synthetic local preview identity.",
);

console.log("Production fail-closed policy: PASS");
console.log("Production and private beta: HTTPS API required; demo data denied");
console.log("Preview: demo data requires explicit opt-in");
