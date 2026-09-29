"use client";

import { ADMIN_PERMS, ALL_PERMS } from "@/lib/admin-perms";

// T2: one checkbox per admin section + "Select all" / "Clear all" (master admin only: Admins page and Add admin).
export function PermChecks({ value, onChange, disabled, label = "Sections" }: { value: string[]; onChange: (perms: string[]) => void; disabled?: boolean; label?: string }) {
  const toggle = (id: string, on: boolean) => onChange(ALL_PERMS.filter((p) => (p === id ? on : value.includes(p))));
  return <fieldset className="perm-checks" disabled={disabled}>
    <legend>{label} <small>{value.length} of {ALL_PERMS.length}</small></legend>
    <div className="perm-all">
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...ALL_PERMS])} disabled={value.length === ALL_PERMS.length}>Select all</button>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([])} disabled={value.length === 0}>Clear all</button>
    </div>
    <div className="perm-grid">{ADMIN_PERMS.map((p) => <label key={p.id} className="check"><input type="checkbox" name={`perm-${p.id}`} checked={value.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} /> {p.label}</label>)}</div>
  </fieldset>;
}
