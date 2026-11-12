import { useState } from "react";
import { QrCode } from "lucide-react";
import { PhotoFillButton } from "@/features/common/PhotoFill";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formResolver } from "@/core/forms/formResolver";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DEPARTMENTS, EmployeeFormValues, SkillProfile, AadhaarQrResult } from "./types";
import { SkillProfileFields } from "./SkillProfileFields";
import { AadhaarQrDialog, matchLines, signatureWords } from "./AadhaarQrDialog";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  department: z.string().min(1, "Department is required"),
  phoneNumber: z
    .string()
    .regex(/^\d{10}$/, "Enter a 10-digit phone number")
    .optional()
    .or(z.literal("")),
  role: z.string().optional(),
  aadhar: z.string().optional(),
  // As on the Aadhaar card; its QR code can fill them.
  dob: z.string().optional(),
  gender: z.enum(["", "male", "female", "other"]).optional(),
  address: z.string().max(400, "At most 400 characters").optional(),
  pincode: z.string().regex(/^\d{6}$/, "Enter the 6-digit pin code").optional().or(z.literal("")),
});

type BasicValues = z.infer<typeof schema>;

const DAY_SHIFT_HOURS = 12;

const GENDERS = [
  { value: "", label: "—" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Transgender / other" },
];

export function EmployeeForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  aadhaarOnFile,
  canEditAadhaar = true,
  employeeId,
  onAadhaarChecked,
}: {
  initial?: Partial<EmployeeFormValues>;
  submitting: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
  /**
   * Editing: the masked number on file ("XXXX XXXX 1234"), shown as the
   * field's placeholder. The real number never comes to the browser, so
   * the field starts empty and is sent only when someone types a new one.
   */
  aadhaarOnFile?: string | null;
  /** Only an admin may set an Aadhaar number; the server enforces it too. */
  canEditAadhaar?: boolean;
  /** Editing an employee: a QR check is kept on their record as it is made. */
  employeeId?: string;
  /** Told when a QR check was kept, to refresh the page behind the form. */
  onAadhaarChecked?: () => void;
}) {
  // Read from their Aadhaar / PAN card: what to check.
  const [idNote, setIdNote] = useState("");
  // The Aadhaar card's QR code: the dialog, the code read, and what it said.
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrNote, setQrNote] = useState<{ tone: string; text: string } | null>(null);
  const editing = !!initial?.name;
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<BasicValues>({
    resolver: formResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      department: initial?.department ?? "weaving",
      phoneNumber: initial?.phoneNumber ?? "",
      role: initial?.role ?? "",
      aadhar: "",
      dob: initial?.dob ?? "",
      gender: initial?.gender ?? "",
      address: initial?.address ?? "",
      pincode: initial?.pincode ?? "",
    },
  });

  // Salary is asked per DAY shift (12h) — what the floor talks in — and
  // stored as ₹/hour, which is what payroll computes from.
  const [shiftSalary, setShiftSalary] = useState(
    initial?.hourlyRate ? String(initial.hourlyRate * DAY_SHIFT_HOURS) : ""
  );
  const hourlyRate = shiftSalary === "" ? 0 : Number(shiftSalary) / DAY_SHIFT_HOURS;

  const [skillProfile, setSkillProfile] = useState<SkillProfile>(initial?.skillProfile ?? {});

  // An empty Aadhaar field means "keep what is on file": leave it out.
  // Date of birth, gender, address and pin code: an edit sends them as
  // they stand ("" clears one); a new record only those filled in. A new
  // record's scanned QR code goes with it, to be read again and kept.
  const submit = ({ aadhar, dob, gender, address, pincode, ...basic }: BasicValues) => {
    const personal = { dob: dob ?? "", gender: gender ?? "", address: address?.trim() ?? "", pincode: pincode ?? "" };
    onSubmit({
      ...basic,
      ...(aadhar?.trim() ? { aadhar: aadhar.trim() } : {}),
      ...(editing ? personal : Object.fromEntries(Object.entries(personal).filter(([, v]) => v !== ""))),
      ...(!editing && qr ? { aadhaarQr: qr, aadhaarQrConsent: true } : {}),
      hourlyRate,
      skillProfile,
    });
  };

  // The card's details into the form: what the card has, over what is
  // empty; a typed name is kept, and a different one on the card noted.
  const fillFromQr = ({ read, matches }: AadhaarQrResult, code: string) => {
    const opt = { shouldDirty: true };
    const f = read.fields;
    if (!f) return;
    const typedName = getValues("name")?.trim();
    if (!typedName) setValue("name", f.name, opt);
    if (f.dob) setValue("dob", f.dob, opt);
    if (f.gender) setValue("gender", f.gender, opt);
    if (f.address) setValue("address", f.address, opt);
    if (f.pincode) setValue("pincode", f.pincode, opt);
    if (read.aadhaar && !getValues("aadhar")?.trim()) setValue("aadhar", read.aadhaar, opt);
    setQr(read.kind === "secure" ? code : null);
    const s = signatureWords(read.signature);
    const notes = [s.title, ...matchLines(matches, { onRecord: !!employeeId }).map((l) => l.text)];
    if (typedName && matches.name === "different") notes.push(`The card says "${f.name}"`);
    setQrNote({ tone: s.tone, text: notes.join(" · ") });
  };

  const onFile = aadhaarOnFile && aadhaarOnFile !== "Not Provided" ? aadhaarOnFile : null;

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {canEditAadhaar && (
        <div className="space-y-1">
          <Button type="button" variant="secondary" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="h-4 w-4" aria-hidden /> Scan the Aadhaar QR code
          </Button>
          {qrNote && (
            <p className={qrNote.tone === "success" ? "text-xs text-status-success" : qrNote.tone === "danger" ? "text-xs text-status-danger" : "text-xs text-status-warning"} role="note">
              {qrNote.text}
            </p>
          )}
        </div>
      )}
      {canEditAadhaar && !onFile && (
        <div className="space-y-1">
          <PhotoFillButton<IdRead> url="/employee/read-id" what="ID card" label="Fill from Aadhaar / PAN card" multiple
            onRead={(b) => {
              const opt = { shouldDirty: true };
              if (b.read.name) setValue("name", b.read.name, opt);
              if (b.read.aadhaar) setValue("aadhar", b.read.aadhaar, opt);
              const notes = [
                b.read.aadhaar && !b.read.aadhaarValid ? "The Aadhaar number read does not pass its check digit — compare it with the card." : "",
                [b.read.dob && `Born ${b.read.dob.split("-").reverse().join("/")}`, b.read.gender, b.read.pan && `PAN ${b.read.pan}`].filter(Boolean).join(" · "),
              ].filter(Boolean);
              setIdNote(notes.join(" "));
            }} />
          {idNote && <p className="text-xs text-ink-500" role="note">{idNote}</p>}
        </div>
      )}
      <Input label="Full name *" error={errors.name?.message} {...register("name")} />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Department *"
          options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          error={errors.department?.message}
          {...register("department")}
        />
        <Input label="Role" placeholder="e.g. operator" {...register("role")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Phone"
          inputMode="numeric"
          error={errors.phoneNumber?.message}
          {...register("phoneNumber")}
        />
        <Input
          label="Aadhaar"
          inputMode="numeric"
          autoComplete="off"
          placeholder={onFile ?? undefined}
          disabled={!canEditAadhaar}
          hint={
            !canEditAadhaar
              ? "Only an admin can change this"
              : onFile
                ? "Type a new number to replace it"
                : undefined
          }
          {...register("aadhar")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Date of birth" type="date" error={errors.dob?.message} {...register("dob")} />
        <Select label="Gender" options={GENDERS} {...register("gender")} />
      </div>
      <div className="grid grid-cols-[1fr,8rem] gap-3">
        <Input label="Address" error={errors.address?.message} {...register("address")} />
        <Input label="Pin code" inputMode="numeric" error={errors.pincode?.message} {...register("pincode")} />
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <Input
          label="Shift salary — DAY 12h (₹)"
          type="number"
          min="0"
          value={shiftSalary}
          onChange={(e) => setShiftSalary(e.target.value)}
        />
        <p className="pb-2.5 text-xs text-ink-400">
          {hourlyRate > 0
            ? `= ₹${(Math.round(hourlyRate * 100) / 100).toLocaleString("en-IN")}/hour · NIGHT (12h) ₹${Math.round(hourlyRate * 12).toLocaleString("en-IN")}`
            : "Payroll pays per hour: DAY = 12h, NIGHT = 12h"}
        </p>
      </div>

      <div className="rounded-lg border border-ink-100 bg-canvas/50 p-4">
        <p className="mb-2 text-sm font-semibold">Skill &amp; performance questionnaire</p>
        <SkillProfileFields value={skillProfile} onChange={setSkillProfile} />
      </div>

      <AadhaarQrDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        personName={getValues("name")}
        employeeId={employeeId}
        compare={employeeId ? undefined : { name: getValues("name"), phoneNumber: getValues("phoneNumber"), aadhar: getValues("aadhar") }}
        onFill={fillFromQr}
        onChecked={(r) => { if (r.check) onAadhaarChecked?.(); }}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial?.name ? "Save changes" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}

/** What POST /employee/read-id returns. */
interface IdRead { read: { problem?: string | null; name: string; dob: string; gender: string; pan: string; aadhaar: string; aadhaarValid: boolean }; aiSuggestion: string | null }
