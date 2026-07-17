/******************************************************
 *
 * IZA
 * File: Slack_Router.gs
 *
 * Purpose:
 * Routes Slack button clicks, dropdown selections, and modal submissions.
 *
 ******************************************************/


/************************************
 * BLOCK ACTION ROUTER
 ************************************/

function handleIzaButtonClick_(payload) {
  const context = getSlackActionContext_(payload);
  const actionId = context.actionId;

  if (!canUserRunSlackAction_(actionId, context)) {
    return;
  }

  if (routeMainMenuAction_(actionId, payload, context)) return;
  if (routeAdminMenuAction_(actionId, payload, context)) return;
  if (routeOperationsAction_(actionId, payload, context)) return;
  if (routeProjectStatusAction_(actionId, payload, context)) return;
  if (routeProjectCreationAction_(actionId, payload, context)) return;
  if (routeRoleCreationAction_(actionId, payload, context)) return;
  if (routeContractorAssignmentAction_(actionId, payload, context)) return;
  if (routePublicRoleClaimAction_(actionId, payload, context)) return;
  if (routeClaimsAdminAction_(actionId, payload, context)) return;
  if (routeClientAction_(actionId, payload, context)) return;
  if (routeExtensionAction_(actionId, payload, context)) return;
  if (routeExistingProjectAction_(actionId, payload, context)) return;
  if (routeInvoiceAction_(actionId, payload, context)) return;
  if (routeInvoiceAdminAction_(actionId, payload, context)) return;
  if (routeSowAction_(actionId, payload, context)) return;

  sendEphemeralMessage(
    context.channelId,
    context.userId,
    "I received that action, but it is not connected yet."
  );
}


/************************************
 * ACCESS CONTROL
 ************************************/

function canUserRunSlackAction_(actionId, context) {
  const publicActions = [
    "project_role_claim_start",
    "project_role_claim_submit_ephemeral",
    "role_claim_checkbox_select"
  ];

  const contractorActions = [
    "menu_main",
    "menu_operations",
    "menu_close",
    "bug_report_open",

    "invoice_start",
    "invoice_assignment_select",
    "invoice_assignment_previous",
    "invoice_open_line_modal",
    "invoice_create_confirm",
    "invoice_create_with_upload",
    "invoice_cancel",
    "invoice_pay_to_yes",
    "invoice_pay_to_edit",
    "invoice_add_another",
    "invoice_upload_cancel",
    "invoice_finish_review",

    "extension_start",
    "extension_assignment_select",
    "extension_previous",
    "extension_cancel",
    "extension_open_modal",
    "extension_cancel_request",

    "my_workload"
  ];

  if (publicActions.includes(actionId)) {
    return true;
  }

  if (contractorActions.includes(actionId)) {
    return requireIzaContractor_(context.userId, context.channelId);
  }

  return requireIzaAdmin_(context.userId, context.channelId);
}


/************************************
 * MAIN MENU ROUTES
 ************************************/

function routeMainMenuAction_(actionId, payload, context) {
  if (actionId === "menu_main") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildMainMenuBlocks_(context.userId),
      "IZA Main Menu"
    );
    return true;
  }

  if (actionId === "menu_close") {
    clearProjectSession_(context.userId);
    clearClientSession_(context.userId);

    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildGoodbyeBlocks_(context.userId),
      "Goodbye"
    );
    return true;
  }

  if (actionId === "bug_report_open") {
    openBugReportModal_(
      context.triggerId,
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  return false;
}


/************************************
 * ADMIN MENU ROUTES
 ************************************/

function routeAdminMenuAction_(actionId, payload, context) {
  if (actionId === "admin_menu") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildAdminMenuBlocks_(),
      "IZA Admin Menu"
    );
    return true;
  }

  if (
    actionId === "admin_projects_menu" ||
    actionId === "menu_projects" ||
    actionId === "projects_create_menu" ||
    actionId === "projects_admin_menu"
  ) {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return true;
  }

  if (actionId === "admin_contractors_menu") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildAdminContractorsMenuBlocks_(),
      "Admin Contractors"
    );
    return true;
  }

  if (actionId === "admin_invoices_menu") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildAdminInvoicesMenuBlocks_(),
      "Admin Invoices"
    );
    return true;
  }

  if (actionId === "ops_workload") {
    handleWorkloadReportButton_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "ops_contractor_workload") {
    handleContractorWorkloadButton_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "signature_summary") {
    showSignatureSummary_(
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "invoice_summary_admin") {
    showInvoiceSummaryAdmin_(
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "extension_admin_menu") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildComingSoonBlocks_("⏱️ Extension Requests", "admin_contractors_menu"),
      "Extension Requests"
    );
    return true;
  }

  return false;
}


