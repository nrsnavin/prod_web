import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { EwaybillBody } from "./types";

/**
 * The e-way bill's Part B: vehicle (or the transporter who will add
 * it), distance and mode. "generate" asks the connected provider for
 * the number; "paste" takes the one the portal gave.
 */
export function EwaybillDialog({ docNo, mode, loading, onClose, onConfirm, defaultVehicle = "" }: {
  docNo: string; mode: "generate" | "paste"; loading?: boolean; onClose: () => void; onConfirm: (body: EwaybillBody) => void; defaultVehicle?: string;
}) {
  const [number, setNumber] = useState("");
  const [vehicleNo, setVehicleNo] = useState(defaultVehicle);
  const [transporterId, setTransporterId] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | "">("");
  const [transport, setTransport] = useState<NonNullable<EwaybillBody["mode"]>>("road");
  const [validUpto, setValidUpto] = useState("");
  const digits = number.replace(/\D/g, "");
  const ready = (mode === "paste" ? digits.length === 12 : true) && (vehicleNo.trim() || transporterId.trim());
  return (
    <Modal open onClose={onClose} title={mode === "generate" ? `E-way bill for ${docNo}` : `E-way bill number for ${docNo}`} width="max-w-lg">
      <div className="space-y-3">
        {mode === "paste" && <Input label="E-way bill number *" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="12 digits, as on the portal" hint={digits.length && digits.length !== 12 ? `${digits.length} of 12 digits` : undefined} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Vehicle number" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} placeholder="TN39BX1234" hint="Leave blank when the transporter adds Part B" />
          <Select label="Mode" value={transport} onChange={(e) => setTransport(e.target.value as NonNullable<EwaybillBody["mode"]>)} options={[{ value: "road", label: "Road" }, { value: "rail", label: "Rail" }, { value: "air", label: "Air" }, { value: "ship", label: "Ship" }]} />
          <Input label="Transporter GSTIN / ID" value={transporterId} onChange={(e) => setTransporterId(e.target.value.toUpperCase())} placeholder="When they add Part B" />
          <Input label="Transporter name" value={transporterName} onChange={(e) => setTransporterName(e.target.value)} />
          <Input label="Distance (km)" type="number" min={0} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value === "" ? "" : Number(e.target.value))} hint="Pin to pin; the portal works out the validity from it" />
          {mode === "paste" && <Input label="Valid up to" type="date" value={validUpto} onChange={(e) => setValidUpto(e.target.value)} />}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready} loading={loading} onClick={() => onConfirm({ ...(mode === "paste" ? { number: digits, validUpto: validUpto || undefined } : {}), vehicleNo: vehicleNo.trim() || undefined, transporterId: transporterId.trim() || undefined, transporterName: transporterName.trim() || undefined, distanceKm: Number(distanceKm) || 0, mode: transport })}>
            {mode === "generate" ? "Generate e-way bill" : "Record e-way bill"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
