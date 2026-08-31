import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { copy } from "@/lib/tree/copy";
import { COUNTRIES, flagEmoji } from "@/lib/tree/countries";
import { lineageHint, similarPeople } from "@/lib/tree/graph";
import { useTreeStore } from "@/lib/tree/store";
import type { Person, PersonDraft } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: PersonDraft;
  onChange: (next: PersonDraft) => void;
  autoFocus?: boolean;
  formId?: string;
  lockGender?: boolean;
  genderMode?: "adult" | "child";
  excludeId?: string | null;
  onPickExisting?: (person: Person) => void;
  graveFile?: File | null;
  onGraveFile?: (file: File | null) => void;
  showWifeKind?: boolean;
};

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function PersonForm({
  value,
  onChange,
  autoFocus,
  formId = "person",
  lockGender,
  genderMode = "adult",
  excludeId,
  onPickExisting,
  graveFile,
  onGraveFile,
  showWifeKind = false,
}: Props) {
  const set = (patch: Partial<PersonDraft>) => onChange({ ...value, ...patch });
  const people = useTreeStore((s) => s.people);
  const matches = similarPeople(people, value, excludeId);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field id={`${formId}-given`} label={copy.givenName}>
        <Input
          id={`${formId}-given`}
          value={value.givenName}
          autoFocus={autoFocus}
          autoComplete="off"
          required
          onChange={(e) => set({ givenName: e.target.value })}
        />
      </Field>
      <Field id={`${formId}-father`} label={copy.fatherName}>
        <Input
          id={`${formId}-father`}
          value={value.fatherName}
          autoComplete="off"
          onChange={(e) => set({ fatherName: e.target.value })}
        />
      </Field>
      {matches.length ? (
        <div className="space-y-1.5 sm:col-span-2 rounded-lg bg-cream px-3 py-2">
          <p className="text-xs font-medium text-ink-soft">{copy.similarNames}</p>
          <p className="text-xs text-muted">{copy.similarHint}</p>
          <ul className="mt-1 space-y-1">
            {matches.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-xs leading-5 text-ink">{lineageHint(people, p)}</span>
                {onPickExisting ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-male hover:underline"
                    onClick={() => onPickExisting(p)}
                  >
                    {copy.useExisting}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Field id={`${formId}-family`} label={copy.familyName}>
        <Input
          id={`${formId}-family`}
          value={value.familyName}
          autoComplete="off"
          onChange={(e) => set({ familyName: e.target.value })}
        />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-cream px-3 py-3 sm:col-span-2">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--color-chip)]"
          checked={Boolean(value.houseHead)}
          onChange={(e) => set({ houseHead: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-medium text-ink">{copy.houseHead}</span>
          <span className="text-xs text-muted">{copy.houseHeadHint}</span>
        </span>
      </label>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{copy.gender}</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={lockGender}
            onClick={() => set({ gender: "male" })}
            className={cn(
              "h-11 rounded-lg text-sm font-medium shadow-[0_0_0_1px_rgba(28,33,28,0.08)]",
              value.gender === "male" ? "bg-male text-cream" : "bg-paper text-ink-soft",
            )}
          >
            {copy.male}
          </button>
          <button
            type="button"
            disabled={lockGender}
            onClick={() => set({ gender: "female" })}
            className={cn(
              "h-11 rounded-lg text-sm font-medium shadow-[0_0_0_1px_rgba(28,33,28,0.08)]",
              value.gender === "female" ? "bg-female text-cream" : "bg-paper text-ink-soft",
            )}
          >
            {copy.female}
          </button>
        </div>
      </div>
      {showWifeKind ? <WifeKindFields value={value} set={set} /> : null}
      <Field id={`${formId}-bdate`} label={copy.birthDate}>
        <Input
          id={`${formId}-bdate`}
          type="date"
          value={value.birthDate.length === 10 ? value.birthDate : ""}
          onChange={(e) => set({ birthDate: e.target.value })}
        />
      </Field>
      <Field id={`${formId}-bplace`} label={copy.birthPlace}>
        <Input
          id={`${formId}-bplace`}
          value={value.birthPlace}
          autoComplete="off"
          onChange={(e) => set({ birthPlace: e.target.value })}
        />
      </Field>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${formId}-country`}>{copy.country}</Label>
        <select
          id={`${formId}-country`}
          value={value.countryCode}
          onChange={(e) => set({ countryCode: e.target.value })}
          className="h-11 w-full rounded-lg bg-paper px-3 text-sm text-ink shadow-[0_0_0_1px_rgba(28,33,28,0.1)] outline-none"
        >
          <option value="">{copy.countryNone}</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {flagEmoji(c.code)} {c.name}
            </option>
          ))}
        </select>
      </div>
      <Field id={`${formId}-res`} label={copy.residence}>
        <Input
          id={`${formId}-res`}
          value={value.residence}
          autoComplete="off"
          onChange={(e) => set({ residence: e.target.value })}
        />
      </Field>
      <Field id={`${formId}-job`} label={copy.occupation}>
        <Input
          id={`${formId}-job`}
          value={value.occupation}
          autoComplete="off"
          onChange={(e) => set({ occupation: e.target.value })}
        />
      </Field>
      <Field id={`${formId}-ddate`} label={copy.deathDate}>
        <Input
          id={`${formId}-ddate`}
          type="date"
          value={value.deathDate.length === 10 ? value.deathDate : ""}
          onChange={(e) => set({ deathDate: e.target.value })}
        />
      </Field>
      <Field id={`${formId}-dplace`} label={copy.deathPlace}>
        <Input
          id={`${formId}-dplace`}
          value={value.deathPlace}
          autoComplete="off"
          onChange={(e) => set({ deathPlace: e.target.value })}
        />
      </Field>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${formId}-notes`}>{copy.notes}</Label>
        <Textarea
          id={`${formId}-notes`}
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
      <OptionalDeathFields
        formId={formId}
        value={value}
        set={set}
        graveFile={graveFile}
        onGraveFile={onGraveFile}
      />
    </div>
  );
}

function WifeKindFields({
  value,
  set,
}: {
  value: PersonDraft;
  set: (patch: Partial<PersonDraft>) => void;
}) {
  const extra = value.wifeKind === "previous" || value.wifeKind === "deceased";
  const [open, setOpen] = useState(extra);
  if (!open) {
    return (
      <div className="sm:col-span-2">
        <button type="button" className="text-xs text-muted hover:underline" onClick={() => setOpen(true)}>
          {copy.moreWifeOptions}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-soft">{copy.wifeKind}</p>
        <button
          type="button"
          className="text-xs text-muted hover:underline"
          onClick={() => {
            set({ wifeKind: "current" });
            setOpen(false);
          }}
        >
          {copy.hideWifeOptions}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => set({ wifeKind: "previous" })}
          className={cn(
            "h-11 rounded-lg text-sm font-medium",
            value.wifeKind === "previous" ? "bg-chip text-cream" : "bg-paper text-ink-soft shadow-[0_0_0_1px_rgba(28,33,28,0.08)]",
          )}
        >
          {copy.previousWife}
        </button>
        <button
          type="button"
          onClick={() => set({ wifeKind: "deceased" })}
          className={cn(
            "h-11 rounded-lg text-sm font-medium",
            value.wifeKind === "deceased" ? "bg-chip text-cream" : "bg-paper text-ink-soft shadow-[0_0_0_1px_rgba(28,33,28,0.08)]",
          )}
        >
          {copy.previousDeceasedWife}
        </button>
      </div>
      {value.wifeKind === "previous" ? <p className="text-xs text-muted">{copy.previousWifeHint}</p> : null}
      {value.wifeKind === "deceased" ? <p className="text-xs text-muted">{copy.previousDeceasedHint}</p> : null}
    </div>
  );
}

function OptionalDeathFields({
  formId,
  value,
  set,
  graveFile,
  onGraveFile,
}: {
  formId: string;
  value: PersonDraft;
  set: (patch: Partial<PersonDraft>) => void;
  graveFile?: File | null;
  onGraveFile?: (file: File | null) => void;
}) {
  const hasData = Boolean(value.burialPlace || value.burialGps || graveFile);
  const [open, setOpen] = useState(hasData);
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  if (!open) {
    return (
      <div className="sm:col-span-2">
        <button
          type="button"
          className="text-xs text-muted hover:text-ink-soft hover:underline"
          onClick={() => setOpen(true)}
        >
          {copy.optionalFields} — {copy.showOptional}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:col-span-2 rounded-lg bg-cream/70 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft">{copy.optionalFields}</p>
        <button type="button" className="text-xs text-muted hover:underline" onClick={() => setOpen(false)}>
          {copy.hideOptional}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${formId}-burial`} label={copy.burialPlace}>
          <Input
            id={`${formId}-burial`}
            value={value.burialPlace}
            autoComplete="off"
            onChange={(e) => set({ burialPlace: e.target.value })}
          />
        </Field>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${formId}-gps`}>{copy.burialGps}</Label>
          <Input
            id={`${formId}-gps`}
            value={value.burialGps}
            dir="ltr"
            autoComplete="off"
            placeholder="29.318, 47.885"
            onChange={(e) => set({ burialGps: e.target.value })}
          />
          <p className="text-xs text-muted">{copy.burialGpsHint}</p>
        </div>
      </div>
      {onGraveFile ? (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" type="button" onClick={() => camRef.current?.click()}>
            {copy.camera}
          </Button>
          <Button size="sm" variant="outline" type="button" onClick={() => libRef.current?.click()}>
            {copy.fromLibrary}
          </Button>
          {graveFile ? <span className="self-center text-xs text-muted">{graveFile.name}</span> : null}
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (next) onGraveFile(next);
            }}
          />
          <input
            ref={libRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (next) onGraveFile(next);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