/************************************
 * CONTRACTOR OPERATIONS ROUTES
 ************************************/

function routeOperationsAction_(actionId, payload, context) {
  if (actionId === "menu_operations") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildOperationsMenuBlocks_(),
      "IZA Operations Menu"
    );
    return true;
  }

  if (actionId === "my_workload") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildComingSoonBlocks_("👤 My Workload", "menu_operations"),
      "My Workload"
    );
    return true;
  }

  return false;
}


/************************************
 * PROJECT STATUS ROUTES
 ************************************/

function routeProjectStatusAction_(actionId, payload, context) {
  if (actionId === "projects_overview") {
    handleProjectsOverviewButton_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "project_status_update_start") {
    startProjectStatusUpdate_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "project_status_project_select") {
    handleProjectStatusProjectSelect_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "project_status_value_select") {
    handleProjectStatusValueSelect_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "project_status_confirm") {
    handleProjectStatusConfirm_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "project_status_cancel") {
    handleProjectStatusCancel_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  return false;
}


/************************************
 * PROJECT CREATION ROUTES
 ************************************/

function routeProjectCreationAction_(actionId, payload, context) {
  if (actionId === "project_new") {
    startProjectFlow_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_client_select") {
    handleProjectClientSelect_(payload);
    return true;
  }

  if (actionId === "project_client_next") {
    handleProjectClientNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_open_details_modal") {
    openProjectDetailsModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return true;
  }

  if (actionId === "project_details_previous") {
    handleProjectDetailsPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_details_next") {
    handleProjectDetailsNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (
    actionId === "project_start_date_select" ||
    actionId === "project_end_date_select"
  ) {
    handleProjectDateSelect_(payload);
    return true;
  }

  if (actionId === "project_dates_previous") {
    handleProjectDatesPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_dates_next") {
    handleProjectDatesNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (
    actionId === "project_status_quotation" ||
    actionId === "project_status_not_started" ||
    actionId === "project_status_in_progress"
  ) {
    handleProjectStatusSelect_(
      context.userId,
      context.channelId,
      context.messageTs,
      actionId
    );
    return true;
  }

  if (actionId === "project_status_previous") {
    handleProjectStatusPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_status_next") {
    handleProjectStatusNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_open_links_modal") {
    openProjectLinksModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return true;
  }

  if (actionId === "project_links_previous") {
    handleProjectLinksPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_links_next") {
    handleProjectLinksNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_review_previous") {
    handleProjectReviewPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_create_confirm") {
    handleProjectCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "project_create_cancel") {
    clearProjectSession_(context.userId);

    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return true;
  }

  return false;
}


/************************************
 * ROLE CREATION ROUTES
 ************************************/

function routeRoleCreationAction_(actionId, payload, context) {
  if (actionId === "role_create_start") {
    startRoleFlow_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "role_pricing_cdef") {
    handleRolePricingSelect_(
      context.userId,
      context.channelId,
      context.messageTs,
      true
    );
    return true;
  }

  if (actionId === "role_pricing_standard") {
    handleRolePricingSelect_(
      context.userId,
      context.channelId,
      context.messageTs,
      false
    );
    return true;
  }

  if (actionId === "role_select") {
    handleRoleSelect_(payload);
    return true;
  }

  if (actionId === "role_select_next") {
    handleRoleSelectNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "role_open_details_modal") {
    openRoleDetailsModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return true;
  }

  if (actionId === "role_details_previous") {
    handleRoleDetailsPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "role_details_next") {
    handleRoleDetailsNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "role_review_previous") {
    handleRoleReviewPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "role_add_to_list") {
    handleRoleAddToList_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "role_add_another") {
    handleRoleAddAnother_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "roles_create_confirm") {
    handleRolesCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "roles_cancel") {
    handleRolesCancel_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  return false;
}


/************************************
 * CONTRACTOR ASSIGNMENT ROUTES
 ************************************/

function routeContractorAssignmentAction_(actionId, payload, context) {
  if (actionId === "contractor_assign_start") {
    startContractorFlow_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "contractor_select") {
    handleContractorSelect_(payload);
    return true;
  }

  if (actionId === "contractor_previous") {
    handleContractorPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "contractor_next") {
    handleContractorNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "contractor_review_previous") {
    handleContractorReviewPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "contractor_create_confirm") {
    handleContractorCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "contractor_cancel") {
    handleContractorCancel_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  return false;
}


/************************************
 * PUBLIC ROLE CLAIM ROUTES
 ************************************/

function routePublicRoleClaimAction_(actionId, payload, context) {
  if (actionId === "project_role_claim_start") {
    openProjectRoleClaimModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId,
      context.actionValue
    );
    return true;
  }

  if (actionId === "project_role_claim_submit_ephemeral") {
    handleProjectRoleClaimEphemeralSubmit_(payload);
    return true;
  }

  if (actionId === "role_claim_checkbox_select") {
    return true;
  }

  return false;
}


/************************************
 * CLAIMS ADMIN ROUTES
 ************************************/

function routeClaimsAdminAction_(actionId, payload, context) {
  if (actionId === "claims_admin_menu") {
    showClaimsAdminMenu_(
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "claims_view_project") {
    handleClaimsViewProject_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return true;
  }

  if (actionId === "claims_view_role") {
    handleClaimsViewRole_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return true;
  }

  if (actionId === "claims_view_single_claim") {
    handleClaimsViewSingleClaim_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return true;
  }

  if (actionId === "claims_back_to_single_claim_message") {
    handleClaimsBackToSingleClaimMessage_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return true;
  }

  if (actionId === "claims_assign_person") {
    handleClaimsAssignPerson_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return true;
  }

  if (actionId === "claims_close_announcement") {
    handleClaimsCloseAnnouncement_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return true;
  }

  return false;
}


/************************************
 * CLIENT ROUTES
 ************************************/

function routeClientAction_(actionId, payload, context) {
  if (actionId === "client_new") {
    openClientModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return true;
  }

  if (actionId === "client_edit") {
    openClientEditModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return true;
  }

  if (actionId === "client_create_confirm") {
    handleClientCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "client_create_cancel") {
    clearClientSession_(context.userId);

    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return true;
  }

  return false;
}


/************************************
 * EXTENSION ROUTES
 ************************************/

function routeExtensionAction_(actionId, payload, context) {
  if (actionId === "extension_start") {
    handleExtensionStart_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "extension_assignment_select") {
    handleExtensionAssignmentSelect_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "extension_previous") {
    handleExtensionPrevious_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "extension_cancel") {
    handleExtensionCancel_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "extension_open_modal") {
    handleExtensionOpenModal_(
      payload,
      context.userId
    );
    return true;
  }

  if (actionId === "extension_approve") {
    handleExtensionApprove_(
      context.channelId,
      context.messageTs,
      context.userId,
      context.actionValue
    );
    return true;
  }

  if (actionId === "extension_deny") {
    handleExtensionDeny_(
      context.channelId,
      context.messageTs,
      context.userId,
      context.actionValue
    );
    return true;
  }

  if (actionId === "extension_cancel_request") {
    handleExtensionCancelRequest_(
      context.channelId,
      context.messageTs,
      context.userId,
      context.actionValue
    );
    return true;
  }

  if (actionId === "extension_finalize_amendment") {
    handleExtensionFinalizeAmendment_(
      context.channelId,
      context.messageTs,
      context.userId,
      context.actionValue
    );
    return true;
  }

  return false;
}


/************************************
 * EXISTING PROJECT ROUTES
 ************************************/

function routeExistingProjectAction_(actionId, payload, context) {
  if (actionId === "existing_project_add_roles") {
    showExistingProjectRoleSelect_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "existing_project_assign_contractors") {
    showExistingProjectContractorSelect_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return true;
  }

  if (actionId === "existing_project_roles_select") {
    handleExistingProjectRolesSelect_(payload);
    return true;
  }

  if (actionId === "existing_project_contractors_select") {
    handleExistingProjectContractorsSelect_(payload);
    return true;
  }

  return false;
}


/************************************
 * INVOICE ROUTES
 ************************************/

function routeInvoiceAction_(actionId, payload, context) {
  if (actionId === "invoice_start") {
    handleInvoiceStart_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_assignment_select") {
    handleInvoiceAssignmentSelect_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_assignment_previous") {
    handleInvoiceAssignmentPrevious_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_open_line_modal") {
    handleInvoiceOpenLineModal_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_create_confirm") {
    handleInvoiceCreateConfirm_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_create_with_upload") {
    handleInvoiceCreateConfirm_(
      context.channelId,
      context.messageTs,
      context.userId,
      true
    );
    return true;
  }

  if (actionId === "invoice_cancel") {
    handleInvoiceCancel_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_pay_to_yes") {
    handleInvoicePayToYes_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_pay_to_edit") {
    handleInvoicePayToEdit_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_add_another") {
    handleInvoiceAddAnother_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_upload_cancel") {
    handleInvoiceUploadCancel_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_finish_review") {
    handleInvoiceFinishReview_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  return false;
}


/************************************
 * INVOICE ADMIN ROUTES
 ************************************/

function routeInvoiceAdminAction_(actionId, payload, context) {
  if (actionId === "invoice_window_admin") {
    handleInvoiceWindowAdmin_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_window_open_modal") {
    handleInvoiceWindowOpenModal_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "invoice_window_close") {
    handleInvoiceWindowClose_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  return false;
}


/************************************
 * SOW ROUTES
 ************************************/

function routeSowAction_(actionId, payload, context) {
  if (actionId === "sow_generate_for_project") {
    handleSowGenerateForProject_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  if (actionId === "sow_finalize_for_project") {
    handleSowFinalizeForProject_(
      payload,
      context.channelId,
      context.messageTs,
      context.userId
    );
    return true;
  }

  return false;
}


/************************************
 * ADMIN SUMMARY HELPERS
 ************************************/

function showInvoiceSummaryAdmin_(channelId, messageTs) {
  const summary = buildInvoiceWindowCloseSummary_();

  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: summary
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "admin_invoices_menu")
        ]
      }
    ],
    "Invoice Summary"
  );
}

function showSignatureSummary_(channelId, messageTs) {
  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "📄 *Signature Summary*\n\n" +
            "Checking pending and signed documents..."
        }
      }
    ],
    "Loading Signature Summary"
  );

  const result = scanHelloSignRequestedSignatures_();

  if (
    !result.signed.length &&
    !result.pendingToSend.length &&
    !result.awaitingSignature.length
  ) {
    updateIzaMenu(
      channelId,
      messageTs,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "📄 *Signature Summary*\n\n" +
              "No pending signature documents found."
          }
        },
        {
          type: "actions",
          elements: [
            button_("⬅️ Back", "admin_menu")
          ]
        }
      ],
      "Signature Summary"
    );
    return;
  }

  const blocks = buildSowSignatureFolderSummaryBlocks_(result);

  blocks.push({
    type: "actions",
    elements: [
      button_("⬅️ Back", "admin_menu")
    ]
  });

  updateIzaMenu(
    channelId,
    messageTs,
    blocks,
    "Signature Summary"
  );
}


