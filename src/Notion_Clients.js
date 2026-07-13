/******************************************************
 *
 * IZA
 * File: Notion_Clients.gs
 *
 * Purpose:
 * Handles creating and reading clients in Notion.
 *
 ******************************************************/

function createNotionClient_(clientData) {
  const payload = {
    parent: {
      data_source_id: CLIENTS_DATA_SOURCE_ID
    },
    properties: {
      "Name": {
        title: [
          {
            text: {
              content: clientData.name || ""
            }
          }
        ]
      },
      "CLIENT TYPE": {
        status: {
          name: clientData.clientType
        }
      },
      "Contact Person": {
        rich_text: [
          {
            text: {
              content: clientData.contactPerson || ""
            }
          }
        ]
      },
      "Contact Email": {
        email: clientData.contactEmail || null
      },
      "Phone Number": {
        phone_number: clientData.phoneNumber || null
      },
      "Address": {
        rich_text: [
          {
            text: {
              content: clientData.address || ""
            }
          }
        ]
      },
      "Website": {
        rich_text: [
          {
            text: {
              content: clientData.website || ""
            }
          }
        ]
      },
      "Notes": {
        rich_text: [
          {
            text: {
              content: clientData.notes || ""
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