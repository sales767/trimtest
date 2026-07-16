import type { jsPDF as JsPDFType } from "jspdf";

type LineRow = {
  label: string;
  line_group: string;
  factory: number;
  tol: number;
  measured: number | null;
  dev: number | null;
};

export type ExportSession = {
  wing_label: string;
  serial: string;
  session_date: string;
  rows: LineRow[];
  notes?: string | null;
};

function cls(dev: number | null, tol: number): "ok" | "warn" | "bad" | "empty" {
  if (dev === null) return "empty";
  const a = Math.abs(dev);
  if (a <= tol) return "ok";
  if (a <= 2 * tol) return "warn";
  return "bad";
}

export async function exportProtocolXlsx(s: ExportSession) {
  const XLSX = await import("xlsx");
  const header = ["Group", "Line", "Factory (mm)", "Measured (mm)", "Tolerance ±", "Deviation (mm)", "% dev", "Status"];
  const body = s.rows.map((r) => [
    r.line_group,
    r.label,
    r.factory.toFixed(1),
    r.measured === null ? "" : r.measured.toFixed(1),
    r.tol.toFixed(1),
    r.dev === null ? "" : Number(r.dev.toFixed(1)),
    r.dev === null || r.factory === 0 ? "" : `${((r.dev / r.factory) * 100).toFixed(2)}%`,
    cls(r.dev, r.tol),
  ]);
  const meta = [
    ["Wing", s.wing_label],
    ["Serial", s.serial],
    ["Session date", s.session_date],
    ["Generated", new Date().toISOString()],
    [],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...meta, header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Measurements");
  XLSX.writeFile(wb, `protocol-${s.serial}-${s.session_date}.xlsx`);
}

export async function exportProtocolPdf(s: ExportSession) {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableMod as { default: (doc: JsPDFType, opts: unknown) => void }).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(s.wing_label, 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`SN ${s.serial} · ${s.session_date}`, 40, 66);
  doc.setTextColor(0);

  const measured = s.rows.filter((r) => r.dev !== null);
  const outOfTol = measured.filter((r) => cls(r.dev, r.tol) !== "ok").length;
  const worst = measured.length ? Math.max(...measured.map((r) => Math.abs(r.dev ?? 0))) : 0;
  const avg = measured.length ? measured.reduce((a, r) => a + (r.dev ?? 0), 0) / measured.length : 0;
  doc.setFontSize(9);
  doc.text(
    `${measured.length}/${s.rows.length} lines · ${outOfTol} out of tolerance · worst ${worst.toFixed(1)} mm · avg ${avg >= 0 ? "+" : ""}${avg.toFixed(1)} mm`,
    40,
    82,
  );

  const groups = Array.from(new Set(s.rows.map((r) => r.line_group)));
  let y = 100;
  for (const g of groups) {
    const items = s.rows.filter((r) => r.line_group === g);
    if (items.length === 0) continue;
    autoTable(doc, {
      startY: y,
      head: [[`Group ${g}`, "Factory", "Measured", "Tol±", "Deviation", "%"]],
      body: items.map((r) => [
        r.label,
        r.factory.toFixed(0),
        r.measured === null ? "—" : r.measured.toFixed(1),
        r.tol.toFixed(1),
        r.dev === null ? "—" : `${r.dev >= 0 ? "+" : ""}${r.dev.toFixed(1)}`,
        r.dev === null || r.factory === 0 ? "—" : `${((r.dev / r.factory) * 100).toFixed(2)}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      theme: "striped",
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error jspdf-autotable augments the doc at runtime.
    y = doc.lastAutoTable.finalY + 16;
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
  }

  if (s.notes) {
    if (y > 720) {
      doc.addPage();
      y = 40;
    }
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("Notes", 40, y);
    doc.text(doc.splitTextToSize(s.notes, 515), 40, y + 12);
  }

  doc.setFontSize(8);
  doc.setTextColor(140);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(
      "Estimate-based analysis · complements, does not replace, a professional trim check.",
      40,
      820,
    );
  }

  doc.save(`protocol-${s.serial}-${s.session_date}.pdf`);
}