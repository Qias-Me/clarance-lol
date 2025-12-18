"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EntryBase = { _id: string | number };

interface EntryRepeaterProps<T extends EntryBase> {
  title: string;
  entries: T[];
  maxEntries: number;
  onAdd?: () => void;
  onRemove?: (id: T["_id"]) => void;
  renderSummary: (entry: T, idx: number) => React.ReactNode;
  renderBody: (entry: T, idx: number) => React.ReactNode;
  getEntryLabel?: (idx: number) => string;
  entryIcon?: React.ReactNode;
}

export function EntryRepeater<T extends EntryBase>({
  title,
  entries,
  maxEntries,
  onAdd,
  onRemove,
  renderSummary,
  renderBody,
  getEntryLabel = (idx) => `Entry ${idx + 1}`,
  entryIcon = <User className="w-4 h-4" />
}: EntryRepeaterProps<T>) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string | number>>(new Set([0]));

  const canAdd = entries.length < maxEntries;

  const handleAdd = () => {
    if (onAdd) {
      onAdd();
    }
    // Auto-expand the new entry
    if (entries.length > 0) {
      const newEntryId = entries[entries.length - 1]?._id;
      if (newEntryId !== undefined) {
        setExpandedEntries(prev => new Set(prev).add(newEntryId));
      }
    }
  };

  const handleRemove = (id: T["_id"]) => {
    if (onRemove) {
      onRemove(id);
    }
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const toggleExpanded = (id: T["_id"]) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-500">
            {entries.length} of {maxEntries} entries
          </p>
        </div>

        <Button
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex items-center gap-2"
          variant={canAdd ? "default" : "secondary"}
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      </div>

      <div className="space-y-3">
        {entries.map((entry, idx) => {
          const isExpanded = expandedEntries.has(entry._id);
          const entryLabel = getEntryLabel(idx);

          return (
            <Card key={String(entry._id)} className="w-full">
              <CardHeader
                className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(entry._id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700">
                      {entryIcon}
                    </div>

                    <div>
                      <CardTitle className="text-base">{entryLabel}</CardTitle>
                      <div className="mt-1">
                        {renderSummary(entry, idx)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {idx > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemove(entry._id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}

                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    {renderBody(entry, idx)}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {entries.length === 0 && (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-2">No entries yet</p>
              <Button
                onClick={handleAdd}
                disabled={!canAdd}
                variant="outline"
              >
                Add First Entry
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}