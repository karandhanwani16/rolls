import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const COMPANY_NAME = "T. A. TEX";
const COMPANY_ADDRESS = "Ulhasnagar 421005";
const COMPANY_TAGLINE = "Textile Trading";

const NAVY: [number, number, number] = [22, 48, 80];
const GOLD: [number, number, number] = [196, 154, 70];
const MUTED: [number, number, number] = [100, 116, 139];
const TEXT: [number, number, number] = [15, 23, 42];
const LINE: [number, number, number] = [226, 232, 240];
const ROW_ALT: [number, number, number] = [248, 250, 252];
const CARD_BG: [number, number, number] = [248, 250, 252];
const EMPHASIS_BG: [number, number, number] = [22, 48, 80];

const MARGIN = 12;
const HEADER_BAND = 28;
const FOOTER_RESERVE = 16;

export type ReportOrientation = "portrait" | "landscape";

export type ReportMeta = {
  label: string;
  value: string;
};

export type ReportSummaryItem = {
  label: string;
  value: string;
  emphasize?: boolean;
};

export type ReportColumn = {
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  overflow?: "linebreak" | "ellipsize";
};

export type DownloadReportPdfOptions = {
  title: string;
  filename: string;
  orientation?: ReportOrientation;
  meta?: ReportMeta[];
  summary?: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: (string | number)[][];
  foot?: (string | number)[][];
};

export function formatPdfAmount(
  amount: number | null | undefined,
  options?: { blankZero?: boolean; prefix?: boolean }
): string {
  const value = Number(amount) || 0;
  if (options?.blankZero && value === 0) return "—";
  const formatted = value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return options?.prefix === false ? formatted : `Rs. ${formatted}`;
}

export function formatPdfPeriod(startDate: string | Date, endDate: string | Date): string {
  return `${format(new Date(startDate), "dd/MM/yyyy")}  –  ${format(new Date(endDate), "dd/MM/yyyy")}`;
}

export function formatPdfDate(value: string | Date): string {
  return format(new Date(value), "dd/MM/yyyy");
}

function setRgb(
  doc: jsPDF,
  method: "setFillColor" | "setTextColor" | "setDrawColor",
  color: [number, number, number]
) {
  doc[method](color[0], color[1], color[2]);
}

