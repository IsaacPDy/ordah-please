import { timingSafeEqual } from "node:crypto";
import { cleanupReceiptObjects } from "../../../../src/features/orders/receipt-service";
import {
  receiptRunner,
  receiptStorage,
} from "../../../../src/features/orders/receipt-route";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json(
      { error: "Receipt cleanup is not configured." },
      { status: 503 },
    );
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(
      await cleanupReceiptObjects(receiptRunner, receiptStorage()),
    );
  } catch {
    return Response.json({ error: "Receipt cleanup failed." }, { status: 503 });
  }
}
