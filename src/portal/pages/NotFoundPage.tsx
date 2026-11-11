import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";

/** A page or a record that is not there, or not this customer's. */
export function NotFoundPage({ what }: { what?: string }) {
  return (
    <Card className="mx-auto max-w-md p-6 text-center">
      <h1 className="font-semibold text-ink-900">{what ? `That ${what} is not here` : "That page is not here"}</h1>
      <p className="mt-2 text-sm text-ink-500">It may have been mistyped, or it belongs to another account.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Back to the start</Link>
    </Card>
  );
}
