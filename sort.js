/**
 * Epidemico side-effect sorter (Node.js, no external libraries).
 *
 * What this script does:
 * 1) Reads raw data from sideEffects.json.
 * 2) Splits records into valid vs invalid frequencyRating.
 * 3) Sorts only valid records by:
 *    - frequencyRating (descending: 10 -> 1)
 *    - reportedBy (descending tie-breaker)
 *    - drugName (A-Z final tie-breaker for stable output)
 * 4) Writes sorted valid records to sortedSideEffects.json.
 * 5) Writes summary stats to sideEffectsSummary.json.
 * 6) Writes invalid rows to invalidSideEffects.json (only when invalid rows exist).
 *
 * Note: To reduce terminal noise (tester feedback), the script prints summary only.
 */

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "sideEffects.json");
const SORTED_OUTPUT_FILE = path.join(__dirname, "sortedSideEffects.json");
const SUMMARY_OUTPUT_FILE = path.join(__dirname, "sideEffectsSummary.json");
const INVALID_OUTPUT_FILE = path.join(__dirname, "invalidSideEffects.json");

/**
 * A valid frequency rating must be an integer from 1 to 10.
 */
function isValidFrequencyRating(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

/**
 * Split source rows into:
 * - validRows: safe to sort and publish for analysts
 * - invalidRows: bad/missing frequencyRating, kept for data-quality review
 */
function partitionRows(rows) {
  const validRows = [];
  const invalidRows = [];

  for (const row of rows) {
    if (isValidFrequencyRating(row.frequencyRating)) {
      validRows.push(row);
    } else {
      invalidRows.push(row);
    }
  }

  return { validRows, invalidRows };
}

/**
 * Sort rules:
 * 1) frequencyRating descending
 * 2) reportedBy descending
 * 3) drugName alphabetical (case-insensitive)
 */
function compareSideEffects(a, b) {
  if (b.frequencyRating !== a.frequencyRating) {
    return b.frequencyRating - a.frequencyRating;
  }

  const reportedA = Number.isFinite(a.reportedBy) ? a.reportedBy : 0;
  const reportedB = Number.isFinite(b.reportedBy) ? b.reportedBy : 0;
  if (reportedB !== reportedA) {
    return reportedB - reportedA;
  }

  const nameA = String(a.drugName ?? "");
  const nameB = String(b.drugName ?? "");
  return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
}

/**
 * Read and parse input JSON file.
 */
function loadDataset() {
  const text = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(text);
}

/**
 * Build summary stats over valid+invalid sets.
 */
function buildSummary(validRows, invalidRows) {
  const drugNames = new Set();
  const countPerRating = {};
  for (let r = 1; r <= 10; r++) countPerRating[r] = 0;

  let highest = null;
  let lowest = null;

  for (const row of validRows) {
    const drug = row.drugName;
    if (drug !== undefined && drug !== null && String(drug).trim() !== "") {
      drugNames.add(String(drug));
    }

    const rating = row.frequencyRating;
    countPerRating[rating] += 1;

    if (highest === null || rating > highest) highest = rating;
    if (lowest === null || rating < lowest) lowest = rating;
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(DATA_FILE),
    totalRows: validRows.length + invalidRows.length,
    totalValidRows: validRows.length,
    totalInvalidRows: invalidRows.length,
    uniqueDrugsInValidRows: drugNames.size,
    highestFrequencyRating: highest,
    lowestFrequencyRating: lowest,
    countPerFrequencyRating: countPerRating,
    sortRules: [
      "frequencyRating descending",
      "reportedBy descending (tie-breaker)",
      "drugName A-Z (final tie-breaker)"
    ]
  };
}

/**
 * Write JSON file in a consistent pretty format.
 */
function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function main() {
  let rows;
  try {
    rows = loadDataset();
  } catch (err) {
    console.error("Could not read or parse sideEffects.json:", err.message);
    process.exit(1);
  }

  if (!Array.isArray(rows)) {
    console.error("Expected JSON array of side effects; got:", typeof rows);
    process.exit(1);
  }

  // Tester-requested behavior: if empty input, print message only.
  if (rows.length === 0) {
    console.log("Dataset is empty — no side effects to sort.");
    return;
  }

  const { validRows, invalidRows } = partitionRows(rows);

  // Sort in-place for efficiency.
  validRows.sort(compareSideEffects);

  const summary = buildSummary(validRows, invalidRows);

  // Keep sorted dataset file simple: array only (no metadata wrapper).
  writeJsonFile(SORTED_OUTPUT_FILE, validRows);

  // Store summary separately so downstream tools can consume the sorted array easily.
  writeJsonFile(SUMMARY_OUTPUT_FILE, summary);

  if (invalidRows.length > 0) {
    writeJsonFile(INVALID_OUTPUT_FILE, invalidRows);
  }

  // Print concise run report to terminal.
  console.log("Sort completed.");
  console.log(`Valid rows sorted: ${summary.totalValidRows}`);
  console.log(`Invalid rows: ${summary.totalInvalidRows}`);
  console.log(`Unique drugs (valid rows): ${summary.uniqueDrugsInValidRows}`);
  console.log(`Highest frequency: ${summary.highestFrequencyRating ?? "N/A"}`);
  console.log(`Lowest frequency: ${summary.lowestFrequencyRating ?? "N/A"}`);
  console.log(`Wrote sorted data: ${SORTED_OUTPUT_FILE}`);
  console.log(`Wrote summary: ${SUMMARY_OUTPUT_FILE}`);

  if (invalidRows.length > 0) {
    console.log(`Wrote invalid rows: ${INVALID_OUTPUT_FILE}`);
  }
}

main();
