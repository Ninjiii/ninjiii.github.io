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
  const pageBottom = 280;
  const left = 14;
  const labelX = 14;
  const valueX = 58;
  const fullWidth = 180;
  const valueWidth = 136;
  const lineHeight = 6;
  let y = 16;

  const ensureSpace = (needed = 12) => {
    if (y + needed > pageBottom) {
      doc.addPage();
      y = 16;
    }
  };

  const addTitle = () => {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("FEDERAL INVESTIGATION BUREAU", left, y);
    y += 8;
    doc.setFontSize(12);
    doc.text("Federal Case Jacket / Evidence Dossier", left, y);
    y += 12;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  };

  const addSection = (title) => {
    ensureSpace(18);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(title), left, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  };

  const addWrappedBlock = (text, x = left, width = fullWidth) => {
    const value = text && String(text).trim() ? String(text) : "-";
    const lines = doc.splitTextToSize(value, width);

    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }

    y += 2;
  };

  const addLine = (label, value = "") => {
    const text = value && String(value).trim() ? String(value) : "-";
    const lines = doc.splitTextToSize(text, valueWidth);

    ensureSpace(Math.max(12, lines.length * lineHeight + 2));
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, labelX, y);
    doc.setFont("helvetica", "normal");

    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, valueX, y);
      y += lineHeight;
    }

    y += 2;
  };

  const addLongField = (label, value) => {
    addSection(label);
    addWrappedBlock(value || "-", left, fullWidth);
  };

  addTitle();

  addLine("Case Number", caseFile.caseNo);
  addLine("Title", caseFile.title);
  addLine("Case Type", caseFile.type);
  addLine("Status", caseFile.status);
  addLine("Priority", caseFile.priority);
  addLine("Classification", caseFile.classification);
  addLine("Lead Agent", caseFile.leadAgent || caseFile.assignee);
  addLine("Supervising Officer", caseFile.supervisor);
  addLine("Assigned Agents", (caseFile.assignedAgents || []).map(a => a.email || a.displayName || a).join(", "));
  addLine("Location", caseFile.location);
  addLine("Division", caseFile.department);
  addLine("Allowed Departments", (caseFile.allowedDepartments || []).join(", ") || "All");
  addLine("Tags", (caseFile.tags || []).join(", "));

  addLongField("Incident Narrative / Sachverhalt", caseFile.description);
  addLongField("Objective / Zielsetzung", caseFile.objective);

  addSection("Subjects / Persons of Interest");
  const subjects = [
    ...(caseFile.suspects || []).map(p => `- ${p.name || "-"}: ${p.info || "-"}`),
    ...(caseFile.personRefs || []).map(p => `- ${p.name || "-"} (${p.alias || "-"}) [${p.status || "-"} / ${p.riskLevel || "-"}]`)
  ].join("\n");
  addWrappedBlock(subjects || "No subjects recorded.");

  addSection("Evidence Registry");
  const evidenceList = caseFile.evidence || [];

  if (!evidenceList.length) {
    addWrappedBlock("No evidence records.");
  }

  for (const evidence of evidenceList) {
    ensureSpace(26);
    doc.setFont("helvetica", "bold");
    addWrappedBlock(`${evidence.id || "NO-ID"} · ${evidence.name || "Evidence"}`, left, fullWidth);
    doc.setFont("helvetica", "normal");

    addWrappedBlock([
      `Type: ${evidence.type || "-"}`,
      `Status: ${evidence.status || "SECURED"}`,
      `Source: ${evidence.source || "Unknown"}`,
      `Info: ${evidence.info || "-"}`
    ].join("\n"), 18, 172);

    if (evidence.image?.url) {
      const dataUrl = await imageToDataUrl(evidence.image.url);

      if (dataUrl) {
        ensureSpace(62);
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

    const chain = (evidence.chain || []).map(c => `- ${c.date || ""} ${c.by || ""}: ${c.text || ""}`).join("\n");
    if (chain) {
      addLine("Chain", chain);
    }

    y += 3;
  }

  addSection("Intelligence Relationships");
  addWrappedBlock((caseFile.relationships || []).map(r => `- ${r.fromName || "-"} -> ${r.toName || "-"} [${r.type || "-"}]: ${r.note || ""}`).join("\n") || "No relationships recorded.");

  addSection("Internal Reports");
  addWrappedBlock((caseFile.reports || []).map(r => `- ${r.id || "-"} ${r.title || "-"} [${r.type || "-"}] by ${r.createdBy || "-"}\n${r.content || ""}`).join("\n\n") || "No reports recorded.");

  addSection("Linked Cases");
  addWrappedBlock((caseFile.linkedCases || []).map(l => `- ${l.ref || "-"} (${l.addedAt || ""} ${l.by || ""})`).join("\n") || "No linked cases.");

  addSection("Investigation Milestones");
  addWrappedBlock((caseFile.milestones || []).map(m => `- ${m.date || ""} ${m.status || ""}: ${m.title || ""} — ${m.note || ""}`).join("\n") || "No milestones recorded.");

  addSection("Agent Notes");
  addWrappedBlock((caseFile.notes || []).map(n => `- ${n.date || ""} ${n.by || ""}: ${n.text || ""}`).join("\n") || "No notes recorded.");

  addSection("Operations Log");
  addWrappedBlock((caseFile.logbook || []).map(l => `- ${l.date || ""} ${l.by || ""}: ${l.text || ""}`).join("\n") || "No operations log recorded.");

  addSection("Audit Trail");
  addWrappedBlock((caseFile.activity || []).map(a => `- ${a.date || ""} ${a.by || ""}: ${a.text || ""}`).join("\n") || "No audit entries recorded.");

  doc.save(`${caseFile.caseNo || caseFile.title || "case-file"}.pdf`);
}
