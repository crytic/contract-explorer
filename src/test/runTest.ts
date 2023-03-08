import * as path from "path";

import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // Passed to `--extensionTestsPath`
    const extensionTestsPath = path.resolve(__dirname, "./e2e/index");

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

main();
