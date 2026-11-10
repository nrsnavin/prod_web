import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

// ══════════════════════════════════════════════════════════════════
//  A FORM, CHECKED BY ITS SCHEMA
//
//  Every form here is typed by what its schema GIVES: a quantity is a
//  number in `onSubmit`, though the input it came from held text.
//
//  The schema library now types what a schema TAKES separately, and for
//  a coerced field that is `unknown` — which is honest (z.coerce.number()
//  will take anything) and makes the resolver it builds fit no form
//  typed by its values: `Resolver<{ quantity: unknown }>` is not a
//  `Resolver<{ quantity: number }>`. Twenty-four forms would each have
//  needed the same cast.
//
//  This is that cast, once, with the check that matters kept: the
//  schema's output has to be the form's values. A schema that gives
//  something else does not compile here.
// ══════════════════════════════════════════════════════════════════

/**
 * The resolver for a form whose values are the schema's output.
 *
 * @param schema a zod schema; what it parses TO must be assignable to the form's values
 */
export function formResolver<TValues extends FieldValues>(
  schema: z.ZodType<TValues>
): Resolver<TValues> {
  return zodResolver(schema as never) as unknown as Resolver<TValues>;
}
