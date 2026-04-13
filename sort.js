/**
 * WHY THIS EXISTS (business / user story)
 * Epidemico collects user-reported side effects for medicines. Each record has a
 * "frequency rating" from 1 (rarely reported) to 10 (very commonly reported).
 * Raw data was not ordered by that rating, so analysts could not quickly see the
 * most important rows. This script orders records from highest rating to lowest
 * so the most commonly reported effects appear first, then writes that ordered
 * list to a file for review, sharing, or import into other tools.
 *
 * WHAT HAPPENS WHEN YOU RUN IT (pipeline)
* 1. Load the file sideEffects.json (this will be the file containing the input data).
* 2. For each data point, check if its frequencyRating field is a number from 1-10.
* 3. If not, it will be considered invalid and placed at the end of the list.
* 4. Then, sort the list in descending order of frequencyRating.
* 5. Finally, print the number of each frequency and the sorted data and save it to a file named sortedSideEffects.json.

 *
 * FILES TO KNOW FOR DOCUMENTATION
 * input file is sideEffects.json and output file is sortedSideEffects.json. The way to run the program is first you will be on the main directory then type the command node sort.js to run the program
 * For the sideEffects.json file, you can change the data to test the program with different data, what I put in there are 20 mock data.
 * For each data we have id, drugName, sideEffect, frequencyRating, reportedBy, and category (i tried to make the data as realistic as possible)
 
* RULES WORTH EXPLAINING IN EXTERNAL DOCS
* First, compare the data to see which one has a higher frequencyRating; if they are equal, compare drugName alphabetically.
* If the frequencyRating is not a number from 1-10, it will be considered invalid and placed at the end of the list.
* If the input list is empty, the output file will still be written with an empty list and a count of 0.
 */





    // Imports — built-in Node.js pieces only (no extra packages to install)
// "fs" = file system: read the JSON input and write the JSON output.
// "path" = build file paths correctly on Windows, Mac, or Linux.
const fs = require("fs");
const path = require("path");

// Path to input and output files (we make constants for them)
const DATA_FILE = path.join(__dirname, "sideEffects.json");
const OUTPUT_FILE = path.join(__dirname, "sortedSideEffects.json");


// This function checks if frequencyRating is a number from 1-10.
// If not, it will return false.
// If it is, it will return true.
function isValidFrequencyRating(value) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}


// This is a function that helps us convert input data into the output data we need.
// ratingForSort will be a number from 1-10 if frequencyRating is a number from 1-10, and rating invalid will be true if frequencyRating is not a number from 1-10, and false if frequencyRating is not a number from 1-10.
function normalizeRecord(row) {
  const raw = row.frequencyRating;
  const valid = isValidFrequencyRating(raw);
  return {
    row,
    ratingForSort: valid ? raw : 0,
    ratingInvalid: !valid,
  };
}


//This function is used to convert the output data into the same JSON format as the input data.
function toPlainRecords(normalizedSorted) {
  return normalizedSorted.map((item) => ({ ...item.row }));
}

// This function is used to store the sorted data on disk in JSON format. The output file will include the creation time, the input file used, a description of the sorting method, summary statistics, and a complete list of sorted sideEffects.
// fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8"): is used to write the output file in JSON and UTF-8 format.
function writeResultFile(normalizedSorted, summary) {
  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(DATA_FILE),
    sortDescription:
      "frequencyRating descending (10 = most common first); ties broken by drugName (A–Z)",
    summary: {
      totalSideEffects: summary.totalSideEffects,
      uniqueDrugs: summary.uniqueDrugs,
      highestFrequencyRating: summary.highestFrequencyRating,
      lowestFrequencyRating: summary.lowestFrequencyRating,
      countPerFrequencyRating: summary.countPerRating,
    },
    sideEffects: toPlainRecords(normalizedSorted),
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");
}


// This is a function to compare which of the two data points should appear first in the sorted list.
// We sort by comparing their frequency field, the one with the higher number comes first. If both are equal, we sort based on the alphabetical order of drugName.
function compareSideEffects(a, b) {
  if (b.ratingForSort !== a.ratingForSort) {
    return b.ratingForSort - a.ratingForSort;
  }
    const nameA = String(a.row.drugName ?? "");
  const nameB =  String(b.row.drugName ?? "");
  return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
}


// This function is used to load the dataset from the input file (sideEffects.json).
function loadDataset() {
  const text = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(text);
}


