/******************************************************
 *
 * IZA
 * File: SOW_Documents.gs
 *
 * Purpose:
 * Creates contractor SOW Google Doc drafts and final
 * pending-signature PDF files.
 *
 ******************************************************/


/************************************
 * CREATE GOOGLE DOC DRAFT
 ************************************/

function createContractorSowDraft_(sowData) {
  const templateFile =
    DriveApp.getFileById(CONTRACTOR_SOW_TEMPLATE_DOC_ID);

  const folder =
    DriveApp.getFolderById(CONTRACTOR_SOW_FOLDER_ID);

  const docName =
    String(sowData.fileName || "SOW Draft").replace(/\.pdf$/i, "");

  const copiedDoc = templateFile.makeCopy(
    docName,
    folder
  );

  const doc = DocumentApp.openById(copiedDoc.getId());
  const body = doc.getBody();

  fillContractorSowDocument_(body, sowData);

  doc.saveAndClose();

  return {
    id: copiedDoc.getId(),
    name: copiedDoc.getName(),
    url: copiedDoc.getUrl()
  };
}


/************************************
 * FINALIZE PDF
 ************************************/

function finalizeContractorSowPdf_(draftDocId, pdfFileName) {
  const folder =
    DriveApp.getFolderById(CONTRACTOR_SOW_FOLDER_ID);

  const draftFile =
    DriveApp.getFileById(draftDocId);

  const pdfBlob = draftFile
    .getBlob()
    .getAs(MimeType.PDF)
    .setName(pdfFileName);

  const pdfFile = folder.createFile(pdfBlob);

  return {
    id: pdfFile.getId(),
    name: pdfFile.getName(),
    url: pdfFile.getUrl()
  };
}


/************************************
 * FILL TEMPLATE
 ************************************/

function fillContractorSowDocument_(body, sowData) {
  replaceSowPlaceholder_(body, "{{Contractor Name}}", sowData.contractorName);
  replaceSowPlaceholder_(body, "{{Project Name}}", sowData.projectName);
  replaceSowPlaceholder_(body, "{{Start Date}}", sowData.startDate);
  replaceSowPlaceholder_(body, "{{End Date}}", sowData.endDate);
  replaceSowPlaceholder_(body, "{{Email}}", sowData.email);
  replaceSowPlaceholder_(body, "{{Phone}}", sowData.phone);
  replaceSowPlaceholder_(body, "{{Short Description}}", sowData.shortDescription);

  replaceSowPlaceholder_(body, "{{Role}}", sowData.roleSummary);
  replaceSowPlaceholder_(body, "{{Deliverables}}", sowData.deliverablesSummary);
  replaceSowPlaceholder_(body, "{{Hours to Contractor}}", String(sowData.totalHoursToContractor || 0));

  replaceSowPlaceholder_(body, "{{Scope of Services}}", sowData.scopeOfServices);
  replaceSowPlaceholder_(body, "{{Estimated Level of Effort}}", sowData.estimatedLevelOfEffort);

  replaceSowPlaceholder_(body, "{{Standard Rate}}", sowFormatMoney_(sowData.standardRate));
  replaceSowPlaceholder_(body, "{{Total Compensation Cap}}", sowFormatMoney_(sowData.totalCompensationCap));
  replaceSowPlaceholder_(body, "{{Date}}", sowData.date);
}


/************************************
 * PLACEHOLDER HELPERS
 ************************************/

function replaceSowPlaceholder_(element, placeholder, value) {
  element.replaceText(
    escapeSowRegex_(placeholder),
    value || ""
  );
}

function escapeSowRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sowFormatMoney_(value) {
  return "$" + Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}