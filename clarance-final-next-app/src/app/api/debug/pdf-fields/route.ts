import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { promises as fs } from "fs";
import path from "path";

/**
 * Debug endpoint to list all form fields in the PDF template
 */
export async function GET(): Promise<NextResponse> {
  try {
    const pdfPath = path.join(process.cwd(), "public", "data", "sf86.pdf");
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    const fields = form.getFields();
    const fieldInfo: Array<{
      name: string;
      type: string;
      typeName: string;
    }> = [];

    fields.forEach((field) => {
      fieldInfo.push({
        name: field.getName(),
        type: field.constructor.name,
        typeName: field.constructor.name
      });
    });

    // Sort fields for easier reading
    fieldInfo.sort((a, b) => a.name.localeCompare(b.name));

    // Group by type for analysis
    const fieldsByType = fieldInfo.reduce((acc, field) => {
      if (!acc[field.type]) {
        acc[field.type] = [];
      }
      acc[field.type].push(field.name);
      return acc;
    }, {} as Record<string, string[]>);

    return NextResponse.json({
      totalFields: fieldInfo.length,
      fieldsByType,
      sampleFields: fieldInfo.slice(0, 50), // First 50 fields
      sections: [...new Set(fieldInfo.map(f =>
        f.name.match(/Sections?\d+-\d+/)?.[0] || 'Unknown'
      ))].filter(s => s !== 'Unknown').sort()
    });
  } catch (error) {
    console.error("Error listing PDF fields:", error);
    return NextResponse.json(
      { error: "Failed to list PDF fields" },
      { status: 500 }
    );
  }
}