//// This function is used to calculate general statistics for the entire sorted list. 
// Some of the parameters we statistically analyze include the total number of data points, 
// the number of different drug names, the number of highest and lowest frequency ratings, 
// the number of data points in each rating scale from 1-10, and the number of invalid data points.
function buildSummary(normalizedSorted) {
  const n = normalizedSorted.length;

  const drugNames = new Set();
    let highest = null;
  let lowest = null;
  const perRating = {};
  for (let r = 1; r <= 10; r++) perRating[r] = 0;
  perRating.invalid = 0;

  for (const item of normalizedSorted) {
      const drug = item.row.drugName;
    if (drug !== undefined && drug !== null && String(drug).trim() !== "") {
       drugNames.add(String(drug));
    }
    if (item.ratingInvalid) {
      perRating.invalid++;
    } else {
      const r = item.ratingForSort;
      perRating[r]++;
      if (highest === null || r > highest) highest = r;
      if (lowest === null || r < lowest) lowest = r;
    }
  }

  return {
    totalSideEffects: n,
    uniqueDrugs: drugNames.size,
    highestFrequencyRating: highest,
    lowestFrequencyRating: lowest,
    countPerRating: perRating,
  };
}


// This function is used to print a single line of data from a sorted list to the console.
// We will print all the fields of a data set, such as id, drugName, sideEffect, frequencyRating, reportedBy, and category.
function printRow(item, rank) {
  const { row, ratingForSort, ratingInvalid } = item;
  const flag = ratingInvalid ? " [INVALID/MISSING frequencyRating]" : "";
  console.log(
    `${String(rank).padStart(2)}. [${row.id}] ${row.drugName} | ${row.sideEffect} | ` +
      `frequency: ${ratingInvalid ? row.frequencyRating : ratingForSort} (${ratingInvalid ? "invalid" : "valid"})` +
      ` | reportedBy: ${row.reportedBy} | ${row.category}${flag}`
  );
}


// This is the main function that will be used to run the program.
// The main function calls the helper functions above to load,
// validate data, normalize data, sort data, print data, and write data to the output file.
function main() {
  let data;
  try {
    data = loadDataset();
  } catch (err) {
    console.error("Could not read or parse sideEffects.json:", err.message);
    process.exit(1);
  }

  // The top level of the JSON file must be a list ([]), not a single object.
  if (!Array.isArray(data)) {
    console.error("Expected JSON array of side effects; got:", typeof data);
    process.exit(1);
  }

  // Special case: no rows. Still write an output file so "always produces output"
  // stays true for testers following documentation.
  if (data.length === 0) {
    console.log("Dataset is empty — no side effects to sort.");
    const emptySummary = {
      totalSideEffects: 0,
      uniqueDrugs: 0,
      highestFrequencyRating: null,
      lowestFrequencyRating: null,
      countPerRating: (() => {
        const per = { invalid: 0 };
        for (let r = 1; r <= 10; r++) per[r] = 0;
        return per;
      })(),
    };
    writeResultFile([], emptySummary);
    console.log(`\nWrote results to: ${OUTPUT_FILE}`);
    console.log("\n--- Summary ---");
    console.log("Total side effects: 0");
    console.log("Unique drugs: 0");
    console.log("Highest frequency rating: N/A");
    console.log("Lowest frequency rating: N/A");
    console.log("Per rating (1–10) and invalid: all 0");
    return;
  }

  // Step A: attach sorting metadata to every row without changing the stored fields.
  const normalized = data.map((row) => normalizeRecord(row));
  // Step B: reorder the array in place using our comparison rules.
  normalized.sort(compareSideEffects);

  // Step C: print the sorted data to the console.
  console.log("Sorted side effects (most common first; tie-breaker: drug name A–Z):\n");
  normalized.forEach((item, i) => printRow(item, i + 1));

  // Step D: build the summary statistics for the sorted data.
const summary = buildSummary(normalized);
  // Step E: write the sorted data and summary to the output file.
  writeResultFile(normalized, summary);
  console.log(`\nWrote sorted data and summary to: ${OUTPUT_FILE}`);
  // Step F: print the summary statistics to the console.
  console.log("\n--- Summary ---");
  console.log(`Total side effects in dataset: ${summary.totalSideEffects}`);
  console.log(`Unique drugs represented: ${summary.uniqueDrugs}`);
  console.log(
    `Highest frequency rating: ${summary.highestFrequencyRating ?? "N/A (all invalid)"}`
  );
  console.log(
    `Lowest frequency rating: ${summary.lowestFrequencyRating ?? "N/A (all invalid)"}`
  );
  console.log("Count per frequency rating (1–10) and invalid/missing:");
  for (let r = 10; r >= 1; r--) {
    console.log(`  ${r}: ${summary.countPerRating[r]}`);
  }
  console.log(`  invalid/missing: ${summary.countPerRating.invalid}`);
}

main();
