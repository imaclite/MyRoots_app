import { copy } from "@/lib/tree/copy";
import { formatEvent, fullName, initials } from "@/lib/tree/format";
import { housesOf } from "@/lib/tree/graph";
import { useTreeStore } from "@/lib/tree/store";
import type { Person } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { Flag } from "./flag";

function Mini({ person, onPick }: { person: Person; onPick: (id: string) => void }) {
  const male = person.gender === "male";
  const born = formatEvent(copy.bornAbbr, person.birthDate, person.birthPlace);
  return (
    <button
      type="button"
      onClick={() => onPick(person.id)}
      className={cn(
        "person-card flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-right",
        male ? "bg-male-fill" : "bg-female-fill",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-cream",
          male ? "bg-male" : "bg-female",
        )}
      >
        {initials(person)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Flag code={person.countryCode} />
          <span className="truncate text-sm font-semibold text-ink">{fullName(person)}</span>
        </span>
        {born ? <span className="block truncate text-xs text-muted">{born}</span> : null}
      </span>
    </button>
  );
}

export function HousesView() {
  const people = useTreeStore((s) => s.people);
  const openFile = useTreeStore((s) => s.openFile);
  const houses = housesOf(people);

  const pick = (id: string) => {
    openFile(id);
  };

  if (!houses.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted">{copy.noHouses}</div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {houses.map((house) => {
          const title = [house.husband, house.wife]
            .filter(Boolean)
            .map((p) => p!.givenName)
            .join(" و ");
          return (
            <article key={house.id} className="rounded-xl bg-paper p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {copy.houseOf} {title}
              </h2>
              <div className="space-y-2">
                {house.husband ? <Mini person={house.husband} onPick={pick} /> : null}
                {house.wife ? <Mini person={house.wife} onPick={pick} /> : null}
              </div>
              {house.children.length ? (
                <div className="mt-3 space-y-2 border-t border-ink/8 pt-3">
                  <p className="text-xs font-medium text-muted">{copy.children}</p>
                  {house.children.map((c) => (
                    <Mini key={c.id} person={c} onPick={pick} />
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
