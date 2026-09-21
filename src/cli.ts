#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import { configSchema } from "./config/schema.js";
import { runFuzz } from "./index.js";
import { setSeed, getCurrentSeed } from "./runner/rng.js";
import { saveBaseline, loadBaseline, diffResults } from "./reporter/diff.js";
import { configFromOpenApi } from "./openapi/fromOpenApi.js";
import { generateConfigFromSpec } from "./ai-assist/generateConfigFromSpec.js";
import { summarizeFailures } from "./ai-assist/summarizeFailures.js";
import { AiAssistDisabledError } from "./ai-assist/client.js";

// Interactively prompts for a secret value, masking each typed character
// with "*" so the key never lingers in terminal scrollback or a screen
// recording. Only works against a real TTY — callers must check
// process.stdin.isTTY first, since there's nothing to prompt in a
// non-interactive context (CI, piped input, etc.).
function promptForSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);

    let input = "";
    let done = false;
    // Raw-mode stdin can deliver several typed (or pasted) characters in a
    // single "data" event, not one byte per event — so each chunk is walked
    // character by character rather than treated as a single unit. Without
    // this, a paste of the whole key would only print one "*" total instead
    // of one per character.
    const onData = (chunk: string) => {
      if (done) return;
      const str = chunk.toString();
      for (const char of str) {
        switch (char) {
          case "\n":
          case "\r":
          case "\u0004": // Ctrl-D
            done = true;
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            stdout.write("\n");
            resolve(input.trim());
            return;
          case "\u0003": // Ctrl-C
            stdout.write("\n");
            process.exit(1);
            break;
          case "\u007f": // backspace
          case "\b":
            if (input.length > 0) {
              input = input.slice(0, -1);
              stdout.write("\b \b");
            }
            break;
          default:
            input += char;
            stdout.write("*");
            break;
        }
      }
    };

    stdin.on("data", onData);
  });
}

// AI-assist config drafting is mandatory once --ai is chosen — rather than
// failing when GEMINI_API_KEY isn't set, prompt for it right here so the
// command still completes in one shot. Only usable interactively; in a
// non-TTY context (CI, scripts) there's no one to prompt, so this falls
// through and the caller's own error path handles it.
async function ensureGeminiApiKey(): Promise<void> {
  if (process.env.GEMINI_API_KEY) return;
  if (!process.stdin.isTTY) return;

  console.log("No GEMINI_API_KEY found in your environment.");
  const key = await promptForSecret(
    "Enter your Gemini API key (get one free at https://aistudio.google.com/apikey): "
  );

  if (!key) {
    throw new AiAssistDisabledError(
      "No Gemini API key entered — AI-assist config drafting cannot continue."
    );
  }

  process.env.GEMINI_API_KEY = key;
  console.log(
    "Using that key for this run. To skip this prompt next time, set it as an environment " +
    "variable: export GEMINI_API_KEY=your-key-here\n"
  );
}

const program = new Command();

program
  .name("retrospecs")
  .description("Fuzz-test your localhost API endpoints automatically.")
  .version("0.1.0");

