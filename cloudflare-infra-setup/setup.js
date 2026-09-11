#!/usr/bin/env node
/**
 * Cloudflare Infrastructure Setup Script
 * Account: b4316201bd84751a7e7b3e43f5461c1f
 *
 * Continues from D1 setup stage and completes all remaining Cloudflare
 * infrastructure for the client-api architecture.
 *
 * PREREQUISITES: Node.js 18+ (no external packages needed — uses built-in fetch)
 *
 * USAGE:
 *   node setup.js
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "b4316201bd84751a7e7b3e43f5461c1f";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BASE_URL = "https://api.cloudflare.com/client/v4";

// Store resource IDs
let D1_DEV_ID = "";
let D1_PROD_ID = "";

// ─── Helpers ──────────────────────────────────────────────────────────────

const COLORS = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  NC: "\x1b[0m",
};

function log(color, msg) {
  console.log(`${COLORS[color]}${msg}${COLORS.NC}`);
}

async function apiCall(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, errors: [{ message: error.message }] };
  }
}

function checkSuccess(response, label) {
  if (response.success === true) {
    log("GREEN", `✓ ${label}`);
    return true;
  } else {
    log("RED", `✗ ${label}`);
    console.error(JSON.stringify(response.errors, null, 2));
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Phase 0: Verify Token ────────────────────────────────────────────────

async function verifyToken() {
  log("BLUE", "\n--- Verifying API Token ---");
  // cfat_ tokens (scoped account tokens) use the account-level verify endpoint
  const response = await apiCall("GET", `/accounts/${ACCOUNT_ID}/tokens/verify`);
  if (response.success && response.result?.status === "active") {
    log("GREEN", "✓ Token is active.");
  } else {
    log("RED", "✗ Token verification failed.");
    console.error(JSON.stringify(response.errors, null, 2));
    process.exit(1);
  }
}

// ─── Inspect Existing Resources ───────────────────────────────────────────

async function inspectExisting() {
  log("BLUE", "\n--- Inspecting Existing Resources ---");

  const d1 = await apiCall("GET", `/accounts/${ACCOUNT_ID}/d1/database`);
  log("YELLOW", "Existing D1 databases:");
  if (d1.result && d1.result.length > 0) {
    d1.result.forEach((db) => {
      console.log(`  - ${db.name} (ID: ${db.uuid})`);
    });
  } else {
    console.log("  (none)");
  }

  const r2 = await apiCall("GET", `/accounts/${ACCOUNT_ID}/r2/buckets`);
  log("YELLOW", "\nExisting R2 buckets:");
  if (r2.result?.buckets && r2.result.buckets.length > 0) {
    r2.result.buckets.forEach((b) => {
      console.log(`  - ${b.name}`);
    });
  } else {
    console.log("  (none)");
  }

  const workers = await apiCall("GET", `/accounts/${ACCOUNT_ID}/workers/scripts`);
  log("YELLOW", "\nExisting Workers:");
  if (workers.result && workers.result.length > 0) {
    workers.result.forEach((w) => {
      console.log(`  - ${w.id}`);
    });
  } else {
    console.log("  (none)");
  }
  console.log();
}

// ─── Phase 1: Create D1 Databases ─────────────────────────────────────────

async function createD1() {
  log("BLUE", "\n--- Phase 1: D1 Databases ---");

  const existing = await apiCall("GET", `/accounts/${ACCOUNT_ID}/d1/database`);

  // Find existing
  if (existing.result) {
    const devDb = existing.result.find((d) => d.name === "client-development");
    const prodDb = existing.result.find((d) => d.name === "client-production");
    if (devDb) {
      D1_DEV_ID = devDb.uuid;
      log("GREEN", `✓ D1 'client-development' already exists (ID: ${D1_DEV_ID})`);
    }
    if (prodDb) {
      D1_PROD_ID = prodDb.uuid;
      log("GREEN", `✓ D1 'client-production' already exists (ID: ${D1_PROD_ID})`);
    }
  }

  // Create client-development if not found
  if (!D1_DEV_ID) {
    log("YELLOW", "Creating D1 database: client-development...");
    const response = await apiCall("POST", `/accounts/${ACCOUNT_ID}/d1/database`, {
      name: "client-development",
    });
    if (checkSuccess(response, "Created D1 'client-development'")) {
      D1_DEV_ID = response.result.uuid;
      console.log(`  ID: ${D1_DEV_ID}`);
    } else {
      log("RED", "STOP: Failed to create client-development D1 database.");
      process.exit(1);
    }
  }

  // Create client-production if not found
  if (!D1_PROD_ID) {
    log("YELLOW", "Creating D1 database: client-production...");
    const response = await apiCall("POST", `/accounts/${ACCOUNT_ID}/d1/database`, {
      name: "client-production",
    });
    if (checkSuccess(response, "Created D1 'client-production'")) {
      D1_PROD_ID = response.result.uuid;
      console.log(`  ID: ${D1_PROD_ID}`);
    } else {
      log("RED", "STOP: Failed to create client-production D1 database.");
      process.exit(1);
    }
  }

  console.log();
  log("YELLOW", "D1 Database IDs:");
  console.log(`  client-development: ${D1_DEV_ID}`);
  console.log(`  client-production:   ${D1_PROD_ID}`);
  console.log();
}

// ─── Phase 2: Create R2 Buckets ────────────────────────────────────────────

async function createR2() {
  log("BLUE", "\n--- Phase 2: R2 Buckets ---");

  const existing = await apiCall("GET", `/accounts/${ACCOUNT_ID}/r2/buckets`);
  const existingNames = new Set(
    (existing.result?.buckets || []).map((b) => b.name)
  );

  const buckets = [
    "client-development-files",
    "client-production-images",
    "client-production-files",
    "client-production-backups",
  ];

  for (const bucket of buckets) {
    if (existingNames.has(bucket)) {
      log("GREEN", `✓ R2 bucket '${bucket}' already exists`);
    } else {
      log("YELLOW", `Creating R2 bucket: ${bucket}...`);
      const response = await apiCall("POST", `/accounts/${ACCOUNT_ID}/r2/buckets`, {
        name: bucket,
      });
      if (checkSuccess(response, `Created R2 '${bucket}'`)) {
        // success
      } else {
        log("RED", `STOP: Failed to create R2 bucket '${bucket}'.`);
        process.exit(1);
      }
      await sleep(500); // Small delay between bucket creations
    }
  }

  console.log();
  log("YELLOW", "Note: All R2 buckets are kept private (no public access enabled).");
  console.log();
}

// ─── Phase 3: Configure Development Worker ────────────────────────────────

async function configureDevWorker() {
  log("BLUE", "\n--- Phase 3: Configure Development Worker (client-api-dev) ---");

  // Get current settings
  const settings = await apiCall("GET", `/accounts/${ACCOUNT_ID}/workers/scripts/client-api-dev/settings`);
  const currentBindings = settings.result?.bindings || [];

  log("YELLOW", "Current bindings:");
  currentBindings.forEach((b) => {
    console.log(`  - ${b.type}: ${b.name}`);
  });

  // Preserve existing bindings that aren't DB or FILES
  const preserved = currentBindings.filter(
    (b) => b.name !== "DB" && b.name !== "FILES"
  );

  // New bindings
  const newBindings = [
    {
      type: "d1",
      name: "DB",
      database_id: D1_DEV_ID,
    },
    {
      type: "r2_bucket",
      name: "FILES",
      bucket_name: "client-development-files",
    },
  ];

  const finalBindings = [...preserved, ...newBindings];

  log("YELLOW", "Applying bindings to client-api-dev...");
  const response = await apiCall("PATCH", `/accounts/${ACCOUNT_ID}/workers/scripts/client-api-dev/settings`, {
    bindings: finalBindings,
  });

  if (checkSuccess(response, "Development Worker bindings updated")) {
    console.log(`  DB → client-development (${D1_DEV_ID})`);
    console.log(`  FILES → client-development-files`);
  } else {
    log("RED", "STOP: Failed to update client-api-dev bindings.");
    process.exit(1);
  }

  console.log();
}

// ─── Phase 4: Configure Production Worker ─────────────────────────────────

async function configureProdWorker() {
  log("BLUE", "\n--- Phase 4: Configure Production Worker (client-api) ---");

  // Get current settings
  const settings = await apiCall("GET", `/accounts/${ACCOUNT_ID}/workers/scripts/client-api/settings`);
  const currentBindings = settings.result?.bindings || [];

  log("YELLOW", "Current bindings:");
  currentBindings.forEach((b) => {
    console.log(`  - ${b.type}: ${b.name}`);
  });

  // Preserve existing bindings that aren't DB, IMAGES, FILES, or BACKUPS
  const preserved = currentBindings.filter(
    (b) => b.name !== "DB" && b.name !== "IMAGES" && b.name !== "FILES" && b.name !== "BACKUPS"
  );

  // New bindings
  const newBindings = [
    {
      type: "d1",
      name: "DB",
      database_id: D1_PROD_ID,
    },
    {
      type: "r2_bucket",
      name: "IMAGES",
      bucket_name: "client-production-images",
    },
    {
      type: "r2_bucket",
      name: "FILES",
      bucket_name: "client-production-files",
    },
    {
      type: "r2_bucket",
      name: "BACKUPS",
      bucket_name: "client-production-backups",
    },
  ];

  const finalBindings = [...preserved, ...newBindings];

  log("YELLOW", "Applying bindings to client-api...");
  const response = await apiCall("PATCH", `/accounts/${ACCOUNT_ID}/workers/scripts/client-api/settings`, {
    bindings: finalBindings,
  });

  if (checkSuccess(response, "Production Worker bindings updated")) {
    console.log(`  DB → client-production (${D1_PROD_ID})`);
    console.log(`  IMAGES → client-production-images`);
    console.log(`  FILES → client-production-files`);
    console.log(`  BACKUPS → client-production-backups`);
  } else {
    log("RED", "STOP: Failed to update client-api bindings.");
    process.exit(1);
  }

  console.log();
}

// ─── Phase 5: Inspect Worker Code ──────────────────────────────────────────

async function inspectWorkerCode() {
  log("BLUE", "\n--- Phase 5: Inspecting Existing Worker Code ---");

  for (const worker of ["client-api", "client-api-dev"]) {
    log("YELLOW", `\nWorker: ${worker}`);

    // Get Worker metadata
    const meta = await apiCall("GET", `/accounts/${ACCOUNT_ID}/workers/scripts/${worker}`);

    if (meta.success) {
      const mainModule = meta.result?.main_module || "not specified";
      console.log(`  Main module: ${mainModule}`);

      // Get bindings from metadata
      const bindings = meta.result?.bindings || [];
      if (bindings.length > 0) {
        bindings.forEach((b) => {
          const target = b.database_id || b.bucket_name || b.text || "n/a";
          console.log(`  Binding: ${b.type} → ${b.name} (${target})`);
        });
      } else {
        console.log("  No bindings in metadata");
      }
    } else {
      console.log("  Could not retrieve Worker metadata");
      if (meta.errors) console.error(JSON.stringify(meta.errors, null, 2));
    }
  }

  console.log();
}

// ─── Phase 12: Validation ──────────────────────────────────────────────────

async function validate() {
  log("BLUE", "\n--- Phase 12: Validation ---");
  console.log("Verifying all bindings and resource isolation...\n");

  let allOk = true;

  // Validate client-api-dev
  log("YELLOW", "Checking client-api-dev:");
  const devSettings = await apiCall("GET", `/accounts/${ACCOUNT_ID}/workers/scripts/client-api-dev/settings`);
  const devBindings = devSettings.result?.bindings || [];

  const devDb = devBindings.find((b) => b.name === "DB");
  if (devDb?.database_id === D1_DEV_ID) {
    log("GREEN", "  ✓ DB → client-development");
  } else {
    log("RED", `  ✗ DB binding mismatch (expected ${D1_DEV_ID}, got ${devDb?.database_id})`);
    allOk = false;
  }

  const devFiles = devBindings.find((b) => b.name === "FILES");
  if (devFiles?.bucket_name === "client-development-files") {
    log("GREEN", "  ✓ FILES → client-development-files");
  } else {
    log("RED", `  ✗ FILES binding mismatch (expected client-development-files, got ${devFiles?.bucket_name})`);
    allOk = false;
  }

  // Dev should NOT have production bindings
  const devImages = devBindings.find((b) => b.name === "IMAGES");
  if (!devImages) {
    log("GREEN", "  ✓ No IMAGES binding (correct — dev isolated from production)");
  } else {
    log("RED", "  ✗ Dev worker has IMAGES binding (should not)");
    allOk = false;
  }

  const devBackups = devBindings.find((b) => b.name === "BACKUPS");
  if (!devBackups) {
    log("GREEN", "  ✓ No BACKUPS binding (correct — dev isolated from production)");
  } else {
    log("RED", "  ✗ Dev worker has BACKUPS binding (should not)");
    allOk = false;
  }

  console.log();

  // Validate client-api
  log("YELLOW", "Checking client-api:");
  const prodSettings = await apiCall("GET", `/accounts/${ACCOUNT_ID}/workers/scripts/client-api/settings`);
  const prodBindings = prodSettings.result?.bindings || [];

  const prodDb = prodBindings.find((b) => b.name === "DB");
  if (prodDb?.database_id === D1_PROD_ID) {
    log("GREEN", "  ✓ DB → client-production");
  } else {
    log("RED", `  ✗ DB binding mismatch (expected ${D1_PROD_ID}, got ${prodDb?.database_id})`);
    allOk = false;
  }

  const prodImages = prodBindings.find((b) => b.name === "IMAGES");
  if (prodImages?.bucket_name === "client-production-images") {
    log("GREEN", "  ✓ IMAGES → client-production-images");
  } else {
    log("RED", `  ✗ IMAGES binding mismatch (expected client-production-images, got ${prodImages?.bucket_name})`);
    allOk = false;
  }

  const prodFiles = prodBindings.find((b) => b.name === "FILES");
  if (prodFiles?.bucket_name === "client-production-files") {
    log("GREEN", "  ✓ FILES → client-production-files");
  } else {
    log("RED", `  ✗ FILES binding mismatch (expected client-production-files, got ${prodFiles?.bucket_name})`);
    allOk = false;
  }

  const prodBackups = prodBindings.find((b) => b.name === "BACKUPS");
  if (prodBackups?.bucket_name === "client-production-backups") {
    log("GREEN", "  ✓ BACKUPS → client-production-backups");
  } else {
    log("RED", `  ✗ BACKUPS binding mismatch (expected client-production-backups, got ${prodBackups?.bucket_name})`);
    allOk = false;
  }

  // Prod should NOT point to dev D1
  if (prodDb?.database_id === D1_DEV_ID) {
    log("RED", "  ✗ Production DB is pointing to development database!");
    allOk = false;
  }

  console.log();

  // Validate R2 buckets
  log("YELLOW", "Checking R2 buckets exist:");
  const r2Response = await apiCall("GET", `/accounts/${ACCOUNT_ID}/r2/buckets`);
  const r2Names = new Set((r2Response.result?.buckets || []).map((b) => b.name));
  for (const bucket of ["client-development-files", "client-production-images", "client-production-files", "client-production-backups"]) {
    if (r2Names.has(bucket)) {
      log("GREEN", `  ✓ ${bucket}`);
    } else {
      log("RED", `  ✗ ${bucket} not found`);
      allOk = false;
    }
  }

  console.log();

  // Validate D1 databases
  log("YELLOW", "Checking D1 databases exist:");
  const d1Response = await apiCall("GET", `/accounts/${ACCOUNT_ID}/d1/database`);
  const d1Names = new Set((d1Response.result || []).map((d) => d.name));
  for (const db of ["client-development", "client-production"]) {
    if (d1Names.has(db)) {
      log("GREEN", `  ✓ ${db}`);
    } else {
      log("RED", `  ✗ ${db} not found`);
      allOk = false;
    }
  }

  console.log();

  if (allOk) {
    log("GREEN", "========================================");
    log("GREEN", "ALL VALIDATIONS PASSED ✓");
    log("GREEN", "========================================");
  } else {
    log("RED", "========================================");
    log("RED", "SOME VALIDATIONS FAILED ✗");
    log("RED", "Review the errors above.");
    log("RED", "========================================");
  }

  return allOk;
}

// ─── Final Report ──────────────────────────────────────────────────────────

function finalReport() {
  console.log();
  log("BLUE", "========================================");
  log("BLUE", "FINAL REPORT");
  log("BLUE", "========================================");
  console.log();
  console.log("1. D1 Databases:");
  console.log(`   - client-development (ID: ${D1_DEV_ID})`);
  console.log(`   - client-production   (ID: ${D1_PROD_ID})`);
  console.log();
  console.log("2. R2 Buckets (all private):");
  console.log("   - client-development-files");
  console.log("   - client-production-images");
  console.log("   - client-production-files");
  console.log("   - client-production-backups");
  console.log();
  console.log("3. Development Worker (client-api-dev) Bindings:");
  console.log("   - DB → client-development");
  console.log("   - FILES → client-development-files");
  console.log();
  console.log("4. Production Worker (client-api) Bindings:");
  console.log("   - DB → client-production");
  console.log("   - IMAGES → client-production-images");
  console.log("   - FILES → client-production-files");
  console.log("   - BACKUPS → client-production-backups");
  console.log();
  console.log("5. Migrations: Not applied by this script.");
  console.log("   Run from your project directory:");
  console.log("     npx wrangler d1 migrations apply client-development --remote");
  console.log("     npx wrangler d1 migrations apply client-production --remote");
  console.log();
  console.log("6. Secrets: Not created by this script.");
  console.log("   Inspect your application code to determine required secrets.");
  console.log("   Use wrangler CLI to set them (names only, never values in config):");
  console.log("     npx wrangler secret put SECRET_NAME --env development");
  console.log("     npx wrangler secret put SECRET_NAME --env production");
  console.log();
  console.log("7. Stream: Already configured — no changes made.");
  console.log();
  console.log("8. Backups: R2 bucket 'client-production-backups' created and bound.");
  console.log("   Application-side backup logic must be implemented in the Worker code.");
  console.log();
  console.log("9. Validation: See validation output above.");
  console.log();
  console.log("10. Remaining manual steps:");
  console.log("    a. Update wrangler.jsonc/wrangler.toml with the D1/R2 binding IDs above");
  console.log("    b. Apply D1 migrations (dev first, then prod)");
  console.log("    c. Create required secrets via wrangler CLI");
  console.log("    d. Verify Stream integration in application code");
  console.log("    e. Implement backup logic in production Worker if needed");
  console.log();
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  log("BLUE", "========================================");
  log("BLUE", "Cloudflare Infrastructure Setup");
  log("BLUE", "========================================");
  console.log();

  await verifyToken();
  await inspectExisting();
  await createD1();
  await createR2();
  await configureDevWorker();
  await configureProdWorker();
  await inspectWorkerCode();
  await validate();
  finalReport();
}

main().catch((err) => {
  log("RED", `FATAL ERROR: ${err.message}`);
  console.error(err);
  process.exit(1);
});
