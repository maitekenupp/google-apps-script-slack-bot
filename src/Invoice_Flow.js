/******************************************************
 *
 * IZA
 * File: Invoice_Flow.gs
 *
 * Purpose:
 * Contractor monthly invoice submission flow.
 *
 ******************************************************/

function handleInvoiceStart_(channelId, messageTs, userId) {
  
  if (!isInvoiceSubmissionWindowOpen_()) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildInvoiceMessageBlocks_(
        "💵 *Submit Invoice*\n\nInvoice submission is currently closed.",
        "menu_operations"
      ),
      "Invoice Closed"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceMessageBlocks_(
      "💵 *Submit Invoice*\n\nLoading your profile..."
    ),
    "Loading Invoice"
  );

  const contractor = findInvoiceContractorBySlackId_(userId);

  if (!contractor) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildInvoiceMessageBlocks_(
        "💵 *Submit Invoice*\n\nI could not find your contractor profile in Team Directory."
      ),
      "Submit Invoice"
    );
    return;
  }

  const session = {
    contractor,
    assignments: [],
    selectedAssignmentId: null,
    lineItems: [],
    billingPeriod: null,
    notes: "",
    payTo: contractor.payTo || ""
  };

  saveInvoiceSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoicePayToBlocks_(session),
    "Confirm Payment Info"
  );
}

function handleInvoiceAssignmentSelect_(payload, channelId, messageTs, userId) {
  const selectedAssignmentId =
    payload.actions?.[0]?.selected_option?.value || "";

  const session = getInvoiceSession_(userId);

  if (!session) {
    handleInvoiceStart_(channelId, messageTs, userId);
    return;
  }

  session.selectedAssignmentId = selectedAssignmentId;
  saveInvoiceSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceAssignmentSelectBlocks_(session),
    "Submit Invoice"
  );
}

function handleInvoiceOpenLineModal_(payload, channelId, messageTs, userId) {
  const session = getInvoiceSession_(userId);

  if (!session || !session.selectedAssignmentId) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildInvoiceAssignmentSelectBlocks_(session),
      "Submit Invoice"
    );
    return;
  }

  const privateMetadata = JSON.stringify({
    userId,
    channelId,
    messageTs
  });

  openSlackModal_(
    payload.trigger_id,
    buildInvoiceLineModalView_(privateMetadata, session)
  );
}

function handleInvoiceLineModalSubmission_(payload) {
  const metadata = JSON.parse(payload.view.private_metadata || "{}");
  const userId = metadata.userId;
  const channelId = metadata.channelId;
  const messageTs = metadata.messageTs;

  const session = getInvoiceSession_(userId);

  if (!session || !session.selectedAssignmentId) {
    return {
      response_action: "errors",
      errors: {
        hours_block: "Your invoice session expired. Please start again."
      }
    };
  }

  const values = payload.view.state.values;

  const hoursText =
    values.hours_block.hours_value.value || "";

  const hours = Number(hoursText);

  if (!hours || hours <= 0) {
    return {
      response_action: "errors",
      errors: {
        hours_block: "Enter a valid number of hours."
      }
    };
  }

  const description =
    values.description_block.description_value.value || "";

  const notes =
    values.notes_block.notes_value.value || "";

  const assignment = session.assignments.find(item =>
    item.id === session.selectedAssignmentId
  );

  if (!assignment) {
    return {
      response_action: "errors",
      errors: {
        hours_block: "I could not find this assignment anymore."
      }
    };
  }

  if (hours > assignment.remainingHours) {
    return {
      response_action: "errors",
      errors: {
        hours_block: `This assignment has ${assignment.remainingHours} remaining hours.`
      }
    };
  }

  const existingIndex = session.lineItems.findIndex(item =>
    item.assignmentId === assignment.id
  );

  const lineItem = {
    assignmentId: assignment.id,
    projectId: assignment.projectId,
    projectName: assignment.projectName,
    role: assignment.role,
    hours,
    contractedHours: assignment.hours,
    billedHistorical: assignment.billedHistorical,
    billedHours: assignment.billedHours,
    billedTotal: assignment.billedTotal,
    remainingHours: assignment.remainingHours,
    rate: assignment.rate,
    description,
    total: hours * assignment.rate
  };

  if (existingIndex >= 0) {
    session.lineItems[existingIndex] = lineItem;
  } else {
    session.lineItems.push(lineItem);
  }

  session.billingPeriod = invoiceLastDayOfCurrentMonth_();
  session.notes = notes;
  session.selectedAssignmentId = null;

  saveInvoiceSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceReviewBlocks_(session),
    "Review Invoice"
  );

  return {
    response_action: "clear"
  };
}