program
  .command("run")
  .description("Run a fuzz test suite from a config file")
  .argument("<configPath>", "path to your fuzz.config.json file")
  .option("-c, --concurrency <number>", "max concurrent requests", "10")
  .option("-s, --seed <seed>", "seed for reproducible random generation")
  .option("--save-baseline <path>", "save this run's results as a baseline")
  .option("--diff-against <path>", "compare this run against a saved baseline")
  .option("--ai-edge-cases", "ask Gemini to suggest additional tricky edge-case values")
  .option("--ai-summarize", "ask Gemini to summarize and triage unexpected failures")
  .option("--html-report", "also write a self-contained HTML report alongside the JSON output")
  .action(async (configPath: string, opts) => {
    try {
      if (opts.seed) setSeed(opts.seed);
      console.log(`Using seed: ${getCurrentSeed()}`);

      const raw = fs.readFileSync(configPath, "utf-8");
      const config = configSchema.parse(JSON.parse(raw));

      const allResults = await runFuzz(config, {
        concurrency: Number(opts.concurrency),
        aiEdgeCases: opts.aiEdgeCases,
        htmlReport: opts.htmlReport,
      });
      const flatResults = Object.values(allResults).flat();

      if (opts.aiSummarize) {
        for (const endpoint of config.endpoints) {
          const endpointFailures = (allResults[endpoint.name] ?? []).filter((r) => !r.pass);
          if (endpointFailures.length === 0) continue;

          console.log(
            `\nAsking Gemini to summarize ${endpointFailures.length} failure(s) for "${endpoint.name}"...`
          );
          const summary = await summarizeFailures(endpointFailures, endpoint);

          console.log(`\n📋 Failure Summary for "${endpoint.name}":\n${summary.overallSummary}\n`);
          for (const group of summary.groups) {
            const icon = group.likelyRealBug ? "🐛" : "🤔";
            console.log(`${icon} ${group.title} (${group.affectedCaseCount} case(s))`);
            console.log(`   ${group.explanation}`);
            console.log(
              group.likelyRealBug
                ? "   → Likely a real bug, worth investigating.\n"
                : "   → Possibly a fuzzer misclassification, worth a second look before trusting it.\n"
            );
          }
        }
      }

      if (opts.saveBaseline) {
        await saveBaseline(flatResults, opts.saveBaseline);
        console.log(`\n📦 Baseline saved to ${opts.saveBaseline}`);
      }

      if (opts.diffAgainst) {
        const baseline = await loadBaseline(opts.diffAgainst);
        const diff = diffResults(baseline, flatResults);
        console.log(`\n🔍 Diff against baseline:`);
        console.log(`  ${diff.regressions.length} regression(s)`);
        console.log(`  ${diff.improvements.length} improvement(s)`);
        console.log(`  ${diff.unchanged} unchanged`);
        diff.regressions.forEach((r) => {
          console.log(
            `   ⚠️  ${JSON.stringify(r.params)}: ${r.baselineStatus} → ${r.currentStatus}`
          );
        });
      }

      console.log("\n✅ Done. See ./fuzz-results for full results.");
      if (opts.htmlReport) {
        console.log("   Open the report.html file in each endpoint's folder for a visual summary.");
      }
    } catch (err) {
      console.error("\n❌ retrospecs failed:\n");
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Generate a fuzz config file from an OpenAPI spec or an AI-drafted description")
  .option("--from-openapi <specPath>", "path to an OpenAPI JSON or YAML spec")
  .option("--ai", "use Gemini to draft a config from a description")
  .option("--describe <text>", "plain-English description of the endpoint (used with --ai)")
  .requiredOption("--base-url <url>", "your local server's base URL")
  .option("--out <path>", "output config path", "fuzz.config.suggested.json")
  .action(async (opts) => {
    try {
      let config;

      if (opts.fromOpenapi) {
        config = await configFromOpenApi(opts.fromOpenapi, opts.baseUrl);
      } else if (opts.ai) {
        if (!opts.describe) {
          throw new Error("--ai requires --describe \"...\" to explain what to generate a config for");
        }
        await ensureGeminiApiKey();
        console.log("Asking Gemini to draft a config...");
        config = await generateConfigFromSpec({
          description: opts.describe,
          baseUrl: opts.baseUrl,
        });
      } else {
        throw new Error("You must specify either --from-openapi <path> or --ai --describe \"...\"");
      }

      fs.writeFileSync(opts.out, JSON.stringify(config, null, 2));
      console.log(`✅ Draft config written to ${opts.out} — review it before running.`);
    } catch (err) {
      if (err instanceof AiAssistDisabledError) {
        console.error(`\n❌ ${err.message}`);
      } else {
        console.error("\n❌ Failed to generate config:\n");
        console.error(err instanceof Error ? err.message : err);
      }
      process.exit(1);
    }
  });

program.parse();