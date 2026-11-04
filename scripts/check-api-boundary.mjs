import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "src");
const apiRoot = join(sourceRoot, "api");
const supabaseClient = join(sourceRoot, "lib", "supabase", "client.ts");
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const directSupabasePattern = /\bsupabase\s*\.\s*(?:from|rpc|auth|storage)\b/g;
const supabaseClientImportPattern =
  /\bimport\s+(?!type\b)([\s\S]*?)\s+from\s*["']([^"']*supabase\/client)["']/g;
const dynamicSupabaseClientImportPattern =
  /\bimport\s*\(\s*["']([^"']*supabase\/client)["']\s*\)/g;
const sideEffectSupabaseClientImportPattern =
  /\bimport\s+["']([^"']*supabase\/client)["']/g;
const createClientPattern = /\bcreateClient\s*\(/g;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectSourceFiles(path) : [path];
    }),
  );

  return files.flat();
}

const violations = [];
const files = await collectSourceFiles(sourceRoot);

for (const file of files) {
  if (!sourceExtensions.has(extname(file)) || file === supabaseClient) continue;

  const source = await readFile(file, "utf8");
  const patterns = [
    {
      message:
        "Direct Supabase database, auth, and storage access must live in src/api",
      pattern: directSupabasePattern,
      outsideApiOnly: true,
    },
    {
      message: "The Supabase client must not be imported outside src/api",
      pattern: supabaseClientImportPattern,
      outsideApiOnly: true,
    },
    {
      message:
        "The Supabase client must not be dynamically imported outside src/api",
      pattern: dynamicSupabaseClientImportPattern,
      outsideApiOnly: true,
    },
    {
      message: "The Supabase client must not be imported outside src/api",
      pattern: sideEffectSupabaseClientImportPattern,
      outsideApiOnly: true,
    },
    {
      message:
        "Supabase clients must only be created in src/lib/supabase/client.ts",
      pattern: createClientPattern,
    },
  ];

  for (const { message, pattern, outsideApiOnly } of patterns) {
    if (outsideApiOnly && file.startsWith(apiRoot)) continue;
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${relative(projectRoot, file)}:${line}: ${message}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    `Supabase access boundary violations:\n${violations.join("\n")}`,
  );
  process.exitCode = 1;
}
