import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MANUAL_CHARACTERIZATION_PACKET_SIZE,
  PRE_MERGE_CHARACTERIZATION_COUNT,
  POST_MERGE_CHARACTERIZATION_COUNT,
  TARGETED_CHARACTERIZATION_PACKET_SIZE,
} from "./plasmon-flake-probe-policy.mjs";

const targetedPlaywrightTargets = new Set([
  "exact",
  "exact-set",
  "right-snap",
  "left-snap",
  "window-lifetime",
  "monaco",
  "emulatorjs",
  "saved-preview",
]);

export function packetSizeForProbe({ iteration_count, target, mode }) {
  if (!targetedPlaywrightTargets.has(target)) return 1;
  if (mode === "manual" && iteration_count === 50) {
    return MANUAL_CHARACTERIZATION_PACKET_SIZE;
  }
  if (mode === "characterization" && iteration_count === PRE_MERGE_CHARACTERIZATION_COUNT) {
    return PRE_MERGE_CHARACTERIZATION_COUNT;
  }
  if (iteration_count === POST_MERGE_CHARACTERIZATION_COUNT) {
    return TARGETED_CHARACTERIZATION_PACKET_SIZE;
  }
  return 1;
}

export function addProbePackets(include, config) {
  const packetSize = packetSizeForProbe(config);
  let packet = 0;
  for (let startIteration = 1; startIteration <= config.iteration_count; startIteration += packetSize) {
    packet += 1;
    const repetitions = Math.min(packetSize, config.iteration_count - startIteration + 1);
    include.push({
      ...config,
      packet,
      iteration: startIteration,
      start_iteration: startIteration,
      end_iteration: startIteration + repetitions - 1,
      repetitions,
      packet_size: packetSize,
    });
  }
}

export function buildProbeMatrix(env = process.env) {
  const include = [];
  if (env.PRIMARY_APPLICABLE === "true") {
    addProbePackets(include, {
      mode: env.PRIMARY_MODE,
      automatic_characterization: false,
      iteration_count: Number(env.PRIMARY_COUNT),
      target: env.PRIMARY_TARGET,
      test_file: env.PRIMARY_TEST_FILE ?? "",
      test_grep: env.PRIMARY_TEST_GREP ?? "",
      scope: env.PRIMARY_SCOPE,
      scope_key: env.PRIMARY_SCOPE_KEY,
    });
  }
  if (env.CHARACTERIZATION_APPLICABLE === "true") {
    addProbePackets(include, {
      mode: "characterization",
      automatic_characterization: true,
      iteration_count: Number(env.CHARACTERIZATION_COUNT),
      target: env.CHARACTERIZATION_TARGET,
      test_file: "",
      test_grep: "",
      scope: env.CHARACTERIZATION_SCOPE,
      scope_key: env.CHARACTERIZATION_SCOPE_KEY,
    });
  }
  return { include };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const outputIndex = process.argv.indexOf("--github-output");
  const outputPath = outputIndex === -1 ? null : outputIndex + 1 < process.argv.length ? process.argv[outputIndex + 1] : null;
  const line = `matrix=${JSON.stringify(buildProbeMatrix())}\n`;
  if (outputPath) appendFileSync(outputPath, line);
  else process.stdout.write(line);
}
