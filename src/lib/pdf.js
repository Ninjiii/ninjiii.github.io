import jsPDF from "jspdf";

export function exportCasePdf(caseFile) {
  const doc = new jsPDF();
  const lineHeight = 8;
  let y = 16;

  const addLine = (label, value = "") => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const text = doc.splitTextToSize(String(value || "-"), 120);
    doc.text(text, 52, y);
    y += Math.max(lineHeight, text.length * lineHeight);
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
  };

  doc.setFontSize(18);
  doc.text("FIB Aktenauszug", 14, y);
  y += 12;

  doc.setFontSize(11);
  addLine("Titel", caseFile.title);
  addLine("Aktenart", caseFile.type);
  addLine("Status", caseFile.status);
  addLine("Priorität", caseFile.priority);
  addLine("Sachbearbeiter", caseFile.assignee);
  addLine("Tags", (caseFile.tags || []).join(", "));
  addLine("Beschreibung", caseFile.description);
  addLine("Notizen", (caseFile.notes || []).map(n => `- ${n.text}`).join("\n"));
  addLine("Termine", (caseFile.appointments || []).map(a => `- ${a.date} ${a.title}`).join("\n"));
  addLine("Einsatztagebuch", (caseFile.logbook || []).map(l => `- ${l.date} ${l.text}`).join("\n"));

  doc.save(`${caseFile.title || "akte"}.pdf`);
}
