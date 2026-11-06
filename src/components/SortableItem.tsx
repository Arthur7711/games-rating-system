import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  id: string;
  url: string | undefined;
  onDelete: (id: string) => void;
};

export function SortableItem({ id, url, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <img
      ref={setNodeRef}
      src={url}
      alt=""
      draggable={false}
      data-item-id={id}
      className={`item${isDragging ? " dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete(id);
      }}
      {...attributes}
      {...listeners}
    />
  );
}
