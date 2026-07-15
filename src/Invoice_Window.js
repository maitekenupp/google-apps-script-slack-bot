/******************************************************
 *
 * IZA
 * File: Invoice_Window.gs
 *
 * Purpose:
 * Controls contractor invoice submission window.
 *
 ******************************************************/

function handleInvoiceWindowAdmin_(channelId, messageTs, userId) {
  const window = getInvoiceSubmissionWindow_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceWindowAdminBlocks_(window),
    "Invoice Window"
  );
}

function handleInvoiceWindowOpenModal_(payload, channelId, messageTs, userId) {
  const window = getInvoiceSubmissionWindow_();

  const privateMetadata = JSON.stringify({
    channelId,
    messageTs,
    userId
  });

  openSlackModal_(
    payload.trigger_id,
    buildInvoiceWindowModalView_(privateMetadata, window)
  );
}

function handleInvoiceWindowModalSubmission_(payload) {
  const metadata = JSON.parse(payload.view.private_metadata || "{}");
  const channelId = metadata.channelId;
  const messageTs = metadata.messageTs;

  const values = payload.view.state.values;

  const startDate =
    values.start_date_block.start_date_value.selected_date;

  const endDate =
    values.end_date_block.end_date_value.selected_date;

  if (!startDate || !endDate) {
    return {
      response_action: "errors",
      errors: {
        start_date_block: "Select both start and end dates."
      }
    };
  }

  if (endDate < startDate) {
    return {
      response_action: "errors",
      errors: {
        end_date_block: "End date must be after start date."
      }
    };
  }

  saveInvoiceSubmissionWindow_(startDate, endDate);

  const window = getInvoiceSubmissionWindow_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceWindowAdminBlocks_(window),
    "Invoice Window"
  );

  postInvoiceWindowAnnouncement_(window);

  return {
    response_action: "clear"
  };
}

function handleInvoiceWindowClose_(channelId, messageTs, userId) {
  closeInvoiceSubmissionWindow_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceWindowAdminBlocks_(getInvoiceSubmissionWindow_()),
    "Invoice Window"
  );

  postSlackMessage_(
    CONTRACTOR_OPPORTUNITIES_CHANNEL,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "🔒 *Invoice submission is now closed.*\n\n" +
            "New contractor invoices are no longer being accepted."
        }
      }
    ],
    "Invoice submission is now closed."
  );
}

/************************************
 * BLOCKS
 ************************************/

function buildInvoiceWindowAdminBlocks_(window) {
  const statusText = window.isOpen
    ? "🟢 Open"
    : "🔴 Closed";

  const datesText =
    window.startDate && window.endDate
      ? `${invoiceWindowFormatDate_(window.startDate)} to ${invoiceWindowFormatDate_(window.endDate)}`
      : "No window configured";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🗓️ *Invoice Submission Window*\n\n" +
          `*Status:* ${statusText}\n` +
          `*Dates:* ${datesText}\n\n` +
          "Contractors can submit invoices only while this window is open."
      }
    },
    {
      type: "actions",
      elements: [
        button_("🗓️ Set Dates", "invoice_window_open_modal"),
        button_("🔒 Close Now", "invoice_window_close")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "projects_admin_menu")
      ]
    }
  ];
}

function buildInvoiceWindowModalView_(privateMetadata, window) {
  return {
    type: "modal",
    callback_id: "invoice_window_submit",
    title: {
      type: "plain_text",
      text: "Invoice Window",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Open",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    private_metadata: privateMetadata,
    blocks: [
      {
        type: "input",
        block_id: "start_date_block",
        label: {
          type: "plain_text",
          text: "Start Date",
          emoji: true
        },
        element: {
          type: "datepicker",
          action_id: "start_date_value",
          initial_date: window.startDate || invoiceWindowToday_()
        }
      },
      {
        type: "input",
        block_id: "end_date_block",
        label: {
          type: "plain_text",
          text: "End Date",
          emoji: true
        },
        element: {
          type: "datepicker",
          action_id: "end_date_value",
          initial_date: window.endDate || invoiceWindowToday_()
        }
      }
    ]
  };
}

/************************************
 * WINDOW STATE
 ************************************/

function saveInvoiceSubmissionWindow_(startDate, endDate) {
  const props = PropertiesService.getScriptProperties();

  props.setProperty("INVOICE_WINDOW_START", startDate);
  props.setProperty("INVOICE_WINDOW_END", endDate);
}

function closeInvoiceSubmissionWindow_() {
  const props = PropertiesService.getScriptProperties();

  props.deleteProperty("INVOICE_WINDOW_START");
  props.deleteProperty("INVOICE_WINDOW_END");
}

function getInvoiceSubmissionWindow_() {
  const props = PropertiesService.getScriptProperties();

  const startDate = props.getProperty("INVOICE_WINDOW_START");
  const endDate = props.getProperty("INVOICE_WINDOW_END");
  const today = invoiceWindowToday_();

  const isOpen =
    startDate &&
    endDate &&
    today >= startDate &&
    today <= endDate;

  return {
    startDate,
    endDate,
    today,
    isOpen
  };
}

function isInvoiceSubmissionWindowOpen_() {
  return getInvoiceSubmissionWindow_().isOpen;
}

/************************************
 * ANNOUNCEMENT
 ************************************/

function postInvoiceWindowAnnouncement_(window) {
  postSlackMessage_(
    CONTRACTOR_OPPORTUNITIES_CHANNEL,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            ":loudspeaker: *Invoice & Payment Process Update*\n\n" +
            "Hi <!everyone>!\n\n" +
            "We are officially on the submission window:\n" +
            `→ *Submission window:* ${invoiceWindowFormatLongDate_(window.startDate)} – ${invoiceWindowFormatLongDate_(window.endDate)}\n\n` +
            "To submit your invoice, talk to IZA and go to:\n" +
            "*Operations* → *Submit Invoice*\n\n" +
            `Invoices submitted after ${invoiceWindowFormatLongDate_(window.endDate)} will be processed in the next month’s payment cycle.\n` +
            "Invoices will be processed after the window is closed.\n\n" +
            "Thank you all for your cooperation :pray:\n" +
            "Please react to this message to confirm you read it!"
        }
      }
    ],
    "Invoice & Payment Process Update"
  );
}

/************************************
 * HELPERS
 ************************************/

function invoiceWindowToday_() {
  return Utilities.formatDate(
    new Date(),
    "America/Los_Angeles",
    "MMMM d, yyyy"
  );
}

function invoiceWindowFormatDate_(dateString) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T12:00:00Z`);

  return Utilities.formatDate(
    date,
    "UTC",
    "MMMM d, yyyy"
  );
}

function invoiceWindowFormatLongDate_(dateString) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T12:00:00Z`);

  const month = Utilities.formatDate(
    date,
    "UTC",
    "MMMM"
  );

  const day = Number(
    Utilities.formatDate(
      date,
      "UTC",
      "d"
    )
  );

  return `${month} ${day}${invoiceWindowOrdinalSuffix_(day)}`;
}

function invoiceWindowOrdinalSuffix_(day) {
  if (day >= 11 && day <= 13) return "th";

  const lastDigit = day % 10;

  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";

  return "th";
}