import { copy } from "@/lib/tree/copy";
import { formatEvent, fullName, initials } from "@/lib/tree/format";
import type { LayoutNode, Person } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { useMediaUrl } from "@/hooks/use-media-url";
import { Flag } from "./flag";
import { photoCropStyle, photoFrameClass, photoPadClass } from "./photo-adjust";

type Props = {
  person: Person;
  node: LayoutNode;
  selected: boolean;
  focused: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

export function PersonCard({ person, node, selected, focused, onSelect, onOpen }: Props) {
  const female = person.gender === "female";
  const born = formatEvent(copy.bornAbbr, person.birthDate, person.birthPlace);
  const died = formatEvent(copy.diedAbbr, person.deathDate, person.deathPlace);
  const photo = useMediaUrl(person.photoId);

  const open = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onSelect(person.id);
    onOpen(person.id);
  };

  return (
    <button
      type="button"
      data-person-id={person.id}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={open}
      onClick={open}
      className={cn(
        "person-card absolute overflow-hidden rounded-lg text-right outline-none",
        female ? "bg-female-fill" : "bg-male-fill",
        selected && "ring-2 ring-chip/70",
        focused && "ring-2 ring-chip",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
      }}
    >
      <span
        className={cn("absolute inset-y-0 right-0 w-1.5", female ? "bg-female" : "bg-male")}
        aria-hidden
      />
      <span
        className={cn(
          "absolute top-2.5 right-3.5 overflow-hidden rounded-md text-xs font-semibold text-cream",
          photoFrameClass(person.photoSize),
          female ? "bg-female" : "bg-male",
        )}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            className="object-cover"
            style={photoCropStyle(person.photoScale || 1, person.photoX, person.photoY)}
          />
        ) : (
          <span className="flex size-full items-center justify-center">{initials(person)}</span>
        )}
      </span>
      <span className={cn("block h-full px-3 py-2.5 pl-3", photoPadClass(person.photoSize), person.houseHead && "pb-7")}>
        {node.caption ? (
          <span className="mb-0.5 block truncate text-[10px] font-medium text-muted">{node.caption}</span>
        ) : null}
        <span className="flex min-w-0 items-center gap-1.5">
          <Flag code={person.countryCode} />
          <span className="truncate text-sm font-semibold text-ink">{fullName(person)}</span>
        </span>
        {born ? (
          <span className="mt-0.5 block truncate text-xs leading-5 text-muted">{born}</span>
        ) : null}
        {died ? (
          <span className="block truncate text-xs leading-5 text-muted">{died}</span>
        ) : null}
      </span>
      {person.houseHead ? (
        <span className="absolute inset-x-0 bottom-0 bg-chip py-0.5 text-center text-[10px] font-medium tracking-wide text-cream">
          {person.familyName || copy.houseHead}
        </span>
      ) : null}
    </button>
  );
}

