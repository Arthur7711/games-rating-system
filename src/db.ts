import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BoardState } from "./types";

interface TierListDB extends DBSchema {
  images: { key: string; value: { id: string; blob: Blob } };
  meta: { key: string; value: BoardState };
}

let dbPromise: Promise<IDBPDatabase<TierListDB>> | null = null;

function getDB() {
  dbPromise ??= openDB<TierListDB>("tierlist-react-db", 1, {
    upgrade(db) {
      db.createObjectStore("images", { keyPath: "id" });
      db.createObjectStore("meta");
    },
  });
  return dbPromise;
}

export async function loadBoard() {
  return (await getDB()).get("meta", "board");
}

export async function saveBoard(board: BoardState) {
  await (await getDB()).put("meta", board, "board");
}

export async function loadAllImages() {
  return (await getDB()).getAll("images");
}

export async function putImage(id: string, blob: Blob) {
  await (await getDB()).put("images", { id, blob });
}

export async function deleteImages(ids: string[]) {
  const tx = (await getDB()).transaction("images", "readwrite");
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function clearImages() {
  await (await getDB()).clear("images");
}
