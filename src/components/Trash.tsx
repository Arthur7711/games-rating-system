import { useDroppable } from "@dnd-kit/core";
import { TRASH_ID } from "../types";
import { TrashIcon } from "./icons";

export function Trash() {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ID });
  return (
    <div ref={setNodeRef} className={`trash${isOver ? " hover" : ""}`} title="Перетащите сюда, чтобы удалить">
      <TrashIcon />
    </div>
  );
}
