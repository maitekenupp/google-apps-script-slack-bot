/******************************************************
 *
 * IZA
 * File: Invoice_Documents.gs
 *
 * Purpose:
 * Creates contractor invoice PDFs from Google Docs templates.
 *
 ******************************************************/

function createContractorInvoicePdf_(invoiceData) {
  const templateFile =
    DriveApp.getFileById(CONTRACTOR_INVOICE_TEMPLATE_DOC_ID);

  const folder =
    DriveApp.getFolderById(CONTRACTOR_INVOICE_FOLDER_ID);

  const docName = invoiceData.fileName.replace(/\.pdf$/i, "");

  const copiedDoc = templateFile.makeCopy(
    docName,
    folder
  );

  const doc = DocumentApp.openById(copiedDoc.getId());
  const body = doc.getBody();

  const totalHours = invoiceData.items.reduce((sum, item) => {
    return sum + Number(item.hours || 0);
  }, 0);

  const totalAmount = invoiceData.items.reduce((sum, item) => {
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

  fillInvoiceLineItemsTable_(body, invoiceData.items);

  doc.saveAndClose();

  const pdfBlob = copiedDoc
    .getBlob()
    .getAs(MimeType.PDF)
    .setName(invoiceData.fileName);

  const pdfFile = folder.createFile(pdfBlob);

  Utilities.sleep(1000);

  if (invoiceData.contractorEmail) {
    Drive.Permissions.create(
      {
        role: "reader",
        type: "user",
        emailAddress: invoiceData.contractorEmail
      },
      pdfFile.getId(),
      {
        sendNotificationEmail: false,
        supportsAllDrives: true
      }
    );
  }

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

      const templateCells = [];

      for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex++) {
        templateCells.push(row.getCell(cellIndex).copy());
      }

      table.removeRow(rowIndex);

      items.forEach((item, itemIndex) => {
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

      return;
    }
  }

  replaceInvoicePlaceholder_(
    body,
    "{{Line Items}}",
    buildInvoiceDocumentLineItemsText_(items)
  );
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

function replaceInvoicePlaceholder_(element, placeholder, value) {
  element.replaceText(
    escapeInvoiceRegex_(placeholder),
    value || ""
  );
}

function escapeInvoiceRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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