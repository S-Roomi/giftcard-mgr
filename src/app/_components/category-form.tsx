"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function CategoryForm({
  category,
  onClose,
}: {
  category?: { id: number; name: string };
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const utils = api.useUtils();
  const onSuccess = async () => {
    await utils.category.getAll.invalidate();
    onClose();
  };
  const create = api.category.create.useMutation({ onSuccess });
  const rename = api.category.rename.useMutation({ onSuccess });
  const pending = create.isPending || rename.isPending;
  const error = create.error ?? rename.error;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !name.trim()) return;
        if (category) rename.mutate({ id: category.id, name: name.trim() });
        else create.mutate({ name: name.trim() });
      }}
      className="flex min-w-0 flex-col gap-3 text-left"
    >
      <label className="flex min-w-0 flex-col gap-2 text-sm text-secondary">
        {category ? "Rename category" : "New category name"}
        <input
          autoFocus
          required
          maxLength={100}
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
          className="min-h-11 min-w-0 w-full rounded-md border border-edge-strong bg-surface px-3 py-2 text-base text-foreground focus:border-primary-hover focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.message.includes("Unique constraint")
            ? "A category with that name already exists."
            : error.message}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-md px-3 py-2 text-sm text-secondary hover:bg-edge disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={pending || !name.trim()} className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50">
          {pending ? "Saving…" : category ? "Save name" : "Create category"}
        </button>
      </div>
    </form>
  );
}
