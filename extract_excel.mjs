import xlsx from 'xlsx';

const filePath = "C:\\Users\\MackAndrewRosario\\Desktop\\git-quote-tool\\quote-tool\\XXkWp_Project Name_PCC_INTERNAL_V22.9 - DO NOT OPEN MAKE A COPY.xlsm";
const workbook = xlsx.readFile(filePath, { cellFormula: true });

const solarSheet = workbook.Sheets['SOLAR'];
if (solarSheet) {
  console.log("\\n--- SOLAR Sheet Rows 1-35 ---");
  for (let R = 0; R <= 34; ++R) {
    let rowStr = `Row ${R + 1}: `;
    for (let C = 1; C <= 10; ++C) { // cols B to K
      const cell = solarSheet[xlsx.utils.encode_cell({c: C, r: R})];
      if (cell && (cell.f || cell.v)) {
        rowStr += `[Col ${xlsx.utils.encode_col(C)}: ${cell.f ? 'F=' + cell.f : 'V=' + cell.v}] `;
      }
    }
    console.log(rowStr);
  }
}
