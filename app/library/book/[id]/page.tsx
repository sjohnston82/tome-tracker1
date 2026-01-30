"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBook } from "@/lib/hooks/useBook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BookDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { book, loading, error, updateBook, deleteBook } = useBook(params.id);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    title: "",
    authorName: "",
    seriesName: "",
    seriesNumber: "",
    publisher: "",
    publicationYear: "",
    tags: "",
  });

  const startEditing = () => {
    if (book) {
      setForm({
        title: book.title,
        authorName: book.author.name,
        seriesName: book.seriesName || "",
        seriesNumber: book.seriesNumber?.toString() || "",
        publisher: book.publisher || "",
        publicationYear: book.publicationYear?.toString() || "",
        tags: book.tags.join(", "),
      });
      setEditing(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateBook({
      title: form.title,
      authorName: form.authorName,
      seriesName: form.seriesName || null,
      seriesNumber: form.seriesNumber ? parseFloat(form.seriesNumber) : null,
      publisher: form.publisher || null,
      publicationYear: form.publicationYear ? parseInt(form.publicationYear, 10) : null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (result.success) setEditing(false);
  };

  const handleDelete = async () => {
    const result = await deleteBook();
    if (result.success) router.push("/library");
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (error || !book) {
    return (
      <div className="text-center py-12 text-red-600">
        {error || "Not found"}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        onClick={() => router.push("/library")}
        className="text-blue-600 hover:underline mb-4"
      >
        ← Back
      </button>
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <div className="flex gap-6 mb-6">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-32 h-48 object-cover rounded"
            />
          ) : (
            <div className="w-32 h-48 bg-gray-200 rounded flex items-center justify-center text-4xl">
              📖
            </div>
          )}
          <div>
            {editing ? (
              <div className="space-y-3">
                <Input
                  label="Title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
                <Input
                  label="Author"
                  value={form.authorName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      authorName: event.target.value,
                    }))
                  }
                />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{book.title}</h1>
                <p className="text-lg text-gray-600">by {book.author.name}</p>
                {book.seriesName && (
                  <p className="text-sm text-gray-500 mt-2">
                    📚 {book.seriesName} #{book.seriesNumber}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Series"
                value={form.seriesName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, seriesName: event.target.value }))
                }
              />
              <Input
                label="Series #"
                type="number"
                value={form.seriesNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    seriesNumber: event.target.value,
                  }))
                }
              />
              <Input
                label="Publisher"
                value={form.publisher}
                onChange={(event) =>
                  setForm((current) => ({ ...current, publisher: event.target.value }))
                }
              />
              <Input
                label="Year"
                type="number"
                value={form.publicationYear}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    publicationYear: event.target.value,
                  }))
                }
              />
            </div>
            <Input
              label="Tags"
              value={form.tags}
              onChange={(event) =>
                setForm((current) => ({ ...current, tags: event.target.value }))
              }
            />
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {book.isbn13 && (
              <>
                <dt className="text-gray-500">ISBN-13</dt>
                <dd className="font-mono">{book.isbn13}</dd>
              </>
            )}
            {book.publisher && (
              <>
                <dt className="text-gray-500">Publisher</dt>
                <dd>{book.publisher}</dd>
              </>
            )}
            {book.publicationYear && (
              <>
                <dt className="text-gray-500">Year</dt>
                <dd>{book.publicationYear}</dd>
              </>
            )}
            <dt className="text-gray-500">Source</dt>
            <dd className="capitalize">{book.source.toLowerCase()}</dd>
          </dl>
        )}
        <div className="mt-6 pt-4 border-t flex gap-3">
          {editing ? (
            <>
              <Button onClick={handleSave} loading={saving}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={startEditing}>Edit</Button>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">Delete book?</h2>
            <p className="text-gray-600 mb-6">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
