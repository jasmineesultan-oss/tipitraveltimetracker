import { Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

function toCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCsv(res: Response, filename: string, columns: ExportColumn[], rows: Record<string, unknown>[], note?: string) {
  const header = columns.map((c) => toCsvValue(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => toCsvValue(row[c.key])).join(","));
  const csv = [...(note ? [`# ${note}`] : []), header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  res.send(csv);
}

export async function exportXlsx(res: Response, filename: string, columns: ExportColumn[], rows: Record<string, unknown>[], note?: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
  if (note) {
    sheet.insertRow(1, [note]);
    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.getRow(1).font = { italic: true, color: { argb: "FF666666" } };
    sheet.getRow(2).font = { bold: true };
  } else {
    sheet.getRow(1).font = { bold: true };
  }
  rows.forEach((row) => sheet.addRow(row));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function exportPdf(res: Response, filename: string, title: string, columns: ExportColumn[], rows: Record<string, unknown>[], note?: string) {
  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(title, { align: "center" });
  if (note) {
    doc.moveDown(0.3);
    doc.fontSize(8).font("Helvetica-Oblique").text(note, { align: "center" });
    doc.font("Helvetica");
  }
  doc.moveDown();

  const colWidth = (doc.page.width - 60) / columns.length;
  let y = doc.y;

  doc.fontSize(9).font("Helvetica-Bold");
  columns.forEach((col, i) => {
    doc.text(col.header, 30 + i * colWidth, y, { width: colWidth, ellipsis: true });
  });
  doc.moveDown();
  y = doc.y;
  doc.font("Helvetica");

  rows.forEach((row) => {
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 30;
    }
    columns.forEach((col, i) => {
      doc.text(String(row[col.key] ?? ""), 30 + i * colWidth, y, { width: colWidth, ellipsis: true });
    });
    y += 16;
  });

  doc.end();
}

export async function exportReport(
  res: Response,
  format: string,
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  note?: string
) {
  if (format === "xlsx") return exportXlsx(res, filename, columns, rows, note);
  if (format === "pdf") return exportPdf(res, filename, title, columns, rows, note);
  return exportCsv(res, filename, columns, rows, note);
}

const PAYROLL_XLSX_COLUMNS = [
  { header: "Date", width: 14 },
  { header: "Employee Code", width: 15 },
  { header: "Name", width: 22 },
  { header: "Hours Worked", width: 12 },
  { header: "Payable Hours", width: 12 },
  { header: "Hourly Rate", width: 12 },
  { header: "Holiday Type", width: 16 },
  { header: "Multiplier %", width: 12 },
  { header: "Base Amount", width: 14 },
  { header: "Overtime Hours", width: 12 },
  { header: "Overtime Pay", width: 14 },
  { header: "Day Total", width: 14 },
];

export interface PayrollDayRow {
  date: Date;
  hoursWorked: number;
  payableHours: number;
  hourlyRate: number | null;
  holidayType: string | null;
  multiplierPct: number | null;
  baseAmount: number | null;
  overtimeHours: number;
  overtimePct: number | null;
  overtimePay: number | null;
  dayTotal: number | null;
  note?: string;
}

export interface PayrollEmployeeRows {
  employeeCode: string;
  name: string;
  days: PayrollDayRow[];
  periodTotal: number;
}

/**
 * Unlike exportXlsx, this writes real Excel formula cells for Base Amount, Overtime
 * Pay, and Day Total - referencing the other columns in that row - so opening the
 * file shows and recalculates the actual computation rather than a static number.
 */
export async function exportPayrollXlsx(
  res: Response,
  filename: string,
  employees: PayrollEmployeeRows[],
  note?: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payroll");
  PAYROLL_XLSX_COLUMNS.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width;
  });

  let headerRowNum = 1;
  if (note) {
    sheet.mergeCells(1, 1, 1, PAYROLL_XLSX_COLUMNS.length);
    const noteCell = sheet.getCell(1, 1);
    noteCell.value = note;
    noteCell.font = { italic: true, color: { argb: "FF666666" } };
    headerRowNum = 2;
  }
  const headerRow = sheet.getRow(headerRowNum);
  PAYROLL_XLSX_COLUMNS.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
  });
  headerRow.font = { bold: true };

  let rowNum = headerRowNum + 1;

  for (const emp of employees) {
    const startRow = rowNum;
    for (const d of emp.days) {
      const row = sheet.getRow(rowNum);
      row.getCell(1).value = d.date.toISOString().slice(0, 10);
      row.getCell(2).value = emp.employeeCode;
      row.getCell(3).value = emp.name;
      row.getCell(4).value = d.hoursWorked;
      row.getCell(5).value = d.payableHours;
      row.getCell(7).value = d.holidayType || "—";
      row.getCell(10).value = d.overtimeHours;

      if (d.hourlyRate === null) {
        row.getCell(6).value = d.note || "N/A";
        row.getCell(8).value = "N/A";
        row.getCell(9).value = "N/A";
        row.getCell(11).value = "N/A";
        row.getCell(12).value = "N/A";
      } else {
        row.getCell(6).value = d.hourlyRate;
        row.getCell(8).value = d.multiplierPct ?? "";
        row.getCell(9).value = { formula: `D${rowNum}*F${rowNum}` } as any;
        const otMultiplier = (d.overtimePct ?? 125) / 100;
        row.getCell(11).value = { formula: `J${rowNum}*F${rowNum}*${otMultiplier}` } as any;
        row.getCell(12).value = {
          formula: `IF(G${rowNum}="—",I${rowNum}+K${rowNum},E${rowNum}*F${rowNum}*H${rowNum}/100)`,
        } as any;
      }
      row.commit();
      rowNum++;
    }

    const totalRow = sheet.getRow(rowNum);
    totalRow.getCell(3).value = `${emp.name} - Period Total`;
    totalRow.getCell(3).font = { bold: true };
    if (rowNum > startRow) {
      totalRow.getCell(12).value = { formula: `SUM(L${startRow}:L${rowNum - 1})` } as any;
    } else {
      totalRow.getCell(12).value = 0;
    }
    totalRow.getCell(12).font = { bold: true };
    totalRow.commit();
    rowNum++;
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}
