/******************************************************
 *
 * IZA
 * File: Slack_Blocks.gs
 *
 * Purpose:
 * Builds shared Slack Block Kit UI components and menus.
 *
 ******************************************************/


/************************************
 * SHARED BUTTON HELPERS
 ************************************/

function button_(text, actionId) {
  return {
    type: "button",
    text: {
      type: "plain_text",
      text,
      emoji: true
    },
    action_id: actionId,
    value: actionId
  };
}

function primaryButton_(text, actionId) {
  const button = button_(text, actionId);
  button.style = "primary";
  return button;
}

function dangerButton_(text, actionId) {
  const button = button_(text, actionId);
  button.style = "danger";
  return button;
}


/************************************
 * MAIN MENU
 ************************************/

function buildMainMenuBlocks_(userId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `Hi <@${userId}> 👋\n\n` +
          "How can I help you today?"
      }
    },
    {
      type: "actions",
      elements: [
        button_("🛠️ Admin", "admin_menu"),
        button_("👤 Operations", "menu_operations"),
        button_("🐞 Report Bug", "bug_report_open")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("👋 Bye IZA", "menu_close")
      ]
    }
  ];
}


/************************************
 * ADMIN MENUS
 ************************************/

function buildAdminMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🛠️ *Admin*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("📊 Portfolio Overview", "ops_workload"),
        button_("📁 Projects", "admin_projects_menu"),
        button_("👥 Contractors", "admin_contractors_menu"),
        button_("💵 Invoices", "admin_invoices_menu"),
        button_("📄 Signature Summary", "signature_summary")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_main")
      ]
    }
  ];
}

function buildAdminProjectsMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📁 *Admin / Projects*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("📋 Projects Overview", "projects_overview"),
        button_("🏢 New Client", "client_new")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("➕ New Project", "project_new"),
        button_("👥 Add Roles", "existing_project_add_roles"),
        button_("👷 Assign Contractors", "existing_project_assign_contractors")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_menu")
      ]
    }
  ];
}

function buildAdminContractorsMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "👥 *Admin / Contractors*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("👤 Contractor Workload", "ops_contractor_workload"),
        button_("📌 Role Claims", "claims_admin_menu"),
        button_("⏱️ Extension Requests", "extension_admin_menu")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_menu")
      ]
    }
  ];
}

function buildAdminInvoicesMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "💵 *Admin / Invoices*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("🗓️ Invoice Window", "invoice_window_admin"),
        button_("📊 Invoice Summary", "invoice_summary_admin")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_menu")
      ]
    }
  ];
}


/************************************
 * CONTRACTOR OPERATIONS MENU
 ************************************/

function buildOperationsMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "👤 *Operations*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("👤 My Workload", "my_workload"),
        button_("💵 Submit Invoice", "invoice_start"),
        button_("⏱️ Request Extension", "extension_start")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_main")
      ]
    }
  ];
}


/************************************
 * BACKWARD COMPATIBILITY MENUS
 ************************************/

function buildProjectsMenuBlocks_() {
  return buildAdminProjectsMenuBlocks_();
}

function buildProjectsCreateMenuBlocks_() {
  return buildAdminProjectsMenuBlocks_();
}

function buildProjectsAdminMenuBlocks_() {
  return buildAdminProjectsMenuBlocks_();
}


/************************************
 * SIMPLE MESSAGE BLOCKS
 ************************************/

function buildGoodbyeBlocks_(userId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `👋 Bye <@${userId}>!\n\n` +
          "Whenever you need me again, just say *Hi IZA*."
      }
    }
  ];
}

function buildComingSoonBlocks_(title, backActionId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${title}*\n\n` +
          "This feature is not connected yet."
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", backActionId || "menu_main")
      ]
    }
  ];
}