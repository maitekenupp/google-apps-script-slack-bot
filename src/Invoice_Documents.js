/******************************************************
 *
 * IZA
 * File: Invoice_Documents.gs
 *
 * Purpose:
 * Creates contractor invoice PDFs from Google Docs
 * templates and emails the PDF copy to the contractor.
 *
 ******************************************************/


/************************************
 * CREATE INVOICE PDF
 ************************************/

function createContractorInvoicePdf_(invoiceData) {
  const templateFile =
    DriveApp.getFileById(CONTRACTOR_INVOICE_TEMPLATE_DOC_ID);

  const folder =
    DriveApp.getFolderById(CONTRACTOR_INVOICE_FOLDER_ID);

  const docName =
    String(invoiceData.fileName || "Invoice.pdf").replace(/\.pdf$/i, "");

  const copiedDoc = templateFile.makeCopy(
    docName,
    folder
  );

  const doc = DocumentApp.openById(copiedDoc.getId());
  const body = doc.getBody();

  fillContractorInvoiceDocument_(body, invoiceData);

  doc.saveAndClose();

  const pdfFile = createInvoicePdfFromCopiedDoc_(
    copiedDoc,
    folder,
    invoiceData.fileName
  );

  shareInvoicePdfWithContractor_(
    pdfFile.getId(),
    invoiceData.contractorEmail
  );

  sendContractorInvoiceEmail_(invoiceData, {
    name: pdfFile.getName(),
    url: pdfFile.getUrl()
  });

  copiedDoc.setTrashed(true);

  return {
    id: pdfFile.getId(),
    name: pdfFile.getName(),
    url: pdfFile.getUrl()
  };
}

function fillContractorInvoiceDocument_(body, invoiceData) {
  const items = invoiceData.items || [];

  const totalHours = items.reduce((sum, item) => {
    return sum + Number(item.hours || 0);
  }, 0);

  const totalAmount = items.reduce((sum, item) => {
    return sum + Number(item.total || 0);
  }, 0);

  replaceInvoicePlaceholder_(body, "{{Invoice Name}}", invoiceData.invoiceName);
  replaceInvoicePlaceholder_(body, "{{Invoice Number}}", invoiceData.invoiceNumber);
  replaceInvoicePlaceholder_(body, "{{Contractor Name}}", invoiceData.contractorName);
  replaceInvoicePlaceholder_(body, "{{Contractor Email}}", invoiceData.contractorEmail);
  replaceInvoicePlaceholder_(body, "{{Pay To}}", invoiceData.payTo);
  replaceInvoicePlaceholder_(body, "{{Billing Period}}", invoiceData.billingPeriod);
  replaceInvoicePlaceholder_(body, "{{Requested Date}}", invoiceData.requestedDate);
  replaceInvoicePlaceholder_(body, "{{Due Date}}", invoiceData.dueDate);
  replaceInvoicePlaceholder_(body, "{{Total Hours}}", String(totalHours));
  replaceInvoicePlaceholder_(body, "{{Total Amount}}", invoiceFormatMoney_(totalAmount));
  replaceInvoicePlaceholder_(body, "{{Notes}}", invoiceData.notes || "");

  fillInvoiceLineItemsTable_(body, items);
}

function createInvoicePdfFromCopiedDoc_(copiedDoc, folder, fileName) {
  const pdfBlob = copiedDoc
    .getBlob()
    .getAs(MimeType.PDF)
    .setName(fileName || `${copiedDoc.getName()}.pdf`);

  return folder.createFile(pdfBlob);
}

function shareInvoicePdfWithContractor_(pdfFileId, contractorEmail) {
  if (!contractorEmail) return;

  Utilities.sleep(1000);

  Drive.Permissions.create(
    {
      role: "reader",
      type: "user",
      emailAddress: contractorEmail
    },
    pdfFileId,
    {
      sendNotificationEmail: false,
      supportsAllDrives: true
    }
  );
}


/************************************
 * LINE ITEMS
 ************************************/

function fillInvoiceLineItemsTable_(body, items) {
  const tables = body.getTables();

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const table = tables[tableIndex];

    for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
      const row = table.getRow(rowIndex);
      const rowText = row.getText();

      if (rowText.indexOf("{{Line Description}}") === -1) {
        continue;
      }

      insertInvoiceLineItemRows_(
        table,
        rowIndex,
        row,
        items
      );

      return;
    }
  }

  replaceInvoicePlaceholder_(
    body,
    "{{Line Items}}",
    buildInvoiceDocumentLineItemsText_(items)
  );
}

function insertInvoiceLineItemRows_(table, rowIndex, templateRow, items) {
  const templateCells = [];

  for (let cellIndex = 0; cellIndex < templateRow.getNumCells(); cellIndex++) {
    templateCells.push(templateRow.getCell(cellIndex).copy());
  }

  table.removeRow(rowIndex);

  (items || []).forEach((item, itemIndex) => {
    const newRow = table.insertTableRow(rowIndex + itemIndex);

    templateCells.forEach(cellCopy => {
      newRow.appendTableCell(cellCopy.copy());
    });

    replaceInvoicePlaceholder_(
      newRow,
      "{{Line Description}}",
      `${item.projectName} - ${item.role}`
    );

    replaceInvoicePlaceholder_(
      newRow,
      "{{Line Rate}}",
      invoiceFormatMoney_(item.rate)
    );

    replaceInvoicePlaceholder_(
      newRow,
      "{{Line Hours}}",
      String(item.hours)
    );

    replaceInvoicePlaceholder_(
      newRow,
      "{{Line Total}}",
      invoiceFormatMoney_(item.total)
    );
  });
}

function buildInvoiceDocumentLineItemsText_(items) {
  return (items || [])
    .map(item => {
      return [
        `${item.projectName} - ${item.role}`,
        `Rate: ${invoiceFormatMoney_(item.rate)}`,
        `Hours: ${item.hours}`,
        `Amount: ${invoiceFormatMoney_(item.total)}`,
        item.description ? `Description: ${item.description}` : null
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}


/************************************
 * EMAIL
 ************************************/

function sendContractorInvoiceEmail_(invoiceData, pdfFile) {
  if (!invoiceData.contractorEmail) return;

  const financeEmail = IZA_FINANCE_EMAIL;

  const subject =
    `Invoice submitted - ${invoiceData.invoiceNumber}`;

  const body =
    `Hi ${invoiceData.contractorName},\n\n` +
    "Your invoice was submitted.\n\n" +
    "Here is a copy of your invoice:\n" +
    `${pdfFile.url}\n\n` +
    "This is an automatic email sent by IZA. Please do not reply to this email.\n\n" +
    "If you have any questions, contact Maite at:\n" +
    `${financeEmail}\n\n` +
    "Thank you,\n" +
    "IZA Finance";

  MailApp.sendEmail({
    to: invoiceData.contractorEmail,
    subject,
    body,
    name: "IZA Finance"
  });
}


/************************************
 * PLACEHOLDER HELPERS
 ************************************/

function replaceInvoicePlaceholder_(element, placeholder, value) {
  element.replaceText(
    escapeInvoiceRegex_(placeholder),
    value || ""
  );
}

function escapeInvoiceRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}