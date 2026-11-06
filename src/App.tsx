import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { POOL_ID, TRASH_ID, COLORS, type BoardState, type Tier } from "./types";
import * as db from "./db";
import { extractImageUrl, fetchImage, indexAtPoint, shrinkImage, uid } from "./utils";
import { TierRow } from "./components/TierRow";
import { DropArea } from "./components/DropArea";
import { Trash } from "./components/Trash";
import { SettingsModal } from "./components/SettingsModal";

function defaultBoard(): BoardState {
  const tiers: Tier[] = [
    { id: uid(), label: "лучшее", color: "#ff7f7f" },
    { id: uid(), label: "хорошо", color: "#ffbf7f" },
    { id: uid(), label: "норм", color: "#ffdf7f" },
    { id: uid(), label: "так себе", color: "#ffff7f" },
    { id: uid(), label: "зачем я это купил?", color: "#bfff7f" },
  ];
  return { tiers, items: Object.fromEntries([...tiers.map((t) => [t.id, []]), [POOL_ID, []]]) };
}

const newTier = (): Tier => ({ id: uid(), label: "Новый", color: COLORS[Math.floor(Math.random() * COLORS.length)] });

function findContainer(board: BoardState, id: string): string | undefined {
  if (id in board.items) return id;
  return Object.keys(board.items).find((key) => board.items[key].includes(id));
}

