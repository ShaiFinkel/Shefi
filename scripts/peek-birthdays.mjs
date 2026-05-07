import XLSX from "xlsx";
const wb = XLSX.readFile("data/inputs/birthdays.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
const dataRows = rows.slice(3).filter(r => (r[0] ?? "").toString().trim() !== "");
const byCountry = {};
const byType = {};
const byNotes = {};
const months = {};
for (const r of dataRows) {
  const [name, country, type, , , date, amount, , , notes] = r;
  byCountry[country] = (byCountry[country] || 0) + 1;
  byType[type] = (byType[type] || 0) + 1;
  if (notes) byNotes[notes] = (byNotes[notes] || 0) + 1;
  const m = (date || "").toString().slice(5, 7);
  if (m) months[m] = (months[m] || 0) + 1;
}
console.log("Total people:", dataRows.length);
console.log("By country:", byCountry);
console.log("By type:", byType);
console.log("By notes:", byNotes);
console.log("Birthdays per month:", months);
console.log("\nLast 5 rows:");
for (const r of dataRows.slice(-5)) console.log(JSON.stringify(r));
console.log("\nMay birthdays (this month):");
for (const r of dataRows) {
  if ((r[5] || "").toString().slice(5, 7) === "05") {
    console.log(`  ${r[0]} | ${r[1]} | ${r[5]} | ${r[6]} | ${r[9] || ""}`);
  }
}
