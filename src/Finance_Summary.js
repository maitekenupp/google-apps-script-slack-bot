/******************************************************
 *
 * IZA
 * File: Finance_Summary.gs
 *
 * Purpose:
 * Reads the Google Sheets finance dashboard and posts
 * a Slack finance summary to a configured channel.
 *
 ******************************************************/


/************************************
 * WEBHOOK ENTRY
 ************************************/

function handleFinanceSummaryWebhook_(data) {
  const props =
    PropertiesService.getScriptProperties();

  const expectedSecret =
    props.getProperty("FINANCE_SUMMARY_WEBHOOK_SECRET");

  if (!expectedSecret) {
    throw new Error("Missing FINANCE_SUMMARY_WEBHOOK_SECRET.");
  }

  if (!data || data.secret !== expectedSecret) {
    throw new Error("Invalid finance summary webhook secret.");
  }

  const summary =
    buildFinanceSummaryFromSheet_();

  postSlackMessage_(
    FINANCE_SUMMARY_CHANNEL,
    buildFinanceSummaryBlocks_(summary),
    "Finance Summary"
  );

  return {
    ok: true,
    posted: true
  };
}


/************************************
 * SHEET READER
 ************************************/

function buildFinanceSummaryFromSheet_() {
  const spreadsheet =
    SpreadsheetApp.openById(FINANCE_SUMMARY_SPREADSHEET_ID);

  const summarySheet =
    spreadsheet.getSheetByName("Summary");

  const bucketSheet =
    spreadsheet.getSheetByName("Bucket_Balances");

  if (!summarySheet) {
    throw new Error("Missing Summary sheet.");
  }

  if (!bucketSheet) {
    throw new Error("Missing Bucket_Balances sheet.");
  }

  const metrics = {
    lastUpdated: getSheetDisplayValue_(summarySheet, "B1"),
    revenue: getSheetDisplayValue_(summarySheet, "B4"),
    grossProfit: getSheetDisplayValue_(summarySheet, "D4"),
    netIncome: getSheetDisplayValue_(summarySheet, "F4"),
    netIncomeMarginYtd: getSheetDisplayValue_(summarySheet, "H4"),
    bankBalance: getSheetDisplayValue_(summarySheet, "J4"),
    arOutstanding: getSheetDisplayValue_(summarySheet, "L4"),
    annualRevenueTarget: getSheetDisplayValue_(summarySheet, "N4"),
    annualTargetBalance: getSheetDisplayValue_(summarySheet, "P4")
  };

  const buckets =
    bucketSheet
      .getRange("A2:B6")
      .getDisplayValues()
      .map(row => ({
        bucket: row[0],
        balance: row[1],
        numericBalance: parseFinanceMoney_(row[1])
      }))
      .filter(item => item.bucket);

  return {
    metrics,
    buckets,
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function getSheetDisplayValue_(sheet, cellA1) {
  return sheet
    .getRange(cellA1)
    .getDisplayValue();
}


/************************************
 * SLACK BLOCKS
 ************************************/

function buildFinanceSummaryBlocks_(summary) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: buildFinanceSummaryText_(summary)
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📄 Open Sheet",
            emoji: true
          },
          url: summary.spreadsheetUrl,
          action_id: "finance_summary_open_sheet"
        }
      ]
    }
  ];
}

function buildFinanceSummaryText_(summary) {
  const m =
    summary.metrics;

  return (
    "📊 *Finance Summary (Current Month)*\n\n" +
    `*Last Updated:* ${cleanFinanceLastUpdated_(m.lastUpdated) || "-"}\n\n` +
    `*Revenue:* ${m.revenue || "-"}\n` +
    `*Gross Profit:* ${m.grossProfit || "-"}\n` +
    `*Net Income:* ${m.netIncome || "-"}\n` +
    `*Net Income Margin YTD:* ${m.netIncomeMarginYtd || "-"}\n\n` +
    `*AR Outstanding Invoices:* ${m.arOutstanding || "-"}\n` +
    `*Bank Current Balance:* ${m.bankBalance || "-"}\n\n` +
    buildFinanceBucketText_(summary.buckets)
  );
}

function cleanFinanceLastUpdated_(value) {
  return String(value || "")
    .replace(/^Last Updated:\s*/i, "")
    .trim();
}

function buildFinanceBucketText_(buckets) {
  if (!buckets || !buckets.length) {
    return "*Bucket Distribution:*\nNo bucket data found.";
  }

  const maxValue =
    Math.max.apply(
      null,
      buckets.map(item => Math.abs(item.numericBalance || 0))
    ) || 1;

  let text =
    "*Bucket Distribution:*\n";

  buckets.forEach(item => {
    const bar =
      buildFinanceBar_(
        item.numericBalance,
        maxValue
      );

    text +=
      `\`${padFinanceLabel_(item.bucket, 12)}\` ${bar} ${item.balance}\n`;
  });

  return text.trim();
}

function buildFinanceBar_(value, maxValue) {
  const width = 10;

  const count =
    Math.max(
      1,
      Math.round(
        (Math.abs(value || 0) / maxValue) * width
      )
    );

  return "█".repeat(count);
}

function padFinanceLabel_(text, length) {
  const value =
    String(text || "");

  if (value.length >= length) {
    return value.substring(0, length);
  }

  return value + " ".repeat(length - value.length);
}


/************************************
 * HELPERS
 ************************************/

function parseFinanceMoney_(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const cleaned =
    String(value)
      .replace(/,/g, "")
      .replace(/\$/g, "")
      .replace(/\((.*?)\)/, "-$1")
      .trim();

  const number =
    Number(cleaned);

  return isNaN(number)
    ? 0
    : number;
}