export default function App() {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overContainer, setOverContainer] = useState<string | null>(null);
  const [externalOver, setExternalOver] = useState<string | null>(null);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);

  const snapshot = useRef<Record<string, string[]> | null>(null);
  const hoveredContainer = useRef<string | null>(null);
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  /* ---------------- Load from IndexedDB ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, images] = await Promise.all([db.loadBoard(), db.loadAllImages()]);
      if (cancelled) return;
      const next = saved ?? defaultBoard();

      const loadedUrls: Record<string, string> = {};
      images.forEach((rec) => (loadedUrls[rec.id] = URL.createObjectURL(rec.blob)));

      // Repair: drop unknown ids / duplicates, make sure every tier has a list, put orphans in the pool.
      const placed = new Set<string>();
      const keep = (id: string) => id in loadedUrls && !placed.has(id) && !!placed.add(id);
      const items: Record<string, string[]> = {};
      for (const t of next.tiers) items[t.id] = (next.items[t.id] ?? []).filter(keep);
      items[POOL_ID] = (next.items[POOL_ID] ?? []).filter(keep);
      images.forEach((rec) => !placed.has(rec.id) && items[POOL_ID].push(rec.id));

      setUrls(loadedUrls);
      setBoard({ tiers: next.tiers, items });
    })().catch((err) => {
      console.error(err);
      alert("IndexedDB недоступна — данные не будут сохраняться.");
      setBoard(defaultBoard());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------- Save to IndexedDB (debounced) ---------------- */
  useEffect(() => {
    if (!board || activeId) return; // don't save intermediate drag states
    const t = setTimeout(() => db.saveBoard(board).catch(console.error), 250);
    return () => clearTimeout(t);
  }, [board, activeId]);

  /* ---------------- Image add / delete ---------------- */
  const addImages = useCallback(async (blobs: Blob[], containerId: string, index?: number) => {
    const images = blobs.filter((b) => b?.type.startsWith("image/"));
    if (!images.length) return;
    const newIds: string[] = [];
    const newUrls: Record<string, string> = {};
    for (const original of images) {
      const blob = await shrinkImage(original);
      const id = uid();
      await db.putImage(id, blob);
      newIds.push(id);
      newUrls[id] = URL.createObjectURL(blob);
    }
    setUrls((u) => ({ ...u, ...newUrls }));
    setBoard((b) => {
      if (!b) return b;
      const target = containerId in b.items ? containerId : POOL_ID;
      const list = [...b.items[target]];
      list.splice(index ?? list.length, 0, ...newIds);
      return { ...b, items: { ...b.items, [target]: list } };
    });
  }, []);

  const removeImages = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const gone = new Set(ids);
    setBoard((b) => b && { ...b, items: Object.fromEntries(Object.entries(b.items).map(([k, v]) => [k, v.filter((id) => !gone.has(id))])) });
    setUrls((u) => {
      const next = { ...u };
      ids.forEach((id) => {
        if (next[id]) URL.revokeObjectURL(next[id]);
        delete next[id];
      });
      return next;
    });
    db.deleteImages(ids).catch(console.error);
  }, []);

  const confirmDeleteImage = useCallback(
    (id: string) => {
      if (confirm("Удалить это фото?")) removeImages([id]);
    },
    [removeImages],
  );

  /* ---------------- External files: drag from desktop / other sites ---------------- */
  useEffect(() => {
    const containerAt = (t: EventTarget | null) => (t as Element | null)?.closest?.<HTMLElement>("[data-container]") ?? null;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault(); // stop the browser from opening the file
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setExternalOver(containerAt(e.target)?.dataset.container ?? POOL_ID);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setExternalOver(null);
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      setExternalOver(null);
      const el = containerAt(e.target);
      const containerId = el?.dataset.container ?? POOL_ID;
      const index = el ? indexAtPoint(el, e.clientX, e.clientY) : undefined;

      const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) return addImages(files, containerId, index);

      const url = extractImageUrl(e.dataTransfer);
      if (!url) return;
      try {
        await addImages([await fetchImage(url)], containerId, index);
      } catch {
        alert("Не удалось загрузить картинку с этого сайта. Сохраните её на компьютер и перетащите файл, или скопируйте и вставьте через Ctrl+V.");
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addImages]);

  /* ---------------- Paste (Ctrl+V) into the row under the mouse ---------------- */
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const target = hoveredContainer.current ?? POOL_ID;

      const blobs = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (blobs.length) {
        e.preventDefault();
        return addImages(blobs, target);
      }

      const text = e.clipboardData?.getData("text/plain").trim();
      if (text && /^https?:\/\/\S+$/i.test(text)) {
        try {
          await addImages([await fetchImage(text)], target);
        } catch {
          alert("Не удалось загрузить картинку по ссылке.");
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addImages]);

  // Revoke object URLs on unmount
  useEffect(() => () => Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u)), []);

  const onHover = useCallback((id: string | null) => {
    hoveredContainer.current = id;
  }, []);

  /* ---------------- Internal drag & drop (dnd-kit) ---------------- */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerIds = useMemo(() => new Set(board ? [...Object.keys(board.items), TRASH_ID] : []), [board]);

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const hits = args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
      if (!hits.length) return [];
      const trash = hits.find((h) => h.id === TRASH_ID);
      if (trash) return [trash];
      const item = hits.find((h) => !containerIds.has(String(h.id)));
      if (item) return [item];
      return [hits[0]];
    },
    [containerIds],
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    snapshot.current = board?.items ?? null;
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || over.id === TRASH_ID) {
      setOverContainer(null);
      return;
    }
    const activeKey = String(active.id);
    const overKey = String(over.id);
    if (board) setOverContainer(findContainer(board, overKey) ?? null);

    setBoard((b) => {
      if (!b) return b;
      const from = findContainer(b, activeKey);
      const to = findContainer(b, overKey);
      if (!from || !to || from === to) return b;

      const fromList = b.items[from].filter((id) => id !== activeKey);
      const toList = [...b.items[to]];
      let index = toList.length;
      if (overKey !== to) {
        const overIndex = toList.indexOf(overKey);
        const r = active.rect.current.translated;
        const after = r ? r.left + r.width / 2 > over.rect.left + over.rect.width / 2 : false;
        index = overIndex + (after ? 1 : 0);
      }
      toList.splice(index, 0, activeKey);
      return { ...b, items: { ...b.items, [from]: fromList, [to]: toList } };
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActiveId(null);
    setOverContainer(null);
    snapshot.current = null;
    if (!over) return;

    if (over.id === TRASH_ID) {
      removeImages([id]);
      return;
    }

    setBoard((b) => {
      if (!b) return b;
      const container = findContainer(b, id);
      if (!container || container !== findContainer(b, String(over.id))) return b;
      const list = b.items[container];
      const from = list.indexOf(id);
      const to = over.id === container ? list.length - 1 : list.indexOf(String(over.id));
      if (from === to || to < 0) return b;
      return { ...b, items: { ...b.items, [container]: arrayMove(list, from, to) } };
    });
  };

  const handleDragCancel = () => {
    const saved = snapshot.current;
    if (saved) setBoard((b) => b && { ...b, items: saved });
    snapshot.current = null;
    setActiveId(null);
    setOverContainer(null);
  };

  /* ---------------- Tier operations ---------------- */
  const moveTier = (index: number, dir: -1 | 1) =>
    setBoard((b) => {
      if (!b) return b;
      const to = index + dir;
      if (to < 0 || to >= b.tiers.length) return b;
      const tiers = [...b.tiers];
      const [t] = tiers.splice(index, 1);
      tiers.splice(to, 0, t);
      return { ...b, tiers };
    });

  const updateTier = (id: string, patch: Partial<Tier>) =>
    setBoard((b) => b && { ...b, tiers: b.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  const insertTier = (id: string, offset: 0 | 1) =>
    setBoard((b) => {
      if (!b) return b;
      const tier = newTier();
      const tiers = [...b.tiers];
      tiers.splice(tiers.findIndex((t) => t.id === id) + offset, 0, tier);
      return { tiers, items: { ...b.items, [tier.id]: [] } };
    });

  const clearTier = (id: string) =>
    setBoard((b) => b && { ...b, items: { ...b.items, [id]: [], [POOL_ID]: [...b.items[POOL_ID], ...b.items[id]] } });

  const deleteTier = (id: string) =>
    setBoard((b) => {
      if (!b) return b;
      const { [id]: removed = [], ...rest } = b.items;
      return { tiers: b.tiers.filter((t) => t.id !== id), items: { ...rest, [POOL_ID]: [...rest[POOL_ID], ...removed] } };
    });

  const addTierAtEnd = () =>
    setBoard((b) => {
      if (!b) return b;
      const tier = newTier();
      return { tiers: [...b.tiers, tier], items: { ...b.items, [tier.id]: [] } };
    });

  const resetAll = () => {
    if (!board || !confirm("Вернуть все фото вниз?")) return;
    setBoard((b) => {
      if (!b) return b;
      const all = b.tiers.flatMap((t) => b.items[t.id]);
      return { ...b, items: { ...Object.fromEntries(b.tiers.map((t) => [t.id, []])), [POOL_ID]: [...b.items[POOL_ID], ...all] } };
    });
  };

  const deleteAll = async () => {
    if (!confirm("Удалить ВСЕ фото? Это нельзя отменить.")) return;
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    setUrls({});
    setBoard((b) => b && { ...b, items: Object.fromEntries(Object.keys(b.items).map((k) => [k, []])) });
    await db.clearImages();
  };

  const closeSettings = useCallback(() => setEditingTierId(null), []);

  if (!board) return <div className="loading">Загрузка…</div>;

  const editingTier = board.tiers.find((t) => t.id === editingTierId);
  const highlightOf = (id: string) => overContainer === id || externalOver === id;

  return (
    <>
      <header className="toolbar">
        <h1>Tier List</h1>
        <div className="toolbar-actions">
          <label className="btn">
            + Добавить фото
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={async (e) => {
                const input = e.currentTarget;
                await addImages([...(input.files ?? [])], POOL_ID);
                input.value = "";
              }}
            />
          </label>
          <button className="btn" onClick={addTierAtEnd}>+ Ряд</button>
          <button className="btn" onClick={resetAll} title="Вернуть все фото вниз">Сбросить</button>
          <button className="btn danger" onClick={deleteAll} title="Удалить все фото">Удалить всё</button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <main className="board">
          <div className="tiers">
            {board.tiers.map((tier, i) => (
              <TierRow
                key={tier.id}
                tier={tier}
                ids={board.items[tier.id] ?? []}
                urls={urls}
                highlight={highlightOf(tier.id)}
                onSettings={() => setEditingTierId(tier.id)}
                onMoveUp={() => moveTier(i, -1)}
                onMoveDown={() => moveTier(i, 1)}
                onDeleteItem={confirmDeleteImage}
                onHover={onHover}
              />
            ))}
          </div>

          <div className="pool-wrap">
            <DropArea
              id={POOL_ID}
              ids={board.items[POOL_ID]}
              urls={urls}
              className="pool"
              highlight={highlightOf(POOL_ID)}
              onDeleteItem={confirmDeleteImage}
              onHover={onHover}
            />
            <Trash />
          </div>

          <p className="hint">
            Перетащите фото с компьютера в любой ряд или нажмите <kbd>Ctrl</kbd>+<kbd>V</kbd>, чтобы вставить картинку из
            буфера (в ряд под курсором). Правый клик по фото или корзина — удалить.
          </p>
        </main>

        <DragOverlay>{activeId ? <img className="item overlay" src={urls[activeId]} alt="" /> : null}</DragOverlay>
      </DndContext>

      {editingTier && (
        <SettingsModal
          tier={editingTier}
          onChange={(patch) => updateTier(editingTier.id, patch)}
          onClose={closeSettings}
          onAddAbove={() => {
            insertTier(editingTier.id, 0);
            closeSettings();
          }}
          onAddBelow={() => {
            insertTier(editingTier.id, 1);
            closeSettings();
          }}
          onClear={() => {
            clearTier(editingTier.id);
            closeSettings();
          }}
          onDelete={() => {
            if (!confirm(`Удалить ряд «${editingTier.label}»? Фото вернутся вниз.`)) return;
            deleteTier(editingTier.id);
            closeSettings();
          }}
        />
      )}
    </>
  );
}
