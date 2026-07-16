/******************************************************
 *
 * IZA
 * File: Invoice_FileUpload.gs
 *
 * Purpose:
 * Handles optional contractor invoice file uploads after
 * an invoice has already been submitted by IZA.
 *
 ******************************************************/

function savePendingInvoiceUpload_(userId, data) {
  PropertiesService.getScriptProperties()
    .setProperty(
      `PENDING_INVOICE_UPLOAD_${userId}`,
      JSON.stringify(data)
    );
}

function getPendingInvoiceUpload_(userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(`PENDING_INVOICE_UPLOAD_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearPendingInvoiceUpload_(userId) {
  PropertiesService.getScriptProperties()
    .deleteProperty(`PENDING_INVOICE_UPLOAD_${userId}`);
}

function buildInvoiceUploadWaitingBlocks_(invoiceName) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📎 *Invoice submitted*\n\n" +
          `I created your IZA invoice and will attach your uploaded file to: *${invoiceName}*.\n\n` +
          "⬇️ Please upload your invoice file in this chat below.\n" +
          "*Upload only the file, with no extra message.*\n\n" +
          "The uploaded invoice must match the amount you declared in IZA."
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "No upload needed",
          emoji: true
        },
        action_id: "invoice_upload_cancel"
      }
    }
  ];
}

function handleInvoiceUploadCancel_(channelId, messageTs, userId) {
  clearPendingInvoiceUpload_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "✅ *Invoice submitted*\n\n" +
            "No additional invoice file will be uploaded.\n\n" +
            "Everything is set."
        }
      },
      {
        type: "actions",
        elements: [
          button_("👋 Bye IZA", "menu_close")
        ]
      }
    ],
    "Invoice Submitted"
  );
}

function handlePendingInvoiceUploadFromSlackFile_(fileId) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SLACK_BOT_TOKEN");

  const fileInfoResponse = UrlFetchApp.fetch(
    `https://slack.com/api/files.info?file=${fileId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      muteHttpExceptions: true
    }
  );

  const fileInfo = JSON.parse(fileInfoResponse.getContentText());

  if (!fileInfo.ok) {
    return false;
  }

  const file = fileInfo.file;
  const userId = file.user;

  const pending = getPendingInvoiceUpload_(userId);

  if (!pending) {
    return false;
  }

  const downloadUrl =
    file.url_private_download ||
    file.url_private;

  if (!downloadUrl) {
    throw new Error("No invoice upload download URL found.");
  }

  const fileResponse = UrlFetchApp.fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    muteHttpExceptions: true
  });

  if (fileResponse.getResponseCode() !== 200) {
    throw new Error(
      `Invoice upload download failed (${fileResponse.getResponseCode()})`
    );
  }

  const originalName = file.name || "Uploaded Invoice";
  const savedFileName = invoiceSafeUploadedFileName_(
    `${pending.invoiceName} - Contractor Upload - ${originalName}`
  );

  const blob = fileResponse
    .getBlob()
    .setName(savedFileName);

  const folder =
    DriveApp.getFolderById(CONTRACTOR_INVOICE_FOLDER_ID);

  const savedFile = folder.createFile(blob);

  updateInvoiceFilesWithUploadedFile_(
    pending.invoiceId,
    pending.generatedInvoiceFileName,
    pending.generatedInvoiceFileUrl,
    savedFile.getName(),
    savedFile.getUrl()
  );

  clearPendingInvoiceUpload_(userId);

  updateIzaMenu(
    pending.channelId,
    pending.messageTs,
    buildInvoiceUploadCompletedBlocks_(pending.invoiceName),
    "Invoice File Attached"
  );

  return true;
}

function updateInvoiceFilesWithUploadedFile_(
    invoiceId,
    generatedFileName,
    generatedFileUrl,
    uploadedFileName,
    uploadedFileUrl
  ) {
  const files = [];

  if (generatedFileName && generatedFileUrl) {
    files.push({
      name: generatedFileName,
      type: "external",
      external: {
        url: generatedFileUrl
      }
    });
  }

  files.push({
    name: uploadedFileName,
    type: "external",
    external: {
      url: uploadedFileUrl
    }
  });

  return notionFetch_(
    `https://api.notion.com/v1/pages/${invoiceId}`,
    "patch",
    {
      properties: {
        "Invoice File": {
          files
        }
      }
    }
  );
}

function invoiceSafeUploadedFileName_(name) {
  return String(name || "Uploaded Invoice")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .substring(0, 180);
}

function buildInvoiceUploadCompletedBlocks_(invoiceName) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Invoice file attached*\n\n" +
          `Your uploaded file was attached to: *${invoiceName}*.`
      }
    },
    {
      type: "actions",
      elements: [
        button_("👋 Bye IZA", "menu_close")
      ]
    }
  ];
}