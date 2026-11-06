import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "./SortableItem";

type Props = {
  id: string;
  ids: string[];
  urls: Record<string, string>;
  highlight: boolean;
  className?: string;
  onDeleteItem: (id: string) => void;
  onHover: (id: string | null) => void;
};

/** A droppable, sortable container of images (a tier row or the bottom pool). */
export function DropArea({ id, ids, urls, highlight, className = "", onDeleteItem, onHover }: Props) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <SortableContext id={id} items={ids} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        data-container={id}
        className={`items ${className}${highlight ? " hover" : ""}`}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
      >
        {ids.map((itemId) => (
          <SortableItem key={itemId} id={itemId} url={urls[itemId]} onDelete={onDeleteItem} />
        ))}
      </div>
    </SortableContext>
  );
}
