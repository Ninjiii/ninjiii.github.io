
import jsPDF from "jspdf";

async function imageToDataUrl(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Could not load evidence image for PDF:", error);
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl) {
  if (!dataUrl) return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

export async function exportCasePdf(caseFile) {
  const doc = new jsPDF();
  const lineHeight = 8;
  let y = 16;

  const ensureSpace = (needed = 20) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 16;
    }
  };

  const addSection = (title) => {
    ensureSpace(20);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, 14, y);
    y += 8;
    doc.setFontSize(10);
  };

  const addLine = (label, value = "") => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const text = doc.splitTextToSize(String(value || "-"), 128);
    doc.text(text, 58, y);
    y += Math.max(lineHeight, text.length * lineHeight);
  };

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FEDERAL INVESTIGATION BUREAU", 14, y);
  y += 8;
  doc.setFontSize(12);
  doc.text("Federal Case Jacket / Evidence Dossier", 14, y);
  y += 12;

  doc.setFontSize(10);
  addLine("Case Number", caseFile.caseNo);
  addLine("Title", caseFile.title);
  addLine("Case Type", caseFile.type);
  addLine("Status", caseFile.status);
  addLine("Priority", caseFile.priority);
  addLine("Classification", caseFile.classification);
  addLine("Lead Agent", caseFile.leadAgent || caseFile.assignee);
  addLine("Supervising Officer", caseFile.supervisor);
  addLine("Assigned Agents", (caseFile.assignedAgents || []).map(a => a.email).join(", "));
  addLine("Location", caseFile.location);
  addLine("Division", caseFile.department);
  addLine("Tags", (caseFile.tags || []).join(", "));

  addSection("Incident Narrative");
  addLine("Description", caseFile.description);
  addLine("Objective", caseFile.objective);

  addSection("Subjects / Persons of Interest");
  addLine("Records", (caseFile.suspects || []).map(p => `- ${p.name}: ${p.info}`).join("\\n"));

  addSection("Evidence Registry");
  const evidenceList = caseFile.evidence || [];

  if (!evidenceList.length) {
    addLine("Records", "No evidence records.");
  }

  for (const evidence of evidenceList) {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.text(`${evidence.id || "NO-ID"} · ${evidence.name || "Evidence"}`, 14, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    const details = [
      `Type: ${evidence.type || "-"}`,
      `Status: ${evidence.status || "SECURED"}`,
      `Source: ${evidence.source || "Unknown"}`,
      `Info: ${evidence.info || "-"}`
    ].join("\\n");
    const detailLines = doc.splitTextToSize(details, 180);
    ensureSpace(detailLines.length * lineHeight + 12);
    doc.text(detailLines, 18, y);
    y += detailLines.length * lineHeight;

    if (evidence.image?.url) {
      const dataUrl = await imageToDataUrl(evidence.image.url);

      if (dataUrl) {
        ensureSpace(84);
        try {
          doc.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), 18, y, 72, 54);
          y += 60;
        } catch (error) {
          console.warn("Could not add image to PDF:", error);
          addLine("Image", evidence.image.name || "Image could not be embedded.");
        }
      } else {
        addLine("Image", evidence.image.name || "Image could not be embedded.");
      }
    }

    const chain = (evidence.chain || []).map(c => `- ${c.date} ${c.by}: ${c.text}`).join("\\n");
    if (chain) addLine("Chain", chain);
    y += 4;
  }

  addSection("Internal Reports");
  addLine("Records", (caseFile.reports || []).map(r => `- ${r.id} ${r.title} [${r.type}] by ${r.createdBy}\n${r.content}`).join("\n\n"));

  addSection("Linked Cases");
  addLine("Records", (caseFile.linkedCases || []).map(l => `- ${l.ref} (${l.addedAt || ""} ${l.by || ""})`).join("\n"));

  addSection("Investigation Milestones");
  addLine("Records", (caseFile.milestones || []).map(m => `- ${m.date} ${m.status}: ${m.title} — ${m.note || ""}`).join("\n"));

  addSection("Agent Notes");
  addLine("Records", (caseFile.notes || []).map(n => `- ${n.date} ${n.by || ""}: ${n.text}`).join("\\n"));

  addSection("Operations Log");
  addLine("Records", (caseFile.logbook || []).map(l => `- ${l.date} ${l.by || ""}: ${l.text}`).join("\\n"));

  addSection("Audit Trail");
  addLine("Records", (caseFile.activity || []).map(a => `- ${a.date} ${a.by || ""}: ${a.text}`).join("\\n"));

  doc.save(`${caseFile.caseNo || caseFile.title || "case-file"}.pdf`);
}
