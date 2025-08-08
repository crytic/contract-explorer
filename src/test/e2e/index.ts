import * as path from "path";
import * as Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true });
  const testsRoot = path.resolve(__dirname, "..");

  try {
    const files = await glob("**/**.test.js", { cwd: testsRoot });
    
    files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

    return new Promise((c, e) => {
      try {
        mocha.run((failures: number) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  } catch (err) {
    throw err;
  }
}