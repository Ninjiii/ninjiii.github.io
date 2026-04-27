
import jsPDF from "jspdf";

export function exportCasePdf(caseFile) {
  const doc = new jsPDF();
  const lineHeight = 8;
  let y = 16;

  const addSection = (title) => {
    if (y > 255) {
      doc.addPage();
      y = 16;
    }
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, 14, y);
    y += 8;
    doc.setFontSize(10);
  };

  const addLine = (label, value = "") => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const text = doc.splitTextToSize(String(value || "-"), 128);
    doc.text(text, 58, y);
    y += Math.max(lineHeight, text.length * lineHeight);
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
  };

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FEDERAL INVESTIGATION BUREAU", 14, y);
  y += 8;
  doc.setFontSize(12);
  doc.text("Aktenauszug / Ermittlungsakte", 14, y);
  y += 12;

  doc.setFontSize(10);
  addLine("Aktennummer", caseFile.caseNo);
  addLine("Titel", caseFile.title);
  addLine("Aktenart", caseFile.type);
  addLine("Status", caseFile.status);
  addLine("Priorität", caseFile.priority);
  addLine("Einstufung", caseFile.classification);
  addLine("Sachbearbeiter", caseFile.assignee);
  addLine("Ort", caseFile.location);
  addLine("Abteilung", caseFile.department);
  addLine("Tags", (caseFile.tags || []).join(", "));

  addSection("Sachverhalt");
  addLine("Beschreibung", caseFile.description);
  addLine("Ziel", caseFile.objective);

  addSection("Personen");
  addLine("Einträge", (caseFile.suspects || []).map(p => `- ${p.name}: ${p.info}`).join("\n"));

  addSection("Beweise");
  addLine("Einträge", (caseFile.evidence || []).map(e => `- ${e.name}: ${e.info}`).join("\n"));

  addSection("Notizen");
  addLine("Einträge", (caseFile.notes || []).map(n => `- ${n.date} ${n.by || ""}: ${n.text}`).join("\n"));

  addSection("Einsatztagebuch");
  addLine("Einträge", (caseFile.logbook || []).map(l => `- ${l.date} ${l.by || ""}: ${l.text}`).join("\n"));

  addSection("Chronik");
  addLine("Einträge", (caseFile.activity || []).map(a => `- ${a.date} ${a.by || ""}: ${a.text}`).join("\n"));

  doc.save(`${caseFile.caseNo || caseFile.title || "akte"}.pdf`);
}
