import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import type { GoldenKeyInventory, GoldenKeyRecord } from "@/types/golden-key";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const uiPath = searchParams.get("uiPath");

  try {
    // Load the Golden Key data
    const goldenKeyPath = join(process.cwd(), "public", "data", "golden-key.json");
    const goldenKeyData = await readFile(goldenKeyPath, "utf-8");
    const goldenKey = JSON.parse(goldenKeyData) as GoldenKeyInventory;

    if (uiPath) {
      // Test specific UI path lookup
      const record = Object.values(goldenKey.records).find(
        (r: GoldenKeyRecord) => r.uiPath === uiPath
      );

      if (!record) {
        return NextResponse.json(
          { error: "UI path not found", uiPath },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        mapping: {
          uiPath: record.uiPath,
          pdfField: record.pdf.fieldName,
          pdfFieldId: record.pdf.fieldId,
          pageNumber: record.pdf.pageNumber,
          fieldType: record.pdf.type,
          label: record.label,
          location: {
            section: record.logical.section,
            subsection: record.logical.subsection,
            entry: record.logical.entry,
          },
          rect: record.pdf.rects[0],
          fingerprint: record.fingerprint,
        },
      });
    }

    // Return overview
    return NextResponse.json({
      success: true,
      overview: {
        version: goldenKey.version,
        totalFields: goldenKey.totalFields,
        sections: Object.keys(goldenKey.bySection).length,
        generatedAt: goldenKey.generatedAt,
      },
      sampleMappings: Object.values(goldenKey.records)
        .slice(0, 10)
        .map((r: GoldenKeyRecord) => ({
          uiPath: r.uiPath,
          label: r.label,
          pdfField: r.pdf.fieldName,
          section: r.logical.section,
        })),
    });
  } catch (error) {
    console.error("Golden Key API error:", error);
    return NextResponse.json(
      { error: "Failed to load Golden Key data" },
      { status: 500 }
    );
  }
}