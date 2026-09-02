import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createLocalDataSource, readGitHeadInfo, SOURCES } from "../src/data/dataSource.js";

async function makeFixtureRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "barmen-fixture-"));
  const write = async (rel, content) => {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
  };
  await write("code/modules/food_and_drinks/recipes/drinks_recipes.dm", "/datum/chemical_reaction/x\n\tname = \"X\"\n");
  await write("modular_sand/code/modules/vending/a.dm", "// a");
  await write("modular_sand/code/modules/vending/nested/b.dm", "// b");
  await write("modular_sand/code/modules/vending/readme.md", "not dm");
  return root;
}

test("missing files and folders are skipped instead of failing the category", async () => {
  const root = await makeFixtureRepo();
  const source = await createLocalDataSource(root);

  const files = await source.fetchAllFiles(
    [
      "code/modules/food_and_drinks/recipes/drinks_recipes.dm",
      "modular_splurt/code/modules/reagents/chemistry/reagents/cit_reagents.dm" // moved upstream
    ],
    ["modular_sand/code/modules/vending", "modular_bluemoon/does/not/exist"]
  );

  const paths = files.map((f) => f.path).sort();
  assert.deepEqual(paths, [
    "code/modules/food_and_drinks/recipes/drinks_recipes.dm",
    "modular_sand/code/modules/vending/a.dm",
    "modular_sand/code/modules/vending/nested/b.dm"
  ]);
});

test("git head info is read without a git binary (loose ref)", async () => {
  const root = await makeFixtureRepo();
  const sha = "b99f7634239a575b495df928cc2607056e6d21da";
  await fs.mkdir(path.join(root, ".git", "refs", "heads"), { recursive: true });
  await fs.mkdir(path.join(root, ".git", "logs"), { recursive: true });
  await fs.writeFile(path.join(root, ".git", "HEAD"), "ref: refs/heads/master\n");
  await fs.writeFile(path.join(root, ".git", "refs", "heads", "master"), `${sha}\n`);
  await fs.writeFile(
    path.join(root, ".git", "logs", "HEAD"),
    `0000000000000000000000000000000000000000 ${sha} Sync Bot <bot@example.com> 1788000000 +0000\tpull: fast-forward\n`
  );

  const info = await readGitHeadInfo(root);
  assert.equal(info.branch, "master");
  assert.equal(info.sha, sha);
  assert.equal(info.commitDate, new Date(1788000000 * 1000).toISOString());

  const source = await createLocalDataSource(root);
  assert.equal(source.version.commit, "b99f763");
  assert.equal(source.version.branch, "master");
  assert.match(source.version.commitUrl, /BlueMoon-Station\/commit\/b99f763/);
});

test("git head info resolves packed refs", async () => {
  const root = await makeFixtureRepo();
  const sha = "0123456789abcdef0123456789abcdef01234567";
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
  await fs.writeFile(path.join(root, ".git", "HEAD"), "ref: refs/heads/master\n");
  await fs.writeFile(path.join(root, ".git", "packed-refs"), `# pack-refs with: peeled fully-peeled sorted\n${sha} refs/heads/master\n`);

  const info = await readGitHeadInfo(root);
  assert.equal(info.sha, sha);
});

test("a checkout without .git still yields a usable local version", async () => {
  const root = await makeFixtureRepo();
  const source = await createLocalDataSource(root);
  assert.equal(source.isLocal, true);
  assert.equal(source.version.branch, "local");
});

test("configured sources never point at the retired modular_splurt cit_reagents path", () => {
  const all = Object.values(SOURCES).flat();
  assert.ok(!all.includes("modular_splurt/code/modules/reagents/chemistry/reagents/cit_reagents.dm"));
  assert.ok(SOURCES.reagentFolders.includes("modular_sand/code/modules/reagents/chemistry/reagents"));
  assert.ok(SOURCES.dispenserFolders.includes("modular_sand/code/modules/reagents/chemistry/machinery"));
});
