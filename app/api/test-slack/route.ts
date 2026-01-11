/**
 * Test endpoint for Slack webhook integration
 * DELETE THIS FILE AFTER TESTING
 *
 * Usage: curl http://localhost:3000/api/test-slack
 */

import { sendExcuseNotification } from "@/lib/slack";
import { NextResponse } from "next/server";

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Test endpoint disabled in production" },
      { status: 403 }
    );
  }

  const testData = {
    childName: "Test Dítě",
    parentName: "Test Rodič",
    fromDate: new Date(),
    toDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // +2 days
    reason: "Testovací omluvenka - můžete smazat",
    isOnTime: true,
  };

  try {
    const success = await sendExcuseNotification(testData);

    if (success) {
      return NextResponse.json({
        success: true,
        message:
          "Testovací zpráva odeslána do Slacku! Zkontrolujte kanál #omluvenky.",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nepodařilo se odeslat zprávu. Zkontrolujte SLACK_WEBHOOK_URL v .env souboru.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
