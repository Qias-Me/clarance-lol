/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useMemo } from "react";
import type { GoldenKeyInventory, GoldenKeyRecord } from "@/types/golden-key";

export function useGoldenKey() {
  const [goldenKey, setGoldenKey] = useState<GoldenKeyInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadGoldenKey = async () => {
      try {
        setLoading(true);
        const response = await fetch("/data/golden-key.json");
        if (!response.ok) {
          throw new Error(`Failed to load golden key: ${response.status}`);
        }
        const data = await response.json();
        setGoldenKey(data as GoldenKeyInventory);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    loadGoldenKey();
  }, []);

  return { goldenKey, loading, error };
}

export function useGoldenKeyLookup() {
  const { goldenKey } = useGoldenKey();

  const lookup = useMemo(() => {
    if (!goldenKey) {
      return {
        byUiPath: (_uiPath: string) => null,
        byFieldId: (_fieldId: string) => null,
        bySection: (_section: string) => [],
        byLabel: (_label: string) => [],
        search: (_query: string) => [],
      };
    }

    const records = Object.values(goldenKey.records);

    return {
      byUiPath: (uiPath: string): GoldenKeyRecord | null => {
        return records.find(r => r.uiPath === uiPath) || null;
      },

      byFieldId: (fieldId: string): GoldenKeyRecord | null => {
        return records.find(r => r.pdf.fieldId === fieldId) || null;
      },

      bySection: (section: string): GoldenKeyRecord[] => {
        return records.filter(r => r.logical.section === section);
      },

      byLabel: (label: string): GoldenKeyRecord[] => {
        const lowerLabel = label.toLowerCase();
        return records.filter(r =>
          r.label.toLowerCase().includes(lowerLabel)
        );
      },

      search: (query: string): GoldenKeyRecord[] => {
        const q = query.toLowerCase();
        return records.filter(r =>
          r.uiPath.toLowerCase().includes(q) ||
          r.label.toLowerCase().includes(q) ||
          r.pdf.fieldName.toLowerCase().includes(q)
        );
      },
    };
  }, [goldenKey]);

  return lookup;
}

export function useFieldMapping(uiPath: string) {
  const lookup = useGoldenKeyLookup();
  return lookup.byUiPath(uiPath);
}

export function useSectionFields(section: string) {
  const lookup = useGoldenKeyLookup();
  const fields = lookup.bySection(section);

  return useMemo(() => {
    const grouped: { [subsection: string]: GoldenKeyRecord[] } = {};

    fields.forEach(field => {
      const key = field.logical.subsection || 'direct';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(field);
    });

    return grouped;
  }, [fields]);
}