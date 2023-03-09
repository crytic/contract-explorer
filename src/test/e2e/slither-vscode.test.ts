import * as assert from "assert";

import * as vscode from "vscode";

suite("Slither-VSCode Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("example test", () => {
    assert(true, "Somehow this failed");
  });
});
