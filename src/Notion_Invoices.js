/******************************************************
 *
 * IZA
 * File: Notion_Invoices.gs
 *
 * Purpose:
 * Creates and updates contractor invoice records and
 * contractor invoice line items in Notion.
 *
 ******************************************************/


/************************************
 * CONTRACTOR INVOICE
 ************************************/

function createContractorInvoice_(invoiceData) {
  const payload = {
    parent: {
      data_source_id: CONTRACTORS_INVOICES_DATA_SOURCE_ID
    },
    properties: {
      "Invoice Name": {
        title: [
          {
            text: {
              content: invoiceData.invoiceName || ""
            }
          }
        ]
      },
      "Contractor": {
        relation: buildRequiredRelationPayload_(
          invoiceData.contractorId,
          "Missing contractorId for contractor invoice."
        )
      },
      "Status": {
        select: {
          name: invoiceData.status || "Submitted"
        }
      },
      "Billing Period": {
        date: {
          start: invoiceData.billingPeriod || null
        }
      },
      "Requested Date": {
        date: {
          start:
            invoiceData.requestedDate ||
            new Date().toISOString().slice(0, 10)
        }
      },
      "Due Date": {
        date: {
          start: invoiceData.dueDate || null
        }
      },
      "Projects": {
        relation: buildUniqueRelationPayload_(invoiceData.projectIds)
      },
      "Assignments": {
        relation: buildUniqueRelationPayload_(invoiceData.assignmentIds)
      },
      "Notes": {
        rich_text: [
          {
            text: {
              content: invoiceData.notes || ""
            }
          }
        ]
      }
    }
  };

  if (invoiceData.invoiceFileName && invoiceData.invoiceFileUrl) {
    payload.properties["Invoice File"] = {
      files: [
        {
          name: invoiceData.invoiceFileName,
          type: "external",
          external: {
            url: invoiceData.invoiceFileUrl
          }
        }
      ]
    };
  }

  return notionFetch_(
    "https://api.notion.com/v1/pages",
    "post",
    payload
  );
}

function findContractorInvoiceForMonth_(contractorId, billingMonth) {
  const data = notionFetch_(
    `https://api.notion.com/v1/data_sources/${CONTRACTORS_INVOICES_DATA_SOURCE_ID}/query`,
    "post",
    {
      filter: {
        and: [
          {
            property: "Contractor",
            relation: {
              contains: contractorId
            }
          },
          {
            property: "Billing Period",
            date: {
              on_or_after: `${billingMonth}-01`
            }
          },
          {
            property: "Billing Period",
            date: {
              before: invoiceNextMonthStart_(billingMonth)
            }
          }
        ]
      },
      page_size: 1
    }
  );

  return data.results?.[0] || null;
}

function updateContractorInvoiceRelations_(invoiceId, projectIds, assignmentIds, notes) {
  const existing = notionFetch_(
    `https://api.notion.com/v1/pages/${invoiceId}`,
    "get"
  );

  const existingProjectIds =
    existing.properties["Projects"]?.relation?.map(item => item.id) || [];

  const existingAssignmentIds =
    existing.properties["Assignments"]?.relation?.map(item => item.id) || [];

  const payload = {
    properties: {
      "Projects": {
        relation: buildUniqueRelationPayload_([
          ...existingProjectIds,
          ...(projectIds || [])
        ])
      },
      "Assignments": {
        relation: buildUniqueRelationPayload_([
          ...existingAssignmentIds,
          ...(assignmentIds || [])
        ])
      }
    }
  };

  if (notes) {
    payload.properties["Notes"] = {
      rich_text: [
        {
          text: {
            content: notes
          }
        }
      ]
    };
  }

  return notionFetch_(
    `https://api.notion.com/v1/pages/${invoiceId}`,
    "patch",
    payload
  );
}

function updateContractorInvoiceFile_(invoiceId, fileName, fileUrl) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${invoiceId}`,
    "patch",
    {
      properties: {
        "Invoice File": {
          files: [
            {
              name: fileName,
              type: "external",
              external: {
                url: fileUrl
              }
            }
          ]
        }
      }
    }
  );
}


/************************************
 * INVOICE LINE ITEMS
 ************************************/

function createContractorInvoiceLineItem_(lineItemData) {
  const payload = {
    parent: {
      data_source_id: CONTRACTOR_INVOICE_LINE_ITEMS_DATA_SOURCE_ID
    },
    properties: {
      "Name": {
        title: [
          {
            text: {
              content: lineItemData.name || ""
            }
          }
        ]
      },
      "Contractor’s Invoices": {
        relation: buildRequiredRelationPayload_(
          lineItemData.invoiceId,
          "Missing invoiceId for invoice line item."
        )
      },
      "Contractor": {
        relation: buildRequiredRelationPayload_(
          lineItemData.contractorId,
          "Missing contractorId for invoice line item."
        )
      },
      "Project": {
        relation: buildRequiredRelationPayload_(
          lineItemData.projectId,
          "Missing projectId for invoice line item."
        )
      },
      "Assignment": {
        relation: buildRequiredRelationPayload_(
          lineItemData.assignmentId,
          "Missing assignmentId for invoice line item."
        )
      },
      "Task / Role": {
        select: {
          name: lineItemData.role || "General Work"
        }
      },
      "Hours": {
        number: Number(lineItemData.hours || 0)
      },
      "Rate": {
        number: Number(lineItemData.rate || 0)
      },
      "Description": {
        rich_text: [
          {
            text: {
              content: lineItemData.description || ""
            }
          }
        ]
      }
    }
  };

  return notionFetch_(
    "https://api.notion.com/v1/pages",
    "post",
    payload
  );
}


/************************************
 * RELATION HELPERS
 ************************************/

function buildUniqueRelationPayload_(ids) {
  const uniqueIds = [];

  (ids || []).forEach(id => {
    if (id && !uniqueIds.includes(id)) {
      uniqueIds.push(id);
    }
  });

  return uniqueIds.map(id => ({ id }));
}

function buildRequiredRelationPayload_(id, errorMessage) {
  if (!id) {
    throw new Error(errorMessage);
  }

  return [
    {
      id
    }
  ];
}


/************************************
 * DATE HELPERS
 ************************************/

function invoiceMonthKey_(dateString) {
  return String(dateString || new Date().toISOString().slice(0, 10))
    .slice(0, 7);
}

function invoiceNextMonthStart_(billingMonth) {
  const parts = billingMonth.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);

  const next = new Date(Date.UTC(year, month, 1));

  return next.toISOString().slice(0, 10);
}