function drawHeaderBand(doc: jsPDF, pageWidth: number) {
  setRgb(doc, "setFillColor", NAVY);
  doc.rect(0, 0, pageWidth, HEADER_BAND, "F");
  setRgb(doc, "setFillColor", GOLD);
  doc.rect(0, HEADER_BAND, pageWidth, 1.4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(COMPANY_NAME, pageWidth / 2, 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${COMPANY_ADDRESS}  ·  ${COMPANY_TAGLINE}`, pageWidth / 2, 20.5, {
    align: "center",
  });
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, page: number, total: number) {
  const y = pageHeight - 8;
  setRgb(doc, "setDrawColor", GOLD);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setRgb(doc, "setTextColor", MUTED);
  doc.text(`Generated ${format(new Date(), "dd/MM/yyyy HH:mm")}`, MARGIN, y);
  doc.text("Confidential", pageWidth / 2, y, { align: "center" });
  doc.text(`Page ${page} of ${total}`, pageWidth - MARGIN, y, { align: "right" });
}

function drawTitle(doc: jsPDF, title: string, pageWidth: number, y: number) {
  setRgb(doc, "setTextColor", NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  return y + 7;
}

function drawMeta(doc: jsPDF, meta: ReportMeta[], pageWidth: number, y: number) {
  if (!meta.length) return y;

  const contentWidth = pageWidth - MARGIN * 2;
  const boxH = 12;
  setRgb(doc, "setFillColor", CARD_BG);
  setRgb(doc, "setDrawColor", LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, contentWidth, boxH, 1.2, 1.2, "FD");

  const colW = contentWidth / Math.min(meta.length, 3);
  doc.setFontSize(9.5);
  meta.slice(0, 3).forEach((item, index) => {
    const x = MARGIN + 4 + index * colW;
    setRgb(doc, "setTextColor", MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(`${item.label}:`, x, y + 7.6);
    const labelW = doc.getTextWidth(`${item.label}: `);
    setRgb(doc, "setTextColor", TEXT);
    doc.setFont("helvetica", "bold");
    const maxW = colW - labelW - 8;
    const value = doc.splitTextToSize(item.value || "—", Math.max(maxW, 20));
    doc.text(Array.isArray(value) ? value[0] : value, x + labelW, y + 7.6);
  });

  return y + boxH + 5;
}

function drawFittedRightText(
  doc: jsPDF,
  text: string,
  rightX: number,
  y: number,
  maxWidth: number,
  fontSize: number
) {
  let size = fontSize;
  doc.setFontSize(size);
  while (size > 8 && doc.getTextWidth(text) > maxWidth) {
    size -= 0.4;
    doc.setFontSize(size);
  }
  doc.text(text, rightX, y, { align: "right" });
}

function drawSummary(doc: jsPDF, summary: ReportSummaryItem[], pageWidth: number, startY: number) {
  if (!summary.length) return startY;

  const contentWidth = pageWidth - MARGIN * 2;
  const perRow = Math.min(summary.length, 4);
  const gap = 3.5;
  const cardW = (contentWidth - gap * (perRow - 1)) / perRow;
  const cardH = 20;
  let y = startY;

  for (let i = 0; i < summary.length; i += perRow) {
    const row = summary.slice(i, i + perRow);
    row.forEach((item, index) => {
      const x = MARGIN + index * (cardW + gap);
      const valueMax = cardW - 8;
      if (item.emphasize) {
        setRgb(doc, "setFillColor", EMPHASIS_BG);
        doc.roundedRect(x, y, cardW, cardH, 1.4, 1.4, "F");
        doc.setTextColor(191, 219, 254);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(item.label.toUpperCase(), x + 4, y + 6.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        drawFittedRightText(doc, item.value, x + cardW - 4, y + 15.2, valueMax, 12);
      } else {
        setRgb(doc, "setFillColor", CARD_BG);
        setRgb(doc, "setDrawColor", LINE);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, cardW, cardH, 1.4, 1.4, "FD");
        setRgb(doc, "setTextColor", MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(item.label.toUpperCase(), x + 4, y + 6.5);
        setRgb(doc, "setTextColor", NAVY);
        doc.setFont("helvetica", "bold");
        drawFittedRightText(doc, item.value, x + cardW - 4, y + 15.2, valueMax, 12);
      }
    });
    y += cardH + 3.5;
  }

  return y + 2;
}

export function createReportPdf({
  title,
  orientation = "portrait",
  meta = [],
  summary = [],
  columns,
  rows,
  foot,
}: Omit<DownloadReportPdfOptions, "filename">) {
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeaderBand(doc, pageWidth);
  let cursorY = drawTitle(doc, title, pageWidth, HEADER_BAND + 10);
  cursorY = drawMeta(doc, meta, pageWidth, cursorY + 1);
  cursorY = drawSummary(doc, summary, pageWidth, cursorY);

  autoTable(doc, {
    startY: cursorY,
    head: [columns.map((col) => col.header)],
    body: rows,
    foot: foot && rows.length ? [foot] : undefined,
    showFoot: foot && rows.length ? "lastPage" : undefined,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: orientation === "landscape" ? 11 : 10,
      cellPadding: { top: 3.2, right: 2.8, bottom: 3.2, left: 2.8 },
      textColor: TEXT,
      overflow: "linebreak",
      valign: "middle",
      lineColor: LINE,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10.5,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 3.8, right: 2.8, bottom: 3.8, left: 2.8 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: NAVY,
      fontStyle: "bold",
      fontSize: 11,
      halign: "right",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: NAVY,
    },
    columnStyles: columns.reduce<Record<number, object>>((acc, col, index) => {
      acc[index] = {
        halign: col.align || "left",
        ...(col.width ? { cellWidth: col.width } : {}),
        ...(col.overflow ? { overflow: col.overflow } : {}),
      };
      return acc;
    }, {}),
    margin: {
      top: HEADER_BAND + 8,
      left: MARGIN,
      right: MARGIN,
      bottom: FOOTER_RESERVE,
    },
    tableLineColor: LINE,
    tableLineWidth: 0.15,
    didParseCell: (data) => {
      if (data.section === "foot") {
        data.cell.styles.halign = "right";
      }
    },
    didDrawPage: () => {
      drawHeaderBand(doc, pageWidth);
    },
  });

  const totalPages =
    typeof doc.getNumberOfPages === "function"
      ? doc.getNumberOfPages()
      : (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    drawFooter(doc, pageWidth, doc.internal.pageSize.getHeight(), i, totalPages);
  }

  return doc;
}

export function downloadReportPdf(options: DownloadReportPdfOptions) {
  const doc = createReportPdf(options);
  doc.save(options.filename);
}