function invoiceLastDayOfCurrentMonth_() {
  const now = new Date();

  const year = Number(
    Utilities.formatDate(now, "America/Los_Angeles", "yyyy")
  );

  const month = Number(
    Utilities.formatDate(now, "America/Los_Angeles", "M")
  );

  const lastDay = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  return Utilities.formatDate(
    lastDay,
    "UTC",
    "yyyy-MM-dd"
  );
}

function handleInvoiceAddAnother_(channelId, messageTs, userId) {
  const session = getInvoiceSession_(userId);

  if (!session) {
    handleInvoiceStart_(channelId, messageTs, userId);
    return;
  }

  session.selectedAssignmentId = null;
  saveInvoiceSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceAssignmentSelectBlocks_(session),
    "Submit Invoice"
  );
}

function handleInvoiceEditLine_(payload, channelId, messageTs, userId) {
  const session = getInvoiceSession_(userId);

  if (!session) {
    handleInvoiceStart_(channelId, messageTs, userId);
    return;
  }

  const data = JSON.parse(payload.actions?.[0]?.value || "{}");
  session.selectedAssignmentId = data.assignmentId || null;

  saveInvoiceSession_(userId, session);

  handleInvoiceOpenLineModal_(payload, channelId, messageTs, userId);
}

function handleInvoiceRemoveLine_(payload, channelId, messageTs, userId) {
  const session = getInvoiceSession_(userId);

  if (!session) {
    handleInvoiceStart_(channelId, messageTs, userId);
    return;
  }

  const data = JSON.parse(payload.actions?.[0]?.value || "{}");
  const assignmentId = data.assignmentId;

  session.lineItems = (session.lineItems || []).filter(item =>
    item.assignmentId !== assignmentId
  );

  saveInvoiceSession_(userId, session);

  if (!session.lineItems.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildInvoiceAssignmentSelectBlocks_(session),
      "Submit Invoice"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceReviewBlocks_(session),
    "Review Invoice"
  );
}

function handleInvoiceCreateConfirm_(channelId, messageTs, userId) {
  const session = getInvoiceSession_(userId);

  if (!session || !session.lineItems || !session.lineItems.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildInvoiceMessageBlocks_(
        "💵 *Submit Invoice*\n\nI could not find your invoice draft. Please start again."
      ),
      "Submit Invoice"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceMessageBlocks_(
      "💵 *Submit Invoice*\n\nCreating your invoice PDF..."
    ),
    "Creating Invoice"
  );

  const contractor = session.contractor;
  const items = session.lineItems;
  const total = invoiceLineItemsTotal_(items);

  const billingPeriodRaw =
    session.billingPeriod || invoiceLastDayOfCurrentMonth_();

  const billingMonth = invoiceMonthKey_(billingPeriodRaw);
  const invoiceNumber = invoiceNumberFromMonth_(billingMonth);
  const invoiceName = `${contractor.name} - ${billingMonth}`;
  const fileName = `Invoice - ${contractor.name} - ${billingMonth}.pdf`;

  const requestedDateRaw = new Date().toISOString().slice(0, 10);
  const dueDateRaw = invoiceAddDaysFromDateString_(billingPeriodRaw, 30);

  const billingPeriodDisplay = invoiceFormatShortDate_(billingPeriodRaw);
  const requestedDateDisplay = invoiceFormatShortDate_(requestedDateRaw);
  const dueDateDisplay = invoiceFormatShortDate_(dueDateRaw);

  let invoice = findContractorInvoiceForMonth_(
    contractor.id,
    billingMonth
  );

  if (!invoice) {
    invoice = createContractorInvoice_({
      invoiceName,
      contractorId: contractor.id,
      status: "Submitted",
      billingPeriod: billingPeriodRaw,
      requestedDate: requestedDateRaw,
      dueDate: dueDateRaw,
      projectIds: items.map(item => item.projectId),
      assignmentIds: items.map(item => item.assignmentId),
      notes: session.notes
    });
  } else {
    updateContractorInvoiceRelations_(
      invoice.id,
      items.map(item => item.projectId),
      items.map(item => item.assignmentId),
      session.notes
    );
  }

  items.forEach(item => {
    createContractorInvoiceLineItem_({
      name: `${item.role} - ${item.projectName}`,
      invoiceId: invoice.id,
      contractorId: contractor.id,
      projectId: item.projectId,
      assignmentId: item.assignmentId,
      role: item.role,
      hours: item.hours,
      rate: item.rate,
      description: item.description
    });
  });

  const pdfFile = createContractorInvoicePdf_({
    invoiceName,
    invoiceNumber,
    fileName,
    contractorName: contractor.name,
    contractorEmail: contractor.email,
    payTo: session.payTo || contractor.payTo || "",
    billingPeriod: billingPeriodDisplay,
    requestedDate: requestedDateDisplay,
    dueDate: dueDateDisplay,
    items,
    notes: session.notes
  });

  updateContractorInvoiceFile_(
    invoice.id,
    pdfFile.name,
    pdfFile.url
  );

  clearInvoiceSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceCreatedBlocks_(invoice, items, total, contractor.email),
    "Invoice Submitted"
  );
}