/************************************
 * MODAL SUBMISSION ROUTER
 ************************************/

function handleSlackViewSubmission_(payload) {
  const callbackId = payload.view.callback_id;

  if (callbackId === "project_details_submit") {
    return handleProjectDetailsSubmit_(payload);
  }

  if (callbackId === "project_links_submit") {
    return handleProjectLinksSubmit_(payload);
  }

  if (callbackId === "role_details_submit") {
    return handleRoleDetailsSubmit_(payload);
  }

  if (callbackId === "project_role_claim_submit") {
    return handleProjectRoleClaimSubmit_(payload);
  }

  if (callbackId === "extension_request_submit") {
    return handleExtensionRequestModalSubmit_(payload);
  }

  if (callbackId === "client_modal_submit") {
    return handleClientModalSubmit_(payload);
  }

  if (callbackId === "invoice_line_submit") {
    return handleInvoiceLineModalSubmission_(payload);
  }

  if (callbackId === "invoice_pay_to_submit") {
    return handleInvoicePayToModalSubmission_(payload);
  }

  if (callbackId === "invoice_window_submit") {
    return handleInvoiceWindowModalSubmission_(payload);
  }

  if (callbackId === "bug_report_submit") {
    return handleBugReportModalSubmit_(payload);
  }

  return {
    response_action: "clear"
  };
}


/************************************
 * CONTEXT PARSER
 ************************************/

function getSlackActionContext_(payload) {
  const action = payload.actions[0];

  return {
    actionId: action.action_id,
    actionValue: action.value || null,
    triggerId: payload.trigger_id || null,

    channelId:
      payload.channel?.id ||
      payload.container?.channel_id ||
      payload.view?.private_metadata?.channelId ||
      null,

    messageTs:
      payload.message?.ts ||
      payload.container?.message_ts ||
      payload.view?.private_metadata?.messageTs ||
      null,

    userId:
      payload.user?.id || null
  };
}