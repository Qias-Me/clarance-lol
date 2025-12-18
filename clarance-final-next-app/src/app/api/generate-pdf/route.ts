import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { promises as fs } from "fs";
import path from "path";

import type { FormValues } from "@/types/pdf-fields";
import { FieldNameMapper } from "@/lib/field-name-mapper";

interface RequestBody {
  values: FormValues;
}

/**
 * Loads the SF86 PDF template from the public directory.
 *
 * @returns {Promise<Buffer>} - The PDF file buffer
 */
async function loadPDFTemplate(): Promise<Buffer> {
  const pdfPath = path.join(process.cwd(), "public", "data", "sf86.pdf");
  return fs.readFile(pdfPath);
}

/**
 * Fills a PDF form field with the provided value.
 *
 * @param {ReturnType<PDFDocument["getForm"]>} form - The PDF form object
 * @param {string} fieldName - The name of the field to fill
 * @param {string | boolean} value - The value to set
 */
function fillField(
  form: ReturnType<PDFDocument["getForm"]>,
  fieldName: string,
  value: string | boolean
): void {
  try {
    const field = form.getField(fieldName);

    if (!field) {
      return;
    }

    const fieldType = field.constructor.name;

    if (fieldType === "PDFTextField") {
      const textField = form.getTextField(fieldName);
      textField.setText(String(value));
    } else if (fieldType === "PDFCheckBox") {
      const checkBox = form.getCheckBox(fieldName);
      if (value === true || value === "true" || value === "Yes") {
        checkBox.check();
      } else {
        checkBox.uncheck();
      }
    } else if (fieldType === "PDFRadioGroup") {
      const radioGroup = form.getRadioGroup(fieldName);
      radioGroup.select(String(value));
    } else if (fieldType === "PDFDropdown") {
      const dropdown = form.getDropdown(fieldName);
      dropdown.select(String(value));
    }
  } catch {
    return;
  }
}

/**
 * Handles POST requests to generate a filled PDF.
 *
 * @param {NextRequest} request - The incoming request object
 * @returns {Promise<NextResponse>} - The response with the filled PDF or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: RequestBody = await request.json();
    const { values } = body;

    if (!values || typeof values !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const pdfBytes = await loadPDFTemplate();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    console.log("Processing form values:", values);
    let processedFields = 0;
    let successfulFields = 0;

    for (const [fieldId, value] of Object.entries(values)) {
      if (value !== undefined && value !== "" && value !== null) {
        processedFields++;

        // Map golden key field name to actual PDF field name
        const pdfFieldId = FieldNameMapper.mapToPDFField(fieldId);
        const fieldChanged = fieldId !== pdfFieldId;

        console.log(`Attempting to fill field: ${fieldId}${fieldChanged ? ` -> ${pdfFieldId}` : ''} with value: ${value}`);

        try {
          const field = form.getField(pdfFieldId);
          if (field) {
            fillField(form, pdfFieldId, value);
            successfulFields++;
            console.log(`Successfully filled field: ${pdfFieldId}`);
          } else {
            console.log(`Field not found in PDF: ${pdfFieldId}`);
          }
        } catch (error) {
          console.log(`Error filling field ${pdfFieldId}:`, error);
        }
      }
    }

    console.log(`Processed ${processedFields} fields, successfully filled ${successfulFields} fields`);

    form.flatten();

    console.log("🔧 Flattening form fields...");
    const filledPdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(filledPdfBytes);

    console.log("📄 PDF generated successfully:");
    console.log(`   - File size: ${buffer.length} bytes`);
    console.log(`   - Fields processed: ${processedFields}`);
    console.log(`   - Fields filled: ${successfulFields}`);
    console.log(`   - Success rate: ${processedFields > 0 ? ((successfulFields / processedFields) * 100).toFixed(2) : 0}%`);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=sf86-filled.pdf",
        "X-Fields-Processed": processedFields.toString(),
        "X-Fields-Filled": successfulFields.toString(),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