function handleInvoiceCancel_(channelId, messageTs, userId) {
  clearInvoiceSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceMessageBlocks_(
      "💵 *Submit Invoice*\n\nInvoice submission canceled."
    ),
    "Invoice Canceled"
  );
}

/************************************
 * BLOCKS
 ************************************/

function buildInvoiceAssignmentSelectBlocks_(session) {
  const selected = session.assignments.find(item =>
    item.id === session.selectedAssignmentId
  );

  const text =
    "💵 *Submit Invoice*\n\n" +
    `*Contractor:* ${session.contractor.name}\n\n` +
    "Select the assignment you want to bill for.";

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "invoice_assignment_select",
          placeholder: {
            type: "plain_text",
            text: "Select assignment",
            emoji: true
          },
          options: session.assignments.slice(0, 100).map(item => ({
            text: {
              type: "plain_text",
              text: invoiceOptionText_(item),
              emoji: true
            },
            value: item.id
          }))
        }
      ]
    }
  ];

  if (selected) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Selected:* ${selected.projectName} - ${selected.role}\n` +
          `Contracted: ${selected.hours} hrs\n` +
          `Previously billed: ${selected.billedHistorical || 0} hrs\n` +
          `Current system billed: ${selected.billedHours || 0} hrs\n` +
          `Remaining: ${selected.remainingHours} hrs\n` +
          `Rate: ${invoiceFormatMoney_(selected.rate)}/hr`
      }
    });

    blocks.push({
      type: "actions",
      elements: [
        button_("✍️ Enter Hours", "invoice_open_line_modal"),
        button_("❌ Cancel", "invoice_cancel")
      ]
    });

    return blocks;
  }

  blocks.push({
    type: "actions",
    elements: [
      button_("❌ Cancel", "invoice_cancel")
    ]
  });

  return blocks;
}

function buildInvoiceLineModalView_(privateMetadata, session) {
  const existing = (session.lineItems || []).find(item =>
    item.assignmentId === session.selectedAssignmentId
  );

  return {
    type: "modal",
    callback_id: "invoice_line_submit",
    title: {
      type: "plain_text",
      text: "Invoice Hours",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Save",
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
        block_id: "hours_block",
        label: {
          type: "plain_text",
          text: "Hours Worked",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "hours_value",
          initial_value: existing ? String(existing.hours) : "",
          placeholder: {
            type: "plain_text",
            text: "Example: 5"
          }
        }
      },
      {
        type: "input",
        block_id: "description_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Work Description",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "description_value",
          initial_value: existing ? existing.description || "" : "",
          multiline: true
        }
      },
      {
        type: "input",
        block_id: "notes_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Invoice Notes",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "notes_value",
          initial_value: session.notes || "",
          multiline: true
        }
      }
    ]
  };
}

function buildInvoiceReviewBlocks_(session) {
  const items = session.lineItems || [];
  const total = invoiceLineItemsTotal_(items);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💵 *Review Invoice*\n\n" +
          `*Contractor:* ${session.contractor.name}\n` +
          `*Billing Period:* ${session.billingPeriod || "-"}\n\n` +
          buildInvoiceLineItemsSummaryText_(items) +
          `\n\n*Invoice Total:* ${invoiceFormatMoney_(total)}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("➕ Add Another", "invoice_add_another"),
        button_("✅ Submit Invoice", "invoice_create_confirm"),
        button_("❌ Cancel", "invoice_cancel")
      ]
    }
  ];
}

