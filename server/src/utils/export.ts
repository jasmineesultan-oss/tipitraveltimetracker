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