function buildInvoiceCreatedBlocks_(invoice, items, total, contractorEmail) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Invoice Submitted*\n\n" +
          "Your invoice PDF was submitted, a copy was shared with:\n" +
          `${contractorEmail || "your email on file"}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("💵 Submit Another", "invoice_start"),
        button_("🏠 Main Menu", "menu_main")
      ]
    }
  ];
}

function buildInvoiceMessageBlocks_(text, backActionId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    },
    {
      type: "actions",
      elements: [
        button_(
          backActionId ? "⬅️ Back" : "🏠 Main Menu",
          backActionId || "menu_main"
        )
      ]
    }
  ];
}

/************************************
 * DATA
 ************************************/

function findInvoiceContractorBySlackId_(userId) {
  const rows = queryAllDataSourceRows_(TEAM_DIRECTORY_DATA_SOURCE_ID);

  const match = rows.find(row => {
    const slackId = getText_(row.properties["Slack UID"]);
    return slackId === userId;
  });

  if (!match) return null;

  return {
    id: match.id,
    name: getText_(match.properties["Name"]),
    email: getText_(match.properties["Email"]),
    rate: getNumber_(match.properties["Standard Rate"]),
    payTo: getText_(match.properties["Pay To"])
  };
}

function loadInvoiceAssignmentsForContractor_(contractorName) {
  const rows = queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);
  const projectDataById = loadInvoiceProjectDataById_();

  return rows
    .map(row => {
      const p = row.properties;

      const name = getText_(p["Contractor"]);
      if (name.toLowerCase() !== contractorName.toLowerCase()) {
        return null;
      }

      const projectId =
        p["Projects 1 related to"]?.relation?.[0]?.id || "";

      const project = projectDataById[projectId];

      if (!project || project.status.toLowerCase() !== "in progress") {
        return null;
      }

      const roleNames = getMultiSelectNames_(p["Role"]);
      const role = roleNames.length
        ? roleNames.join(", ")
        : "General Work";

      const contractedHours = getNumber_(p["Hours to Contractor"]);
      const billedHistorical = getNumber_(p["Billed Historical"]);
      const billed = getNumber_(p["Billed"]);
      const billedTotal = billedHistorical + billed;

      const remainingHours =
        contractedHours > 0
          ? contractedHours - billedTotal
          : 0;

      return {
        id: row.id,
        contractorName: name,
        projectId,
        projectName: project.name,
        projectStatus: project.status,
        role,
        hours: contractedHours,
        billedHistorical,
        billedHours: billed,
        billedTotal,
        remainingHours,
        rate: getNumber_(p["Rate per Hour"])
      };
    })
    .filter(item =>
      item &&
      item.projectId &&
      item.remainingHours > 0
    )
    .sort((a, b) =>
      a.projectName.localeCompare(b.projectName) ||
      a.role.localeCompare(b.role)
    );
}

function loadInvoiceProjectDataById_() {
  const rows = queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);
  const projects = {};

  rows.forEach(row => {
    projects[row.id] = {
      name: getText_(row.properties["Project Name"]),
      status: getText_(row.properties["Project Status"])
    };
  });

  return projects;
}

/************************************
 * SESSION
 ************************************/

function saveInvoiceSession_(userId, session) {
  PropertiesService.getScriptProperties()
    .setProperty(
      `INVOICE_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getInvoiceSession_(userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(`INVOICE_SESSION_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearInvoiceSession_(userId) {
  PropertiesService.getScriptProperties()
    .deleteProperty(`INVOICE_SESSION_${userId}`);
}

/************************************
 * SMALL HELPERS
 ************************************/

function buildInvoiceLineItemsSummaryText_(items) {
  return (items || [])
    .map(item =>
      `*${item.projectName} - ${item.role}*\n` +
      `Hours this invoice: ${item.hours}\n` +
      `Contracted: ${item.contractedHours} hrs\n` +
      `Previously billed: ${item.billedHistorical || 0} hrs\n` +
      `Current system billed: ${item.billedHours || 0} hrs\n` +
      `Remaining before this invoice: ${item.remainingHours} hrs\n` +
      `Rate: ${invoiceFormatMoney_(item.rate)}/hr\n` +
      `Total: ${invoiceFormatMoney_(item.total)}`
    )
    .join("\n\n");
}

function invoiceLineItemsTotal_(items) {
  return (items || []).reduce((sum, item) => {
    return sum + Number(item.total || 0);
  }, 0);
}

function invoiceOptionText_(item) {
  const text = `${item.projectName} - ${item.role}`;

  return text.length > 75
    ? text.substring(0, 72) + "..."
    : text;
}

function invoiceFormatMoney_(value) {
  return "$" + Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function invoiceAddDays_(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

function handleInvoicePayToYes_(channelId, messageTs, userId) {
  const session = getInvoiceSession_(userId);

  if (!session) {
    handleInvoiceStart_(channelId, messageTs, userId);
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceMessageBlocks_(
      "💵 *Submit Invoice*\n\nLoading your available projects..."
    ),
    "Loading Invoice Projects"
  );

  const assignments = loadInvoiceAssignmentsForContractor_(
    session.contractor.name
  );

  if (!assignments.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildInvoiceMessageBlocks_(
        "💵 *Submit Invoice*\n\nI could not find available projects for invoicing."
      ),
      "Submit Invoice"
    );
    return;
  }

  session.assignments = assignments;
  saveInvoiceSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoiceAssignmentSelectBlocks_(session),
    "Submit Invoice"
  );
}

function handleInvoicePayToEdit_(payload, channelId, messageTs, userId) {
  const session = getInvoiceSession_(userId);

  if (!session) {
    handleInvoiceStart_(channelId, messageTs, userId);
    return;
  }

  const privateMetadata = JSON.stringify({
    userId,
    channelId,
    messageTs
  });

  openSlackModal_(
    payload.trigger_id,
    buildInvoicePayToModalView_(privateMetadata, session)
  );
}

function handleInvoicePayToModalSubmission_(payload) {
  const metadata = JSON.parse(payload.view.private_metadata || "{}");
  const userId = metadata.userId;
  const channelId = metadata.channelId;
  const messageTs = metadata.messageTs;

  const session = getInvoiceSession_(userId);

  if (!session) {
    return {
      response_action: "errors",
      errors: {
        pay_to_block: "Your invoice session expired. Please start again."
      }
    };
  }

  const values = payload.view.state.values;

  const payTo =
    values.pay_to_block.pay_to_value.value || "";

  session.payTo = payTo;
  session.contractor.payTo = payTo;

  updateTeamDirectoryPayTo_(
    session.contractor.id,
    payTo
  );

  saveInvoiceSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildInvoicePayToBlocks_(session),
    "Confirm Payment Info"
  );

  return {
    response_action: "clear"
  };
}

function buildInvoicePayToBlocks_(session) {
  const payToText =
    session.payTo && session.payTo.trim()
      ? session.payTo
      : "_No payment information saved yet._";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💵 *Submit Invoice*\n\n" +
          "*Payment information on file:*\n\n" +
          `${payToText}\n\n` +
          "Is this correct?"
      }
    },
    {
      type: "actions",
      elements: [
        button_("✅ Yes", "invoice_pay_to_yes"),
        button_("✏️ Edit", "invoice_pay_to_edit"),
        button_("❌ Cancel", "invoice_cancel")
      ]
    }
  ];
}

function buildInvoicePayToModalView_(privateMetadata, session) {
  const defaultPayTo =
    "Bank: put your bank name\n" +
    "Account: put your account information\n" +
    "Account number: XXX-XX-XX\n" +
    "Direct payment link: if exists";

  return {
    type: "modal",
    callback_id: "invoice_pay_to_submit",
    title: {
      type: "plain_text",
      text: "Payment Info",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Save",
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
        block_id: "pay_to_block",
        label: {
          type: "plain_text",
          text: "Pay To",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "pay_to_value",
          multiline: true,
          initial_value: session.payTo || defaultPayTo,
          placeholder: {
            type: "plain_text",
            text: "Enter your payment details"
          }
        }
      }
    ]
  };
}

function invoiceFormatShortDate_(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T12:00:00`);

  return Utilities.formatDate(
    date,
    "America/Los_Angeles",
    "MMM-dd-yy"
  );
}

function invoiceNumberFromMonth_(billingMonth) {
  if (!billingMonth) return "";

  const parts = billingMonth.split("-");
  const year = parts[0].slice(-2);
  const month = parts[1];

  return `${month}-${year}`;
}

function updateTeamDirectoryPayTo_(contractorId, payTo) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${contractorId}`,
    "patch",
    {
      properties: {
        "Pay To": {
          rich_text: [
            {
              text: {
                content: payTo || ""
              }
            }
          ]
        }
      }
    }
  );
}

function invoiceAddDaysFromDateString_(dateString, days) {
  const parts = String(dateString).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);

  return Utilities.formatDate(
    date,
    "UTC",
    "yyyy-MM-dd"
  );
}